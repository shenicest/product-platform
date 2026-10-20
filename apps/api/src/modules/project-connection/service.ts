import { and, desc, eq, or, sql } from 'drizzle-orm'
import type { Database } from '../../db'
import {
  ConnectionDailyLimitScope,
  connectionDailyLimits,
  connectionNotificationDeliveries,
  projectConnectionRequests,
  projects,
  talentProfiles,
} from '../../db/schema'
import { decryptContact, encryptContact } from '../../lib/contact-encryption'
import { beijingDate } from '../../lib/beijing-date'
import { NOTIFICATION_TYPES } from '../../lib/mail/notification-types'
import { UserProfileService } from '../user/service'
import {
  ConnectionRequestStatus,
  PROJECT_CONNECTION_PURPOSES,
  ProjectStatus,
  TalentProfileStatus,
} from '@shenicest/shared'
import type { AcceptConnectionBody, CreateConnectionBody } from './model'

export class ProjectConnectionError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

type ContactInput = { wechat?: string; phone?: string; email?: string }
type ContactPayload = { wechat: string | null; phone: string | null; email: string | null }

function iso(value: Date | null) {
  return value?.toISOString() ?? null
}

// Same P0 quota as the neighbouring project-connection surfaces.
const DAILY_LIMIT = 3
const IGNORE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

const hasControlChars = (value: string | undefined) => value !== undefined && /[\u0000-\u001f\u007f]/.test(value)

// At least one of WeChat / phone / email, no control characters, email
// normalized to lower-case. Phone validation stays permissive enough for
// international numbers while still rejecting obvious junk.
function authorizedContact(input: ContactInput) {
  const wechat = input.wechat?.trim()
  const phone = input.phone?.trim()
  const email = input.email?.trim().toLowerCase()
  if (hasControlChars(wechat) || hasControlChars(phone) || hasControlChars(email)) {
    throw new ProjectConnectionError('INVALID_CONTACT', '联系方式不能包含控制字符')
  }
  if (wechat && (wechat.length < 1 || wechat.length > 64)) {
    throw new ProjectConnectionError('INVALID_CONTACT', '微信号长度必须为 1-64 个字符')
  }
  if (phone && (phone.length < 5 || phone.length > 32 || !/^[+\d][\d\s()-]*$/.test(phone))) {
    throw new ProjectConnectionError('INVALID_CONTACT', '手机号格式不正确')
  }
  if (email && (email.length < 1 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    throw new ProjectConnectionError('INVALID_CONTACT', '邮箱格式不正确')
  }
  if (!wechat && !phone && !email) {
    throw new ProjectConnectionError('INVALID_CONTACT', '至少提供微信、手机号或邮箱中的一项')
  }
  return { wechat: wechat ?? null, phone: phone ?? null, email: email ?? null }
}

type RequestRow = typeof projectConnectionRequests.$inferSelect

export interface ProjectConnectionServiceOptions {
  webBaseUrl?: string
}

export class ProjectConnectionService {
  private users: UserProfileService
  private base: string | null

  constructor(
    private db: Database,
    options: ProjectConnectionServiceOptions = {},
  ) {
    this.users = new UserProfileService(db)
    this.base = options.webBaseUrl?.replace(/\/+$/, '') ?? null
  }

  async create(senderUserId: string, projectId: number, body: CreateConnectionBody) {
    if (!PROJECT_CONNECTION_PURPOSES.includes(body.purpose)) {
      throw new ProjectConnectionError('INVALID_PURPOSE', '请选择有效的联系目的')
    }
    const message = body.message.trim()
    if (message.length < 30 || message.length > 500 || hasControlChars(message)) {
      throw new ProjectConnectionError('INVALID_MESSAGE', '留言必须为 30-500 个字符，且不能包含控制字符')
    }
    const senderContact = authorizedContact(body)
    try {
      return await this.db.transaction(async (tx) => {
        // Locking the project row stabilizes the receiver snapshot and the
        // Live-visibility check for the whole create transaction.
        const [project] = await tx
          .select({ id: projects.id, userId: projects.userId, status: projects.status })
          .from(projects)
          .where(eq(projects.id, projectId))
          .for('update')
        if (!project || project.status !== ProjectStatus.Live) {
          throw new ProjectConnectionError('PROJECT_NOT_FOUND', '项目不存在或已下线')
        }
        if (project.userId === senderUserId) {
          throw new ProjectConnectionError('CANNOT_CONNECT_SELF', '不能联系自己的项目')
        }
        const existing = await tx
          .select()
          .from(projectConnectionRequests)
          .where(
            and(
              eq(projectConnectionRequests.senderUserId, senderUserId),
              eq(projectConnectionRequests.projectId, projectId),
            ),
          )
          .for('update')
        if (existing.some((row) => row.status === ConnectionRequestStatus.Accepted)) {
          throw new ProjectConnectionError('ALREADY_CONNECTED', '你们已经建立连接')
        }
        if (existing.some((row) => row.status === ConnectionRequestStatus.Pending)) {
          throw new ProjectConnectionError('PENDING_EXISTS', '你已经提交过申请，请等待项目方回应')
        }
        const lastIgnored = this.latestByStatus(existing, ConnectionRequestStatus.Ignored)
        if (lastIgnored?.handledAt && Date.now() - lastIgnored.handledAt.getTime() < IGNORE_COOLDOWN_MS) {
          throw new ProjectConnectionError('RETRY_COOLDOWN', '申请被忽略后需等待 7 天才能再次发起')
        }
        const date = beijingDate()
        await tx.execute(
          sql`INSERT IGNORE INTO ${connectionDailyLimits} (scope, sender_user_id, beijing_date, successful_count) VALUES (${ConnectionDailyLimitScope.ProjectConnection}, ${senderUserId}, ${date}, 0)`,
        )
        const [daily] = await tx
          .select()
          .from(connectionDailyLimits)
          .where(
            and(
              eq(connectionDailyLimits.scope, ConnectionDailyLimitScope.ProjectConnection),
              eq(connectionDailyLimits.senderUserId, senderUserId),
              eq(connectionDailyLimits.beijingDate, date),
            ),
          )
          .for('update')
        if ((daily?.successfulCount ?? 0) >= DAILY_LIMIT) {
          throw new ProjectConnectionError('RATE_LIMITED', '今日建联次数已用完，请明天再试')
        }
        const [inserted] = await tx
          .insert(projectConnectionRequests)
          .values({
            projectId,
            receiverUserId: project.userId,
            senderUserId,
            purpose: body.purpose,
            message,
            senderContact: encryptContact(senderContact),
            status: ConnectionRequestStatus.Pending,
            pairKey: `${senderUserId}:${projectId}`,
          })
        // Reminder mail is best-effort: a missing account email degrades to
        // in-platform only, never blocks the request.
        const receiverEmail = await this.users.getEmail(project.userId)
        if (receiverEmail) {
          await tx.insert(connectionNotificationDeliveries).values({
            connectionRequestId: inserted.insertId,
            notificationType: NOTIFICATION_TYPES.PROJECT_CONNECTION_CREATED,
            recipientEmail: receiverEmail,
            status: 'Pending',
          })
        }
        await tx
          .update(connectionDailyLimits)
          .set({ successfulCount: sql`${connectionDailyLimits.successfulCount} + 1` })
          .where(eq(connectionDailyLimits.id, daily.id))
        const [created] = await tx
          .select()
          .from(projectConnectionRequests)
          .where(eq(projectConnectionRequests.id, inserted.insertId))
          .limit(1)
        return this.statusDto(created)
      })
    } catch (error) {
      if (error instanceof ProjectConnectionError) throw error
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        throw new ProjectConnectionError('PENDING_EXISTS', '你已经提交过申请，请等待项目方回应')
      }
      throw error
    }
  }

  // Detail-page status summary. The button is hidden when the project is not
  // Live (not discoverable) or when the viewer owns it.
  async statusFor(senderUserId: string, projectId: number) {
    const [project] = await this.db
      .select({ userId: projects.userId, status: projects.status })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)
    const receiverConfigured = project?.status === ProjectStatus.Live
    const viewerIsReceiver = project?.userId === senderUserId
    const [row] = await this.db
      .select()
      .from(projectConnectionRequests)
      .where(
        and(
          eq(projectConnectionRequests.senderUserId, senderUserId),
          eq(projectConnectionRequests.projectId, projectId),
        ),
      )
      .orderBy(desc(projectConnectionRequests.id))
      .limit(1)
    return {
      data: row ? { id: row.id, status: row.status, createdAt: row.createdAt.toISOString() } : null,
      receiverConfigured,
      viewerIsReceiver,
    }
  }

  // Receiver-side accept. Only the locked receiver may act — any other caller
  // gets REQUEST_NOT_FOUND so request existence is not leaked. A project that
  // is no longer Live cancels the Pending request in the same transaction.
  async accept(viewerId: string, requestId: number, body: AcceptConnectionBody) {
    const accepted = await this.db.transaction(async (tx): Promise<RequestRow | 'CANCELLED'> => {
      const [row] = await tx
        .select()
        .from(projectConnectionRequests)
        .where(eq(projectConnectionRequests.id, requestId))
        .for('update')
      if (!row || row.receiverUserId !== viewerId) {
        throw new ProjectConnectionError('REQUEST_NOT_FOUND', '建联申请不存在')
      }
      if (row.status === ConnectionRequestStatus.Accepted) return row
      if (row.status !== ConnectionRequestStatus.Pending) {
        throw new ProjectConnectionError('REQUEST_NOT_PENDING', '该申请当前不是待处理状态')
      }
      const [project] = await tx
        .select({ status: projects.status })
        .from(projects)
        .where(eq(projects.id, row.projectId))
        .limit(1)
      if (!project || project.status !== ProjectStatus.Live) {
        await tx
          .update(projectConnectionRequests)
          .set({ status: ConnectionRequestStatus.Cancelled, pairKey: null, handledAt: new Date() })
          .where(
            and(
              eq(projectConnectionRequests.id, requestId),
              eq(projectConnectionRequests.status, ConnectionRequestStatus.Pending),
            ),
          )
        return 'CANCELLED'
      }
      const receiverContact = authorizedContact(body)
      await tx
        .update(projectConnectionRequests)
        .set({
          receiverContact: encryptContact(receiverContact),
          status: ConnectionRequestStatus.Accepted,
          acceptedAt: new Date(),
          handledAt: new Date(),
          pairKey: null,
        })
        .where(
          and(
            eq(projectConnectionRequests.id, requestId),
            eq(projectConnectionRequests.status, ConnectionRequestStatus.Pending),
          ),
        )
      const senderEmail = await this.users.getEmail(row.senderUserId)
      if (senderEmail) {
        await tx.insert(connectionNotificationDeliveries).values({
          connectionRequestId: requestId,
          notificationType: NOTIFICATION_TYPES.PROJECT_CONNECTION_ACCEPTED,
          recipientEmail: senderEmail,
          status: 'Pending',
        })
      }
      const [updated] = await tx
        .select()
        .from(projectConnectionRequests)
        .where(eq(projectConnectionRequests.id, requestId))
        .limit(1)
      return updated
    })
    if (accepted === 'CANCELLED') {
      throw new ProjectConnectionError('REQUEST_NOT_PENDING', '该申请当前不是待处理状态')
    }
    return this.viewRequest(accepted, viewerId)
  }

  async ignore(viewerId: string, requestId: number) {
    const row = await this.db.transaction(async (tx): Promise<RequestRow> => {
      const [record] = await tx
        .select()
        .from(projectConnectionRequests)
        .where(eq(projectConnectionRequests.id, requestId))
        .for('update')
      if (!record || record.receiverUserId !== viewerId) {
        throw new ProjectConnectionError('REQUEST_NOT_FOUND', '建联申请不存在')
      }
      if (record.status === ConnectionRequestStatus.Ignored) return record
      if (record.status !== ConnectionRequestStatus.Pending) {
        throw new ProjectConnectionError('REQUEST_NOT_PENDING', '该申请当前不是待处理状态')
      }
      await tx
        .update(projectConnectionRequests)
        .set({ status: ConnectionRequestStatus.Ignored, pairKey: null, handledAt: new Date() })
        .where(
          and(
            eq(projectConnectionRequests.id, requestId),
            eq(projectConnectionRequests.status, ConnectionRequestStatus.Pending),
          ),
        )
      const [updated] = await tx
        .select()
        .from(projectConnectionRequests)
        .where(eq(projectConnectionRequests.id, requestId))
        .limit(1)
      return updated
    })
    return this.viewRequest(row, viewerId)
  }

  async contacts(viewerId: string, requestId: number) {
    const [row] = await this.db
      .select()
      .from(projectConnectionRequests)
      .where(eq(projectConnectionRequests.id, requestId))
      .limit(1)
    if (!row || row.status !== ConnectionRequestStatus.Accepted || ![row.senderUserId, row.receiverUserId].includes(viewerId)) {
      throw new ProjectConnectionError('CONTACTS_FORBIDDEN', '只有已接受的建联申请才能查看联系方式')
    }
    return this.contactsFor(row, viewerId)
  }

  // Delisting a project ends its Pending requests, mirroring hackathon hiding.
  // Accepted connections are preserved.
  async cancelPendingByProject(projectId: number) {
    await this.db
      .update(projectConnectionRequests)
      .set({ status: ConnectionRequestStatus.Cancelled, pairKey: null, handledAt: new Date() })
      .where(
        and(
          eq(projectConnectionRequests.projectId, projectId),
          eq(projectConnectionRequests.status, ConnectionRequestStatus.Pending),
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
      projectId: row.projectId,
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

  private async viewRequest(row: RequestRow, viewerId: string) {
    const [sender, receiver, projectRows] = await Promise.all([
      this.participantDto(row.senderUserId),
      this.participantDto(row.receiverUserId),
      this.db
        .select({ id: projects.id, name: projects.name, status: projects.status })
        .from(projects)
        .where(eq(projects.id, row.projectId))
        .limit(1),
    ])
    const project = projectRows[0]
    const available = project?.status === ProjectStatus.Live
    const contacts =
      row.status === ConnectionRequestStatus.Accepted && [row.senderUserId, row.receiverUserId].includes(viewerId)
        ? this.contactsFor(row, viewerId)
        : undefined
    return {
      id: row.id,
      source: 'project' as const,
      status: row.status,
      senderUserId: row.senderUserId,
      receiverUserId: row.receiverUserId,
      sender,
      receiver,
      target: {
        type: 'project' as const,
        projectId: row.projectId,
        name: project?.name,
        url: available && this.base ? `${this.base}/projects/${row.projectId}` : undefined,
        ...(available ? {} : { unavailable: true }),
      },
      purpose: row.purpose,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      acceptedAt: iso(row.acceptedAt),
      handledAt: iso(row.handledAt),
      ...(contacts ? { contacts } : {}),
    }
  }

  async listForUser(viewerId: string) {
    const rows = await this.db
      .select()
      .from(projectConnectionRequests)
      .where(
        or(
          eq(projectConnectionRequests.senderUserId, viewerId),
          eq(projectConnectionRequests.receiverUserId, viewerId),
        ),
      )
      .orderBy(desc(projectConnectionRequests.id))
    return {
      data: await Promise.all(rows.map((row) => this.viewRequest(row, viewerId))),
      pendingReceived: rows.filter(
        (row) => row.receiverUserId === viewerId && row.status === ConnectionRequestStatus.Pending,
      ).length,
    }
  }
}

export type ProjectConnectionListItem = Awaited<ReturnType<ProjectConnectionService['listForUser']>>['data'][number]
