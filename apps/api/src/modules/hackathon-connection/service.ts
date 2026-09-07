import { and, desc, eq, sql } from 'drizzle-orm'
import type { Database } from '../../db'
import {
  connectionNotificationDeliveries,
  hackathonConnectionDailyLimits,
  hackathonConnectionRequests,
  hackathonProjectContacts,
} from '../../db/schema'
import { encryptContact } from '../../lib/contact-encryption'
import { beijingDate } from '../../lib/beijing-date'
import { NOTIFICATION_TYPES } from '../../lib/mail/notification-types'
import { HACKATHON_EVENT_ID } from '../hackathon/service'
import { ConnectionRequestStatus, HACKATHON_CONNECTION_PURPOSES } from '@shenicest/shared'
import type { CreateConnectionBody } from './model'

export class HackathonConnectionError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

// D5 seam over the external event database: the service never reaches the
// event DB itself, so tests stub these and the module index wires the real
// HackathonService.
export interface HackathonConnectionProjectSource {
  getVisibleProject: (hackathonProjectId: number) => Promise<{ id: number } | null>
  getProjectSummary: (hackathonProjectId: number) => Promise<{ name: string } | null>
}

type ContactInput = { wechat?: string; email?: string }

// P0 fixes the daily send limit at 3 (PRD 7.3); the Ignored cooldown is 7 days (PRD 7.4).
const DAILY_LIMIT = 3
const IGNORE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

const hasControlChars = (value: string | undefined) => value !== undefined && /[\u0000-\u001f\u007f]/.test(value)

// Same contract as Talent connections: at least one of WeChat / email, no
// control characters, email normalized to lower-case. Differences per D8:
// every contact violation maps to INVALID_CONTACT (no separate CONTACT_REQUIRED).
function authorizedContact(input: ContactInput) {
  const wechat = input.wechat?.trim()
  const email = input.email?.trim().toLowerCase()
  if (hasControlChars(wechat) || hasControlChars(email)) {
    throw new HackathonConnectionError('INVALID_CONTACT', 'Contact methods cannot contain control characters')
  }
  if (wechat && (wechat.length < 1 || wechat.length > 64)) {
    throw new HackathonConnectionError('INVALID_CONTACT', 'WeChat ID must be 1-64 characters')
  }
  if (email && (email.length < 1 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new HackathonConnectionError('INVALID_CONTACT', 'Email address is invalid')
  }
  if (!wechat && !email) {
    throw new HackathonConnectionError('INVALID_CONTACT', 'At least one contact method is required')
  }
  return { wechat: wechat ?? null, email: email ?? null }
}

type RequestRow = typeof hackathonConnectionRequests.$inferSelect

export class HackathonConnectionService {
  constructor(
    private db: Database,
    private source: HackathonConnectionProjectSource,
  ) {}

  async create(senderUserId: string, hackathonProjectId: number, body: CreateConnectionBody) {
    if (!HACKATHON_CONNECTION_PURPOSES.includes(body.purpose)) {
      throw new HackathonConnectionError('INVALID_PURPOSE', 'Purpose is not supported')
    }
    const message = body.message.trim()
    if (message.length < 30 || message.length > 500 || hasControlChars(message)) {
      throw new HackathonConnectionError('INVALID_MESSAGE', 'Message must be 30-500 characters without control characters')
    }
    const senderContact = authorizedContact(body)
    // Visibility uses the same rule as the detail page (D3/D5); the quantum
    // keyword filter does not participate.
    const project = await this.source.getVisibleProject(hackathonProjectId)
    if (!project) throw new HackathonConnectionError('PROJECT_NOT_FOUND', 'Hackathon project not found')
    try {
      return await this.db.transaction(async (tx) => {
        // Locking the receiver row serializes creates for this project and
        // guarantees the receiver snapshot below is stable.
        const [contact] = await tx
          .select()
          .from(hackathonProjectContacts)
          .where(
            and(
              eq(hackathonProjectContacts.eventId, HACKATHON_EVENT_ID),
              eq(hackathonProjectContacts.hackathonProjectId, hackathonProjectId),
            ),
          )
          .for('update')
        if (!contact) throw new HackathonConnectionError('NO_RECEIVER_CONFIGURED', 'Project has no receiver configured')
        if (contact.receiverUserId === senderUserId) {
          throw new HackathonConnectionError('CANNOT_CONNECT_SELF', 'Cannot connect to a project you are the receiver of')
        }
        const existing = await tx
          .select()
          .from(hackathonConnectionRequests)
          .where(
            and(
              eq(hackathonConnectionRequests.senderUserId, senderUserId),
              eq(hackathonConnectionRequests.hackathonProjectId, hackathonProjectId),
            ),
          )
          .for('update')
        if (existing.some((row) => row.status === ConnectionRequestStatus.Accepted)) {
          throw new HackathonConnectionError('ALREADY_CONNECTED', 'Users are already connected')
        }
        if (existing.some((row) => row.status === ConnectionRequestStatus.Pending)) {
          throw new HackathonConnectionError('PENDING_EXISTS', 'A pending request already exists')
        }
        const lastIgnored = this.latestByStatus(existing, ConnectionRequestStatus.Ignored)
        if (lastIgnored?.handledAt && Date.now() - lastIgnored.handledAt.getTime() < IGNORE_COOLDOWN_MS) {
          throw new HackathonConnectionError('RETRY_COOLDOWN', 'Please wait 7 days after an ignored request before retrying')
        }
        const date = beijingDate()
        await tx.execute(
          sql`INSERT IGNORE INTO ${hackathonConnectionDailyLimits} (sender_user_id, beijing_date, successful_count) VALUES (${senderUserId}, ${date}, 0)`,
        )
        const [daily] = await tx
          .select()
          .from(hackathonConnectionDailyLimits)
          .where(
            and(
              eq(hackathonConnectionDailyLimits.senderUserId, senderUserId),
              eq(hackathonConnectionDailyLimits.beijingDate, date),
            ),
          )
          .for('update')
        if ((daily?.successfulCount ?? 0) >= DAILY_LIMIT) {
          throw new HackathonConnectionError('RATE_LIMITED', 'Daily connection request limit reached')
        }
        const [inserted] = await tx
          .insert(hackathonConnectionRequests)
          .values({
            eventId: HACKATHON_EVENT_ID,
            hackathonProjectId,
            receiverUserId: contact.receiverUserId,
            senderUserId,
            purpose: body.purpose,
            message,
            senderContact: encryptContact(senderContact),
            status: ConnectionRequestStatus.Pending,
            pairKey: `${senderUserId}:${hackathonProjectId}`,
          })
        // The delivery row is written even when NOTIFICATION_WORKER=off —
        // turning the worker off pauses delivery, it never loses requests.
        await tx.insert(connectionNotificationDeliveries).values({
          connectionRequestId: inserted.insertId,
          notificationType: NOTIFICATION_TYPES.CONNECTION_CREATED,
          recipientEmail: contact.notificationEmail,
          status: 'Pending',
        })
        await tx
          .update(hackathonConnectionDailyLimits)
          .set({ successfulCount: sql`${hackathonConnectionDailyLimits.successfulCount} + 1` })
          .where(eq(hackathonConnectionDailyLimits.id, daily.id))
        const [created] = await tx
          .select()
          .from(hackathonConnectionRequests)
          .where(eq(hackathonConnectionRequests.id, inserted.insertId))
          .limit(1)
        return this.statusDto(created)
      })
    } catch (error) {
      if (error instanceof HackathonConnectionError) throw error
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        throw new HackathonConnectionError('PENDING_EXISTS', 'A pending request already exists')
      }
      throw error
    }
  }

  // Status summary for the detail-page button (PRD 11.1): the sender's latest
  // request for the project, or null. Never includes contacts.
  async statusFor(senderUserId: string, hackathonProjectId: number) {
    const [row] = await this.db
      .select()
      .from(hackathonConnectionRequests)
      .where(
        and(
          eq(hackathonConnectionRequests.eventId, HACKATHON_EVENT_ID),
          eq(hackathonConnectionRequests.senderUserId, senderUserId),
          eq(hackathonConnectionRequests.hackathonProjectId, hackathonProjectId),
        ),
      )
      .orderBy(desc(hackathonConnectionRequests.id))
      .limit(1)
    // Spec shape for the status summary (ticket): exactly id / status / createdAt.
    return row ? { id: row.id, status: row.status, createdAt: row.createdAt.toISOString() } : null
  }

  // D3 hook target: hidden projects cannot receive new requests, and their
  // Pending requests end as Cancelled. Accepted connections are preserved.
  async cancelPendingByProject(eventId: number, hackathonProjectId: number) {
    await this.db
      .update(hackathonConnectionRequests)
      .set({ status: ConnectionRequestStatus.Cancelled, pairKey: null, handledAt: new Date() })
      .where(
        and(
          eq(hackathonConnectionRequests.eventId, eventId),
          eq(hackathonConnectionRequests.hackathonProjectId, hackathonProjectId),
          eq(hackathonConnectionRequests.status, ConnectionRequestStatus.Pending),
        ),
      )
  }

  private latestByStatus(rows: RequestRow[], status: ConnectionRequestStatus) {
    return rows
      .filter((row) => row.status === status)
      .sort((a, b) => b.id - a.id)[0]
  }

  private statusDto(row: RequestRow) {
    return {
      id: row.id,
      eventId: row.eventId,
      hackathonProjectId: row.hackathonProjectId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }
  }
}
