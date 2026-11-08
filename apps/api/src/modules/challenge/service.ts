import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import {
  CHALLENGE_CAPACITY_LIMITS,
  CHALLENGE_RESOURCE_KINDS,
  CHALLENGE_RESOURCE_STATUSES,
  CHALLENGE_TYPES,
  ChallengeResourceStatus,
  ChallengeStatus,
  ChallengeType,
  MAX_CHALLENGE_RESOURCES,
} from '@shenicest/shared'
import type { Database } from '../../db'
import { challengeResources, challenges, seasons } from '../../db/schema'
import {
  BoomlandAccessService,
  boomlandError,
  iso,
  isPublicSeason,
  writeAudit,
} from '../boomland-shared'
import type {
  CreateChallengeBody,
  PatchChallengeResourceBody,
  ReplaceChallengeResourcesBody,
  UpdateChallengeBody,
} from './model'

type ChallengeRow = typeof challenges.$inferSelect
type SeasonRow = typeof seasons.$inferSelect
type ResourceRow = typeof challengeResources.$inferSelect
type ResourceInsert = typeof challengeResources.$inferInsert

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

/** 已关闭 / 已归档的命题是历史记录，资源清单也不能再改（与命题编辑同一把锁）。 */
const LOCKED_STATUSES: readonly string[] = [ChallengeStatus.Closed, ChallengeStatus.Archived]

const CHALLENGE_TYPE_VALUES: readonly string[] = CHALLENGE_TYPES
const RESOURCE_KIND_VALUES: readonly string[] = CHALLENGE_RESOURCE_KINDS
const RESOURCE_STATUS_VALUES: readonly string[] = CHALLENGE_RESOURCE_STATUSES

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * 五件套的缺口。返回中文名，因为发布按钮直接拿它拼提示文案
 * （「还缺：真实问题、目标客户」），前端不需要再维护一份字段名映射。
 */
function missingFivePiece(row: ChallengeRow): string[] {
  return CONTENT_FIELDS.filter((field) => !isNonEmpty(row[field])).map((field) => FIELD_LABELS[field])
}

function resourceDto(row: ResourceRow) {
  return {
    id: row.id,
    challengeId: row.challengeId,
    kind: row.kind,
    title: row.title,
    quantity: row.quantity,
    conditions: row.conditions,
    owner: row.owner,
    status: row.status,
    sortOrder: row.sortOrder,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
  }
}

/**
 * 命题 DTO。
 *
 * `resources` 由调用方传入而不是在 dto 里查库：列表页要一次性把 N 个命题的
 * 资源都取回来（一次 `inArray`），逐条查会退化成 N+1。
 */
function dto(row: ChallengeRow, resources: ResourceRow[]) {
  const missingFields = missingFivePiece(row)
  return {
    id: row.id,
    seasonId: row.seasonId,
    title: row.title,
    type: row.type,
    theme: row.theme,
    enterpriseName: row.enterpriseName,
    capacity: row.capacity,
    // 项目选择命题（CHG-003）未实现，所以「已选」恒为 0。
    // 保留这个字段而不是让前端自己写 0：容量列的分母来自后端，分子也该来自后端，
    // 等 CHG-003 落地时前端不用改。
    selectedCount: 0,
    fivePieceComplete: missingFields.length === 0,
    missingFields,
    resources: resources.map(resourceDto),
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

  /** 一个命题的资源，按展示顺序取。单条读路径用它。 */
  private async resourcesOf(challengeId: number): Promise<ResourceRow[]> {
    return this.db
      .select()
      .from(challengeResources)
      .where(eq(challengeResources.challengeId, challengeId))
      .orderBy(asc(challengeResources.sortOrder), asc(challengeResources.id))
  }

  /** 多个命题的资源，一次查完再按 challengeId 分组 —— 列表页不允许 N+1。 */
  private async resourcesOfMany(challengeIds: number[]): Promise<Map<number, ResourceRow[]>> {
    const grouped = new Map<number, ResourceRow[]>()
    if (challengeIds.length === 0) return grouped
    const rows = await this.db
      .select()
      .from(challengeResources)
      .where(inArray(challengeResources.challengeId, challengeIds))
      .orderBy(asc(challengeResources.challengeId), asc(challengeResources.sortOrder), asc(challengeResources.id))
    for (const row of rows) {
      const bucket = grouped.get(row.challengeId)
      if (bucket) bucket.push(row)
      else grouped.set(row.challengeId, [row])
    }
    return grouped
  }

  private assertNotFrozen(season: SeasonRow) {
    if (season.challengeFreezeAt && Date.now() >= season.challengeFreezeAt.getTime()) {
      throw boomlandError('CHALLENGE_FROZEN', '命题已冻结，不能新增或下线命题，只能生成新版本', 409, {
        detail: { challengeFreezeAt: season.challengeFreezeAt.toISOString() },
      })
    }
  }

  /**
   * 分类字段的归一化与校验。
   *
   * `undefined` 表示「这次请求没提这个字段」（PATCH 的语义），原样返回 undefined；
   * 显式 `null` / 空串表示「清空」。两种情况必须区分，所以不能用 `??`。
   */
  private normalizeType(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    if (!CHALLENGE_TYPE_VALUES.includes(trimmed)) {
      throw boomlandError('VALIDATION_ERROR', `未知的命题类型：${trimmed}`, 400, { field: 'type' })
    }
    return trimmed as ChallengeType
  }

  private normalizeTheme(value: string | null | undefined, season: SeasonRow): string | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    // 主题必须取自本季 `seasons.themes`：命题挂在赛季下，主题是赛季对外的方向列表，
    // 允许自由文本会让公开页出现赛季主题之外的标签。
    if (!season.themes.includes(trimmed)) {
      throw boomlandError('VALIDATION_ERROR', `赛季主题「${trimmed}」不存在`, 400, { field: 'theme' })
    }
    return trimmed
  }

  private normalizeEnterpriseName(value: string | null | undefined): string | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.length > 255) {
      throw boomlandError('VALIDATION_ERROR', '企业名称不能超过 255 个字符', 400, { field: 'enterpriseName' })
    }
    return trimmed
  }

  private normalizeCapacity(value: number | null | undefined): number | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    if (
      !Number.isInteger(value)
      || value < CHALLENGE_CAPACITY_LIMITS.min
      || value > CHALLENGE_CAPACITY_LIMITS.max
    ) {
      throw boomlandError(
        'VALIDATION_ERROR',
        `命题容量必须是 ${CHALLENGE_CAPACITY_LIMITS.min}–${CHALLENGE_CAPACITY_LIMITS.max} 的整数或留空（不限）`,
        400,
        { field: 'capacity' },
      )
    }
    return value
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
    const resources = await this.resourcesOfMany(rows.map((row) => row.id))
    return { items: rows.map((row) => dto(row, resources.get(row.id) ?? [])) }
  }

  async detail(challengeId: number, userId: string | null) {
    const row = await this.getRow(challengeId)
    if (row.status !== ChallengeStatus.Published && row.status !== ChallengeStatus.Closed) {
      await this.access.assertSeasonAccess(row.seasonId, userId ?? '')
    }
    return dto(row, await this.resourcesOf(challengeId))
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
      type: this.normalizeType(body.type) ?? null,
      theme: this.normalizeTheme(body.theme, season) ?? null,
      enterpriseName: this.normalizeEnterpriseName(body.enterpriseName) ?? null,
      capacity: this.normalizeCapacity(body.capacity) ?? null,
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
    return dto(row, [])
  }

  async update(challengeId: number, userId: string, body: UpdateChallengeBody) {
    const row = await this.getRow(challengeId)
    await this.access.assertSeasonAccess(row.seasonId, userId)
    if (LOCKED_STATUSES.includes(row.status)) {
      throw boomlandError('CHALLENGE_STATUS_LOCKED', '已关闭或归档的命题不可编辑', 409)
    }
    // 主题校验要拿赛季的 themes，所以只有请求里带了 theme 才多读一次赛季行。
    const season = body.theme !== undefined ? await this.getSeason(row.seasonId) : null
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
    if (body.type !== undefined) updates.type = this.normalizeType(body.type) ?? null
    if (season) updates.theme = this.normalizeTheme(body.theme, season) ?? null
    if (body.enterpriseName !== undefined) {
      updates.enterpriseName = this.normalizeEnterpriseName(body.enterpriseName) ?? null
    }
    if (body.capacity !== undefined) updates.capacity = this.normalizeCapacity(body.capacity) ?? null
    if (Object.keys(updates).length === 0) return dto(row, await this.resourcesOf(challengeId))
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
    return dto(updated, await this.resourcesOf(challengeId))
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
    return dto(updated, await this.resourcesOf(challengeId))
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
    return dto(updated, await this.resourcesOf(challengeId))
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

  /** 资源清单的可写性：权限 + 命题状态锁，写前统一走这里。 */
  private async assertResourceWritable(challengeId: number, userId: string): Promise<ChallengeRow> {
    const row = await this.getRow(challengeId)
    await this.access.assertSeasonAccess(row.seasonId, userId)
    if (LOCKED_STATUSES.includes(row.status)) {
      throw boomlandError('CHALLENGE_STATUS_LOCKED', '已关闭或归档的命题不可修改资源清单', 409)
    }
    return row
  }

  private normalizeResourceKind(value: string): string {
    const trimmed = value.trim()
    if (!RESOURCE_KIND_VALUES.includes(trimmed)) {
      throw boomlandError('VALIDATION_ERROR', `未知的资源类别：${trimmed}`, 400, { field: 'kind' })
    }
    return trimmed
  }

  private normalizeResourceStatus(value: string | null | undefined): string {
    if (value === null || value === undefined) return ChallengeResourceStatus.Committed
    const trimmed = value.trim()
    if (!RESOURCE_STATUS_VALUES.includes(trimmed)) {
      throw boomlandError('VALIDATION_ERROR', `未知的资源状态：${trimmed}`, 400, { field: 'status' })
    }
    return trimmed
  }

  private normalizeResourceTitle(value: string): string {
    const trimmed = value.trim()
    if (trimmed.length < 1) {
      throw boomlandError('VALIDATION_ERROR', '资源名称不能为空', 400, { field: 'title' })
    }
    if (trimmed.length > 255) {
      throw boomlandError('VALIDATION_ERROR', '资源名称不能超过 255 个字符', 400, { field: 'title' })
    }
    return trimmed
  }

  /**
   * 整表替换资源清单（语义与规则卡一致）。
   *
   * 整表替换而不是逐条 diff：清单的顺序就是主办方拖出来的展示顺序，
   * 客户端一次性提交完整数组，`sortOrder` 直接取下标，避免中间态排序冲突。
   */
  async replaceResources(challengeId: number, userId: string, body: ReplaceChallengeResourcesBody) {
    const row = await this.assertResourceWritable(challengeId, userId)
    if (body.items.length > MAX_CHALLENGE_RESOURCES) {
      throw boomlandError(
        'VALIDATION_ERROR',
        `单个命题最多 ${MAX_CHALLENGE_RESOURCES} 条资源`,
        400,
        { field: 'items', detail: { max: MAX_CHALLENGE_RESOURCES, received: body.items.length } },
      )
    }
    const items: ResourceInsert[] = body.items.map((item, index) => ({
      challengeId,
      kind: this.normalizeResourceKind(item.kind),
      title: this.normalizeResourceTitle(item.title),
      quantity: item.quantity?.trim() || null,
      conditions: item.conditions ?? null,
      owner: item.owner?.trim() || null,
      status: this.normalizeResourceStatus(item.status),
      sortOrder: index,
    }))
    await this.db.transaction(async (tx) => {
      await tx.delete(challengeResources).where(eq(challengeResources.challengeId, challengeId))
      if (items.length > 0) await tx.insert(challengeResources).values(items)
    })
    await writeAudit(this.db, {
      seasonId: row.seasonId,
      actorUserId: userId,
      action: 'challenge.resources_updated',
      targetType: 'challenge',
      targetId: String(challengeId),
      detail: { count: items.length, kinds: items.map((item) => item.kind) },
    })
    return { items: (await this.resourcesOf(challengeId)).map(resourceDto) }
  }

  async patchResource(resourceId: number, userId: string, body: PatchChallengeResourceBody) {
    const rows = await this.db
      .select()
      .from(challengeResources)
      .where(eq(challengeResources.id, resourceId))
      .limit(1)
    const resource = rows[0]
    if (!resource) throw boomlandError('CHALLENGE_RESOURCE_NOT_FOUND', '资源不存在', 404)
    const row = await this.assertResourceWritable(resource.challengeId, userId)
    const updates: Partial<typeof challengeResources.$inferInsert> = {}
    if (body.kind !== undefined) updates.kind = this.normalizeResourceKind(body.kind)
    if (body.title !== undefined) updates.title = this.normalizeResourceTitle(body.title)
    if (body.quantity !== undefined) updates.quantity = body.quantity?.trim() || null
    if (body.conditions !== undefined) updates.conditions = body.conditions || null
    if (body.owner !== undefined) updates.owner = body.owner?.trim() || null
    if (body.status !== undefined) updates.status = this.normalizeResourceStatus(body.status)
    if (Object.keys(updates).length > 0) {
      await this.db.update(challengeResources).set(updates).where(eq(challengeResources.id, resourceId))
      await writeAudit(this.db, {
        seasonId: row.seasonId,
        actorUserId: userId,
        action: 'challenge.resource_updated',
        targetType: 'challenge_resource',
        targetId: String(resourceId),
        detail: {
          challengeId: resource.challengeId,
          fields: Object.keys(updates),
          ...(body.status !== undefined ? { from: resource.status, to: updates.status } : {}),
        },
      })
    }
    const updated = await this.db
      .select()
      .from(challengeResources)
      .where(eq(challengeResources.id, resourceId))
      .limit(1)
    return resourceDto(updated[0]!)
  }
}
