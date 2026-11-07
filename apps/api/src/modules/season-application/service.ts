import { and, asc, count, desc, eq, like, or } from 'drizzle-orm'
import {
  ApplicationVisibility,
  SeasonApplicationStatus,
  SeasonParticipantStatus,
  SeasonStatus,
  WechatStatus,
} from '@shenicest/shared'
import type { Database } from '../../db'
import { seasonApplications, seasonParticipants, seasons } from '../../db/schema'
import { decryptBoomlandContact, encryptBoomlandContact } from '../../lib/boomland-contact-encryption'
import { UserProfileService } from '../user/service'
import {
  BoomlandAccessService,
  boomlandError,
  getSeasonSummaryById,
  iso,
  isApplicationWindowOpen,
  maskContact,
  normalizeContact,
  writeAudit,
  type ContactInput,
} from '../boomland-shared'
import type { CreateApplicationBody, UpdateApplicationStatusBody } from './model'

type ApplicationRow = typeof seasonApplications.$inferSelect
type ParticipantRow = typeof seasonParticipants.$inferSelect
type SeasonRow = typeof seasons.$inferSelect

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 100

const WECHAT_TRANSITIONS: Record<string, string[]> = {
  [WechatStatus.NotInvited]: [WechatStatus.Invited],
  [WechatStatus.Invited]: [WechatStatus.Joined, WechatStatus.Failed],
  [WechatStatus.Failed]: [WechatStatus.Invited],
  [WechatStatus.Joined]: [],
}

function pageOf(query: { page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.max(1, Math.min(query.pageSize ?? PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

function decrypt(row: ApplicationRow): { wechat?: string; phone?: string } | null {
  try {
    return decryptBoomlandContact(row.contactEncrypted)
  } catch {
    return null
  }
}

function applicationDto(row: ApplicationRow) {
  return {
    id: row.id,
    seasonId: row.seasonId,
    userId: row.userId,
    skills: row.skills,
    experience: row.experience,
    themes: row.themes ?? [],
    teamIntent: row.teamIntent,
    acceptsSolo: row.acceptsSolo,
    availability: row.availability,
    cityMode: row.cityMode,
    visibility: row.visibility,
    agreementVersion: row.agreementVersion,
    status: row.status,
    reviewedBy: row.reviewedBy,
    reviewReason: row.reviewReason,
    reviewedAt: iso(row.reviewedAt),
    withdrawnAt: iso(row.withdrawnAt),
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
  }
}

export class SeasonApplicationService {
  private access: BoomlandAccessService
  private users: UserProfileService

  constructor(private db: Database) {
    this.access = new BoomlandAccessService(db)
    this.users = new UserProfileService(db)
  }

  private async getSeason(seasonId: number): Promise<SeasonRow> {
    const rows = await this.db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1)
    if (!rows[0]) throw boomlandError('SEASON_NOT_FOUND', '赛季不存在', 404)
    return rows[0]
  }

  private async getRow(applicationId: number): Promise<ApplicationRow> {
    const rows = await this.db
      .select()
      .from(seasonApplications)
      .where(eq(seasonApplications.id, applicationId))
      .limit(1)
    if (!rows[0]) throw boomlandError('APPLICATION_NOT_FOUND', '报名不存在', 404)
    return rows[0]
  }

  private async applicant(userId: string) {
    const profile = await this.users.getPublicProfile(userId)
    return {
      userId,
      name: profile?.nickname ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
    }
  }

  private async participantDto(row: ParticipantRow) {
    return {
      id: row.id,
      seasonId: row.seasonId,
      userId: row.userId,
      applicationId: row.applicationId,
      wechatStatus: row.wechatStatus,
      wechatInvitedBy: row.wechatInvitedBy,
      wechatInvitedAt: iso(row.wechatInvitedAt),
      joinedAt: iso(row.joinedAt),
      status: row.status,
      withdrawnAt: iso(row.withdrawnAt),
      withdrawnBy: row.withdrawnBy,
      withdrawReason: row.withdrawReason,
      applicant: await this.applicant(row.userId),
      createdAt: iso(row.createdAt)!,
      updatedAt: iso(row.updatedAt)!,
    }
  }

  private async manageDto(row: ApplicationRow) {
    return {
      ...applicationDto(row),
      contact: decrypt(row),
      applicant: await this.applicant(row.userId),
    }
  }

  async create(seasonId: number, userId: string, body: CreateApplicationBody) {
    const season = await this.getSeason(seasonId)
    if (season.status === SeasonStatus.Suspended) {
      throw boomlandError('SEASON_SUSPENDED', '赛季已暂停，暂不能报名', 409)
    }
    if (season.status === SeasonStatus.Cancelled) {
      throw boomlandError('SEASON_CANCELLED', '赛季已取消', 409)
    }
    if (!isApplicationWindowOpen(season)) {
      throw boomlandError('APPLICATION_WINDOW_CLOSED', '当前不在报名窗口内', 409)
    }
    const existingRows = await this.db
      .select()
      .from(seasonApplications)
      .where(and(eq(seasonApplications.seasonId, seasonId), eq(seasonApplications.userId, userId)))
      .limit(1)
    const existing = existingRows[0]
    if (existing && existing.status !== SeasonApplicationStatus.Withdrawn) {
      throw boomlandError('APPLICATION_DUPLICATED', '你已报名该赛季', 409)
    }
    const participant = await this.db
      .select({ id: seasonParticipants.id })
      .from(seasonParticipants)
      .where(and(eq(seasonParticipants.seasonId, seasonId), eq(seasonParticipants.userId, userId)))
      .limit(1)
    if (participant.length > 0) {
      throw boomlandError('ALREADY_PARTICIPANT', '你已是该赛季选手', 409)
    }
    if (body.agreementVersion !== season.agreementVersion) {
      throw boomlandError('AGREEMENT_VERSION_MISMATCH', '协议版本已更新，请刷新后重新提交', 409, {
        field: 'agreementVersion',
        detail: { expected: season.agreementVersion },
      })
    }
    const seasonThemes = new Set(season.themes ?? [])
    const themes = [...new Set(body.themes.map((theme) => theme.trim()).filter(Boolean))]
    if (themes.some((theme) => !seasonThemes.has(theme))) {
      throw boomlandError('APPLICATION_THEME_INVALID', '报名方向必须在赛季主题范围内', 400, {
        field: 'themes',
      })
    }
    const contact = normalizeContact(body.contact as ContactInput)
    const values = {
      seasonId,
      userId,
      skills: body.skills.trim(),
      experience: body.experience.trim(),
      themes,
      teamIntent: body.teamIntent.trim(),
      acceptsSolo: body.acceptsSolo,
      availability: body.availability.trim(),
      cityMode: body.cityMode.trim(),
      contactEncrypted: encryptBoomlandContact(contact),
      visibility: body.visibility ?? ApplicationVisibility.OrganizerOnly,
      agreementVersion: body.agreementVersion,
      status: SeasonApplicationStatus.Submitted,
    }
    let applicationId: number
    if (existing) {
      await this.db
        .update(seasonApplications)
        .set({
          ...values,
          reviewedBy: null,
          reviewedAt: null,
          reviewReason: null,
          withdrawnAt: null,
        })
        .where(eq(seasonApplications.id, existing.id))
      applicationId = existing.id
    } else {
      const [result] = await this.db.insert(seasonApplications).values(values)
      applicationId = result.insertId
    }
    await writeAudit(this.db, {
      seasonId,
      actorUserId: userId,
      action: 'application.submitted',
      targetType: 'season_application',
      targetId: String(applicationId),
      detail: {
        visibility: body.visibility ?? ApplicationVisibility.OrganizerOnly,
        reapplied: Boolean(existing),
      },
    })
    const row = await this.getRow(applicationId)
    return {
      ...applicationDto(row),
      contact,
    }
  }

  async withdraw(applicationId: number, userId: string) {
    const row = await this.getRow(applicationId)
    if (row.userId !== userId) {
      throw boomlandError('FORBIDDEN', '只能撤回自己的报名', 403)
    }
    if (row.status !== SeasonApplicationStatus.Submitted) {
      throw boomlandError('APPLICATION_WITHDRAW_LOCKED', '报名已进入审核流程，不能撤回', 409, {
        detail: { status: row.status },
      })
    }
    await this.db
      .update(seasonApplications)
      .set({
        status: SeasonApplicationStatus.Withdrawn,
        withdrawnAt: new Date(),
      })
      .where(eq(seasonApplications.id, applicationId))
    await writeAudit(this.db, {
      seasonId: row.seasonId,
      actorUserId: userId,
      action: 'application.withdrawn',
      targetType: 'season_application',
      targetId: String(applicationId),
    })
    const updated = await this.getRow(applicationId)
    return {
      ...applicationDto(updated),
      contact: decrypt(updated),
    }
  }

  async listMine(userId: string, query: { seasonId?: number; page?: number; pageSize?: number }) {
    const { page, pageSize, offset } = pageOf(query)
    const where = query.seasonId
      ? and(eq(seasonApplications.userId, userId), eq(seasonApplications.seasonId, query.seasonId))
      : eq(seasonApplications.userId, userId)
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(seasonApplications)
        .where(where)
        .orderBy(desc(seasonApplications.createdAt), desc(seasonApplications.id))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(seasonApplications).where(where),
    ])
    const items = await Promise.all(rows.map(async (row) => {
      const summary = await getSeasonSummaryById(this.db, row.seasonId)
      const participantRows = await this.db
        .select({ wechatStatus: seasonParticipants.wechatStatus })
        .from(seasonParticipants)
        .where(
          and(
            eq(seasonParticipants.seasonId, row.seasonId),
            eq(seasonParticipants.userId, userId),
          ),
        )
        .limit(1)
      return {
        application: {
          ...applicationDto(row),
          contact: decrypt(row),
        },
        season: summary!,
        wechatStatus: participantRows[0]?.wechatStatus ?? null,
      }
    }))
    return {
      items,
      page,
      pageSize,
      total: totals[0]?.value ?? 0,
    }
  }

  async detail(applicationId: number, userId: string) {
    const row = await this.getRow(applicationId)
    const isOwner = row.userId === userId
    const canManage = !isOwner && (await this.access.isSeasonOrganizer(row.seasonId, userId))
    if (!isOwner && !canManage) {
      throw boomlandError('FORBIDDEN', '无权查看该报名', 403)
    }
    const base = {
      ...applicationDto(row),
      contact: decrypt(row),
    }
    if (!canManage) return base
    return { ...base, applicant: await this.applicant(row.userId) }
  }

  async listSeasonApplications(
    seasonId: number,
    userId: string,
    query: { status?: string; visibility?: string; q?: string; page?: number; pageSize?: number },
  ) {
    await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const { page, pageSize, offset } = pageOf(query)
    const conditions = [eq(seasonApplications.seasonId, seasonId)]
    if (query.status) conditions.push(eq(seasonApplications.status, query.status))
    if (query.visibility) conditions.push(eq(seasonApplications.visibility, query.visibility))
    if (query.q?.trim()) {
      const pattern = `%${query.q.trim()}%`
      conditions.push(
        or(
          like(seasonApplications.skills, pattern),
          like(seasonApplications.experience, pattern),
        )!,
      )
    }
    const where = and(...conditions)
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(seasonApplications)
        .where(where)
        .orderBy(desc(seasonApplications.createdAt), desc(seasonApplications.id))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(seasonApplications).where(where),
    ])
    const items = await Promise.all(rows.map(async (row) => {
      const contact = decrypt(row)
      return {
        ...applicationDto(row),
        contactMasked: contact ? maskContact(contact) : null,
        applicant: await this.applicant(row.userId),
      }
    }))
    return { items, page, pageSize, total: totals[0]?.value ?? 0 }
  }

  async updateStatus(applicationId: number, userId: string, body: UpdateApplicationStatusBody) {
    const row = await this.getRow(applicationId)
    await this.access.assertSeasonAccess(row.seasonId, userId)
    const target = body.status
    if (row.status === SeasonApplicationStatus.Withdrawn) {
      throw boomlandError('APPLICATION_WITHDRAW_LOCKED', '已撤回的报名需由本人重新报名', 409)
    }
    if (row.status === SeasonApplicationStatus.Accepted) {
      if (target !== SeasonApplicationStatus.Accepted) {
        throw boomlandError('APPLICATION_STATUS_LOCKED', '已录取的报名不可再变更状态', 409)
      }
      return this.manageDto(row)
    }
    const reason = body.reason?.trim()
    if (target === SeasonApplicationStatus.Rejected && (!reason || reason.length < 2)) {
      throw boomlandError('VALIDATION_ERROR', '拒绝报名时必须填写原因', 400, { field: 'reason' })
    }
    const season = await this.getSeason(row.seasonId)
    let effectiveTarget: string = target
    if (target === SeasonApplicationStatus.Accepted && season.participantCapacity !== null) {
      const activeRows = await this.db
        .select({ value: count() })
        .from(seasonParticipants)
        .where(
          and(
            eq(seasonParticipants.seasonId, row.seasonId),
            eq(seasonParticipants.status, SeasonParticipantStatus.Active),
          ),
        )
      const activeCount = activeRows[0]?.value ?? 0
      if (activeCount >= season.participantCapacity) {
        const now = new Date()
        if (season.teamDeadline && now <= season.teamDeadline) {
          effectiveTarget = SeasonApplicationStatus.Waitlisted
        } else {
          throw boomlandError('CAPACITY_FULL', '赛季选手名额已满', 409, {
            detail: { capacity: season.participantCapacity },
          })
        }
      }
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(seasonApplications)
        .set({
          status: effectiveTarget,
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewReason: reason ?? null,
        })
        .where(eq(seasonApplications.id, applicationId))
      if (effectiveTarget === SeasonApplicationStatus.Accepted) {
        const existingRows = await tx
          .select()
          .from(seasonParticipants)
          .where(
            and(
              eq(seasonParticipants.seasonId, row.seasonId),
              eq(seasonParticipants.userId, row.userId),
            ),
          )
          .limit(1)
        if (existingRows[0]) {
          await tx
            .update(seasonParticipants)
            .set({ applicationId: row.id })
            .where(eq(seasonParticipants.id, existingRows[0].id))
        } else {
          await tx.insert(seasonParticipants).values({
            seasonId: row.seasonId,
            userId: row.userId,
            applicationId: row.id,
            wechatStatus: WechatStatus.NotInvited,
            status: SeasonParticipantStatus.Active,
          })
        }
      }
      await writeAudit(tx, {
        seasonId: row.seasonId,
        actorUserId: userId,
        action: 'application.status_changed',
        targetType: 'season_application',
        targetId: String(applicationId),
        detail: {
          from: row.status,
          to: effectiveTarget,
          requested: target,
          reason: reason ?? null,
        },
      })
    })
    return this.manageDto(await this.getRow(applicationId))
  }

  async listParticipants(
    seasonId: number,
    userId: string,
    query: { status?: string; wechatStatus?: string; q?: string; page?: number; pageSize?: number },
  ) {
    await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const { page, pageSize, offset } = pageOf(query)
    const conditions = [eq(seasonParticipants.seasonId, seasonId)]
    if (query.status) conditions.push(eq(seasonParticipants.status, query.status))
    if (query.wechatStatus) conditions.push(eq(seasonParticipants.wechatStatus, query.wechatStatus))
    if (query.q?.trim()) {
      conditions.push(like(seasonParticipants.userId, `%${query.q.trim()}%`))
    }
    const where = and(...conditions)
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(seasonParticipants)
        .where(where)
        .orderBy(desc(seasonParticipants.createdAt), desc(seasonParticipants.id))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(seasonParticipants).where(where),
    ])
    return {
      items: await Promise.all(rows.map((row) => this.participantDto(row))),
      page,
      pageSize,
      total: totals[0]?.value ?? 0,
    }
  }

  async updateWechat(
    seasonId: number,
    targetUserId: string,
    userId: string,
    status: string,
  ) {
    await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const rows = await this.db
      .select()
      .from(seasonParticipants)
      .where(
        and(
          eq(seasonParticipants.seasonId, seasonId),
          eq(seasonParticipants.userId, targetUserId),
        ),
      )
      .limit(1)
    const row = rows[0]
    if (!row) throw boomlandError('PARTICIPANT_NOT_FOUND', '选手不存在', 404)
    if (row.status !== SeasonParticipantStatus.Active) {
      throw boomlandError('PARTICIPANT_WITHDRAW_LOCKED', '选手已退出赛季', 409)
    }
    if (row.wechatStatus === status) return this.participantDto(row)
    const allowed = WECHAT_TRANSITIONS[row.wechatStatus] ?? []
    if (!allowed.includes(status)) {
      throw boomlandError('WECHAT_STATUS_INVALID', '微信状态跳转不合法', 409, {
        detail: { from: row.wechatStatus, to: status },
      })
    }
    const updates: Partial<typeof seasonParticipants.$inferInsert> = { wechatStatus: status }
    if (status === WechatStatus.Invited) {
      updates.wechatInvitedBy = userId
      updates.wechatInvitedAt = new Date()
    }
    if (status === WechatStatus.Joined) {
      updates.joinedAt = new Date()
    }
    await this.db
      .update(seasonParticipants)
      .set(updates)
      .where(eq(seasonParticipants.id, row.id))
    await writeAudit(this.db, {
      seasonId,
      actorUserId: userId,
      action: 'participant.wechat_changed',
      targetType: 'season_participant',
      targetId: String(row.id),
      detail: { from: row.wechatStatus, to: status },
    })
    const updated = await this.db
      .select()
      .from(seasonParticipants)
      .where(eq(seasonParticipants.id, row.id))
      .limit(1)
    return this.participantDto(updated[0]!)
  }

  async withdrawParticipant(
    seasonId: number,
    targetUserId: string,
    actorUserId: string,
    body: { confirm: boolean; reason?: string },
  ) {
    const season = await this.getSeason(seasonId)
    const rows = await this.db
      .select()
      .from(seasonParticipants)
      .where(
        and(
          eq(seasonParticipants.seasonId, seasonId),
          eq(seasonParticipants.userId, targetUserId),
        ),
      )
      .limit(1)
    const row = rows[0]
    if (!row) throw boomlandError('PARTICIPANT_NOT_FOUND', '选手不存在', 404)
    if (row.status === SeasonParticipantStatus.Withdrawn) return this.participantDto(row)

    const canManage = await this.access.isSeasonOrganizer(seasonId, actorUserId)
    const isSelf = targetUserId === actorUserId
    if (!isSelf && !canManage) {
      throw boomlandError('FORBIDDEN', '无权让该选手退出赛季', 403)
    }
    if (isSelf && !canManage) {
      if (!body.confirm) {
        throw boomlandError('VALIDATION_ERROR', '退出赛季需要二次确认', 400, { field: 'confirm' })
      }
      if (season.teamDeadline && Date.now() > season.teamDeadline.getTime()) {
        throw boomlandError('PARTICIPANT_WITHDRAW_LOCKED', '组队截止后请由主办方处理退出', 409, {
          detail: { teamDeadline: iso(season.teamDeadline) },
        })
      }
    }
    const reason = body.reason?.trim() || null
    await this.db.transaction(async (tx) => {
      await tx
        .update(seasonParticipants)
        .set({
          status: SeasonParticipantStatus.Withdrawn,
          withdrawnAt: new Date(),
          withdrawnBy: actorUserId,
          withdrawReason: reason,
        })
        .where(eq(seasonParticipants.id, row.id))
      await writeAudit(tx, {
        seasonId,
        actorUserId,
        action: 'participant.withdrawn',
        targetType: 'season_participant',
        targetId: String(row.id),
        detail: { userId: targetUserId, reason, self: isSelf },
      })

      const capacity = season.participantCapacity
      const promotionOpen = Boolean(
        capacity !== null && season.teamDeadline && Date.now() <= season.teamDeadline.getTime(),
      )
      if (!promotionOpen || capacity === null) return

      const activeRows = await tx
        .select({ value: count() })
        .from(seasonParticipants)
        .where(
          and(
            eq(seasonParticipants.seasonId, seasonId),
            eq(seasonParticipants.status, SeasonParticipantStatus.Active),
          ),
        )
      if ((activeRows[0]?.value ?? 0) >= capacity) return

      const waitlisted = await tx
        .select()
        .from(seasonApplications)
        .where(
          and(
            eq(seasonApplications.seasonId, seasonId),
            eq(seasonApplications.status, SeasonApplicationStatus.Waitlisted),
          ),
        )
        .orderBy(asc(seasonApplications.reviewedAt), asc(seasonApplications.id))
        .limit(1)
      const next = waitlisted[0]
      if (!next) return

      await tx
        .update(seasonApplications)
        .set({
          status: SeasonApplicationStatus.Accepted,
          reviewedBy: actorUserId,
          reviewedAt: new Date(),
          reviewReason: null,
        })
        .where(eq(seasonApplications.id, next.id))
      await tx.insert(seasonParticipants).values({
        seasonId,
        userId: next.userId,
        applicationId: next.id,
        wechatStatus: WechatStatus.NotInvited,
        status: SeasonParticipantStatus.Active,
      })
      await writeAudit(tx, {
        seasonId,
        actorUserId,
        action: 'application.promoted',
        targetType: 'season_application',
        targetId: String(next.id),
        detail: { from: SeasonApplicationStatus.Waitlisted, to: SeasonApplicationStatus.Accepted },
      })
    })
    const updated = await this.db
      .select()
      .from(seasonParticipants)
      .where(eq(seasonParticipants.id, row.id))
      .limit(1)
    return this.participantDto(updated[0]!)
  }
}
