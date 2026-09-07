import { and, desc, eq, or, sql } from 'drizzle-orm'
import type { Database } from '../../db'
import {
  connectionNotificationDeliveries,
  hackathonConnectionDailyLimits,
  hackathonConnectionRequests,
  hackathonProjectContacts,
  talentProfiles,
} from '../../db/schema'
import { decryptContact, encryptContact } from '../../lib/contact-encryption'
import { beijingDate } from '../../lib/beijing-date'
import { NOTIFICATION_TYPES } from '../../lib/mail/notification-types'
import { HACKATHON_EVENT_ID } from '../hackathon/service'
import { UserProfileService } from '../user/service'
import { ConnectionRequestStatus, HACKATHON_CONNECTION_PURPOSES, TalentProfileStatus } from '@shenicest/shared'
import type { AcceptConnectionBody, CreateConnectionBody } from './model'

export class HackathonConnectionError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

// D5 seam over the external event database: the service never reaches the
// event DB itself, so tests stub these and the module index wires the real
// HackathonService. `url` (web page link for the connections card) is optional
// and only present when the composition root knows the web base URL.
export interface HackathonConnectionProjectSource {
  getVisibleProject: (hackathonProjectId: number) => Promise<{ id: number } | null>
  getProjectSummary: (hackathonProjectId: number) => Promise<{ name: string; url?: string } | null>
}

type ContactInput = { wechat?: string; email?: string }
type ContactPayload = { wechat: string | null; email: string | null }

function iso(value: Date | null) {
  return value?.toISOString() ?? null
}

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
  private users: UserProfileService

  constructor(
    private db: Database,
    private source: HackathonConnectionProjectSource,
  ) {
    this.users = new UserProfileService(db)
  }

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

  // Receiver-side accept (PRD 11.2). Only the locked receiver may act — any
  // other caller gets REQUEST_NOT_FOUND so request existence is not leaked.
  // A hidden target project cancels the Pending request as part of the same
  // transaction, then the endpoint reports 409.
  async accept(viewerId: string, requestId: number, body: AcceptConnectionBody) {
    const accepted = await this.db.transaction(async (tx): Promise<RequestRow | 'CANCELLED'> => {
      const [row] = await tx.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, requestId)).for('update')
      if (!row || row.receiverUserId !== viewerId) {
        throw new HackathonConnectionError('REQUEST_NOT_FOUND', 'Connection request not found')
      }
      if (row.status === ConnectionRequestStatus.Accepted) return row
      if (row.status !== ConnectionRequestStatus.Pending) {
        throw new HackathonConnectionError('REQUEST_NOT_PENDING', 'Request is not pending')
      }
      const visible = await this.source.getVisibleProject(row.hackathonProjectId)
      if (!visible) {
        await tx
          .update(hackathonConnectionRequests)
          .set({ status: ConnectionRequestStatus.Cancelled, pairKey: null, handledAt: new Date() })
          .where(and(eq(hackathonConnectionRequests.id, requestId), eq(hackathonConnectionRequests.status, ConnectionRequestStatus.Pending)))
        return 'CANCELLED'
      }
      const receiverContact = authorizedContact(body)
      await tx
        .update(hackathonConnectionRequests)
        .set({
          receiverContact: encryptContact(receiverContact),
          status: ConnectionRequestStatus.Accepted,
          acceptedAt: new Date(),
          handledAt: new Date(),
          pairKey: null,
        })
        .where(and(eq(hackathonConnectionRequests.id, requestId), eq(hackathonConnectionRequests.status, ConnectionRequestStatus.Pending)))
      const [updated] = await tx.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, requestId)).limit(1)
      return updated
    })
    if (accepted === 'CANCELLED') {
      throw new HackathonConnectionError('REQUEST_NOT_PENDING', 'Request is not pending')
    }
    return this.viewRequest(accepted, viewerId)
  }

  // Receiver-side ignore. Idempotent on already-Ignored rows; Accepted and
  // Cancelled rows are rejected.
  async ignore(viewerId: string, requestId: number) {
    const row = await this.db.transaction(async (tx): Promise<RequestRow> => {
      const [record] = await tx.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, requestId)).for('update')
      if (!record || record.receiverUserId !== viewerId) {
        throw new HackathonConnectionError('REQUEST_NOT_FOUND', 'Connection request not found')
      }
      if (record.status === ConnectionRequestStatus.Ignored) return record
      if (record.status !== ConnectionRequestStatus.Pending) {
        throw new HackathonConnectionError('REQUEST_NOT_PENDING', 'Request is not pending')
      }
      await tx
        .update(hackathonConnectionRequests)
        .set({ status: ConnectionRequestStatus.Ignored, pairKey: null, handledAt: new Date() })
        .where(and(eq(hackathonConnectionRequests.id, requestId), eq(hackathonConnectionRequests.status, ConnectionRequestStatus.Pending)))
      const [updated] = await tx.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, requestId)).limit(1)
      return updated
    })
    return this.viewRequest(row, viewerId)
  }

  // Contact unlock: both parties of an Accepted request read their own and the
  // other side's authorized contact. Everything else is 403 — existence and
  // state are not distinguished for non-parties.
  async contacts(viewerId: string, requestId: number) {
    const [row] = await this.db.select().from(hackathonConnectionRequests).where(eq(hackathonConnectionRequests.id, requestId)).limit(1)
    if (!row || row.status !== ConnectionRequestStatus.Accepted || ![row.senderUserId, row.receiverUserId].includes(viewerId)) {
      throw new HackathonConnectionError('CONTACTS_FORBIDDEN', 'Contacts are only available for accepted requests')
    }
    return this.contactsFor(row, viewerId)
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

  private contactsFor(row: RequestRow, viewerId: string) {
    const mine = row.senderUserId === viewerId ? row.senderContact : row.receiverContact!
    const other = row.senderUserId === viewerId ? row.receiverContact! : row.senderContact
    return {
      mine: decryptContact<ContactPayload>(mine),
      other: decryptContact<ContactPayload>(other),
    }
  }

  private async participantDto(userId: string) {
    const identity = await this.users.getPublicProfile(userId)
    const [profile] = await this.db
      .select({ status: talentProfiles.status })
      .from(talentProfiles)
      .where(eq(talentProfiles.userId, userId))
      .limit(1)
    return {
      userId,
      nickname: identity?.nickname ?? null,
      avatarUrl: identity?.avatarUrl ?? null,
      hasPublishedTalentProfile: profile?.status === TalentProfileStatus.Published,
    }
  }

  // Unified connection DTO (ticket 05 shape). `contacts` is present only for
  // Accepted requests viewed by one of the two parties.
  private async viewRequest(row: RequestRow, viewerId: string) {
    const [sender, receiver, summary] = await Promise.all([
      this.participantDto(row.senderUserId),
      this.participantDto(row.receiverUserId),
      this.source.getProjectSummary(row.hackathonProjectId),
    ])
    const contacts =
      row.status === ConnectionRequestStatus.Accepted && [row.senderUserId, row.receiverUserId].includes(viewerId)
        ? this.contactsFor(row, viewerId)
        : undefined
    return {
      id: row.id,
      source: 'hackathon' as const,
      status: row.status,
      senderUserId: row.senderUserId,
      receiverUserId: row.receiverUserId,
      sender,
      receiver,
      target: {
        type: 'hackathon_project' as const,
        projectId: row.hackathonProjectId,
        eventId: row.eventId,
        name: summary?.name,
        url: summary?.url,
        ...(summary ? {} : { unavailable: true }),
      },
      purpose: row.purpose,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      acceptedAt: iso(row.acceptedAt),
      handledAt: iso(row.handledAt),
      ...(contacts ? { contacts } : {}),
    }
  }

  // All requests touching the viewer, for the unified /connections aggregate
  // (ticket 05). Read-only composition — no state machine logic here.
  async listForUser(viewerId: string) {
    const rows = await this.db
      .select()
      .from(hackathonConnectionRequests)
      .where(or(eq(hackathonConnectionRequests.senderUserId, viewerId), eq(hackathonConnectionRequests.receiverUserId, viewerId)))
      .orderBy(desc(hackathonConnectionRequests.id))
    return {
      data: await Promise.all(rows.map((row) => this.viewRequest(row, viewerId))),
      pendingReceived: rows.filter(
        (row) => row.receiverUserId === viewerId && row.status === ConnectionRequestStatus.Pending,
      ).length,
    }
  }
}

// Unified list item shape consumed by the /connections aggregate, derived from
// the service output so there is exactly one author of the DTO.
export type HackathonConnectionListItem = Awaited<ReturnType<HackathonConnectionService['listForUser']>>['data'][number]
