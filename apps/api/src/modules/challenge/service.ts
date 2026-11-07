import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { ChallengeStatus } from '@shenicest/shared'
import type { Database } from '../../db'
import { challenges, seasons } from '../../db/schema'
import {
  BoomlandAccessService,
  boomlandError,
  iso,
  isPublicSeason,
  writeAudit,
} from '../boomland-shared'
import type { CreateChallengeBody, UpdateChallengeBody } from './model'

type ChallengeRow = typeof challenges.$inferSelect
type SeasonRow = typeof seasons.$inferSelect

const PUBLIC_STATUSES = [ChallengeStatus.Published, ChallengeStatus.Closed]
const CONTENT_FIELDS = [
  'realProblem',
  'targetCustomer',
  'minimumDeliverable',
  'resourceCommitment',
  'resultEvidenceRules',
] as const

const FIELD_LABELS: Record<(typeof CONTENT_FIELDS)[number], string> = {
  realProblem: '真实问题',
  targetCustomer: '目标客户',
  minimumDeliverable: '最小交付物',
  resourceCommitment: '资源投入',
  resultEvidenceRules: '结果证据规则',
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function dto(row: ChallengeRow) {
  return {
    id: row.id,
    seasonId: row.seasonId,
    title: row.title,
    realProblem: row.realProblem,
    targetCustomer: row.targetCustomer,
    minimumDeliverable: row.minimumDeliverable,
    resourceCommitment: row.resourceCommitment,
    resultEvidenceRules: row.resultEvidenceRules,
    status: row.status,
    version: row.version,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
  }
}

export class ChallengeService {
  private access: BoomlandAccessService

  constructor(private db: Database) {
    this.access = new BoomlandAccessService(db)
  }

  private async getSeason(seasonId: number): Promise<SeasonRow> {
    const rows = await this.db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1)
    if (!rows[0]) throw boomlandError('SEASON_NOT_FOUND', '赛季不存在', 404)
    return rows[0]
  }

  private async getRow(challengeId: number): Promise<ChallengeRow> {
    const rows = await this.db.select().from(challenges).where(eq(challenges.id, challengeId)).limit(1)
    if (!rows[0]) throw boomlandError('CHALLENGE_NOT_FOUND', '命题不存在', 404)
    return rows[0]
  }

  private assertNotFrozen(season: SeasonRow) {
    if (season.challengeFreezeAt && Date.now() >= season.challengeFreezeAt.getTime()) {
      throw boomlandError('CHALLENGE_FROZEN', '命题已冻结，不能新增或下线命题，只能生成新版本', 409, {
        detail: { challengeFreezeAt: season.challengeFreezeAt.toISOString() },
      })
    }
  }

  async list(seasonId: number, userId: string | null, includeDraftsRaw?: string) {
    const season = await this.getSeason(seasonId)
    const includeDrafts = includeDraftsRaw === 'true' || includeDraftsRaw === '1'
    if (includeDrafts) {
      await this.access.assertSeasonAccess(seasonId, userId ?? '')
    } else if (!isPublicSeason(season) && (!userId || !(await this.access.isSeasonOrganizer(seasonId, userId)))) {
      throw boomlandError('SEASON_NOT_FOUND', '赛季不存在', 404)
    }
    const where = includeDrafts
      ? eq(challenges.seasonId, seasonId)
      : and(eq(challenges.seasonId, seasonId), inArray(challenges.status, PUBLIC_STATUSES))
    const rows = await this.db
      .select()
      .from(challenges)
      .where(where)
      .orderBy(desc(challenges.createdAt), asc(challenges.id))
    return { items: rows.map(dto) }
  }

  async detail(challengeId: number, userId: string | null) {
    const row = await this.getRow(challengeId)
    if (row.status !== ChallengeStatus.Published && row.status !== ChallengeStatus.Closed) {
      await this.access.assertSeasonAccess(row.seasonId, userId ?? '')
    }
    return dto(row)
  }

  async create(seasonId: number, userId: string, body: CreateChallengeBody) {
    const season = await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    this.assertNotFrozen(season)
    const title = body.title.trim()
    if (title.length < 2) {
      throw boomlandError('VALIDATION_ERROR', '命题标题至少 2 个字符', 400, { field: 'title' })
    }
    const [result] = await this.db.insert(challenges).values({
      seasonId,
      title,
      realProblem: body.realProblem ?? null,
      targetCustomer: body.targetCustomer ?? null,
      minimumDeliverable: body.minimumDeliverable ?? null,
      resourceCommitment: body.resourceCommitment ?? null,
      resultEvidenceRules: body.resultEvidenceRules ?? null,
      status: ChallengeStatus.Draft,
      version: 1,
      createdBy: userId,
    })
    const row = await this.getRow(result.insertId)
    await writeAudit(this.db, {
      seasonId,
      actorUserId: userId,
      action: 'challenge.created',
      targetType: 'challenge',
      targetId: String(row.id),
      detail: { title: row.title },
    })
    return dto(row)
  }

  async update(challengeId: number, userId: string, body: UpdateChallengeBody) {
    const row = await this.getRow(challengeId)
    await this.access.assertSeasonAccess(row.seasonId, userId)
    if (row.status === ChallengeStatus.Closed || row.status === ChallengeStatus.Archived) {
      throw boomlandError('CHALLENGE_STATUS_LOCKED', '已关闭或归档的命题不可编辑', 409)
    }
    const updates: Partial<typeof challenges.$inferInsert> = {}
    if (body.title !== undefined) {
      const title = body.title.trim()
      if (title.length < 2) {
        throw boomlandError('VALIDATION_ERROR', '命题标题至少 2 个字符', 400, { field: 'title' })
      }
      updates.title = title
    }
    for (const field of CONTENT_FIELDS) {
      if (body[field] !== undefined) updates[field] = body[field] || null
    }
    if (Object.keys(updates).length === 0) return dto(row)
    if (row.status === ChallengeStatus.Published) {
      updates.version = row.version + 1
    }
    await this.db.update(challenges).set(updates).where(eq(challenges.id, challengeId))
    const updated = await this.getRow(challengeId)
    await writeAudit(this.db, {
      seasonId: row.seasonId,
      actorUserId: userId,
      action: 'challenge.updated',
      targetType: 'challenge',
      targetId: String(challengeId),
      detail: { fields: Object.keys(updates).filter((key) => key !== 'version') },
    })
    return dto(updated)
  }

  private async transition(
    challengeId: number,
    userId: string,
    action: string,
    allowed: string[],
    next: string,
  ) {
    const row = await this.getRow(challengeId)
    await this.access.assertSeasonAccess(row.seasonId, userId)
    if (!allowed.includes(row.status)) {
      throw boomlandError('CHALLENGE_STATUS_LOCKED', '当前命题状态不允许该操作', 409, {
        detail: { from: row.status, allowed },
      })
    }
    await this.db.update(challenges).set({ status: next }).where(eq(challenges.id, challengeId))
    const updated = await this.getRow(challengeId)
    await writeAudit(this.db, {
      seasonId: row.seasonId,
      actorUserId: userId,
      action,
      targetType: 'challenge',
      targetId: String(challengeId),
      detail: { from: row.status, to: next },
    })
    return dto(updated)
  }

  async reference(challengeId: number, userId: string) {
    return this.transition(
      challengeId,
      userId,
      'challenge.referenced',
      [ChallengeStatus.Draft],
      ChallengeStatus.Reference,
    )
  }

  async publish(challengeId: number, userId: string) {
    const row = await this.getRow(challengeId)
    await this.access.assertSeasonAccess(row.seasonId, userId)
    if (row.status !== ChallengeStatus.Draft && row.status !== ChallengeStatus.Reference) {
      throw boomlandError('CHALLENGE_STATUS_LOCKED', '当前命题状态不允许发布', 409, {
        detail: { from: row.status },
      })
    }
    const missing: string[] = []
    if (!isNonEmpty(row.title)) missing.push('title')
    for (const field of CONTENT_FIELDS) {
      if (!isNonEmpty(row[field])) missing.push(FIELD_LABELS[field])
    }
    if (missing.length > 0) {
      throw boomlandError('CHALLENGE_INCOMPLETE', '命题五件套不完整，无法发布', 409, {
        detail: { missing },
      })
    }
    await this.db
      .update(challenges)
      .set({ status: ChallengeStatus.Published })
      .where(eq(challenges.id, challengeId))
    const updated = await this.getRow(challengeId)
    await writeAudit(this.db, {
      seasonId: row.seasonId,
      actorUserId: userId,
      action: 'challenge.published',
      targetType: 'challenge',
      targetId: String(challengeId),
      detail: { from: row.status, to: ChallengeStatus.Published },
    })
    return dto(updated)
  }

  async close(challengeId: number, userId: string) {
    const row = await this.getRow(challengeId)
    this.assertNotFrozen(await this.getSeason(row.seasonId))
    return this.transition(
      challengeId,
      userId,
      'challenge.closed',
      [ChallengeStatus.Published],
      ChallengeStatus.Closed,
    )
  }

  async archive(challengeId: number, userId: string) {
    const row = await this.getRow(challengeId)
    this.assertNotFrozen(await this.getSeason(row.seasonId))
    return this.transition(
      challengeId,
      userId,
      'challenge.archived',
      [ChallengeStatus.Published, ChallengeStatus.Closed],
      ChallengeStatus.Archived,
    )
  }
}
