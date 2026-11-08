import { and, asc, count, desc, eq, inArray, ne } from 'drizzle-orm'
import {
  CHALLENGE_CAPACITY_LIMITS,
  CHALLENGE_CARD_LIMITS,
  CHALLENGE_RESOURCE_KINDS,
  CHALLENGE_RESOURCE_STATUSES,
  CHALLENGE_RIGHTS_FIELDS,
  CHALLENGE_SCORING_DIMENSIONS,
  CHALLENGE_SCORING_WEIGHT_MAX,
  CHALLENGE_SCORING_WEIGHT_TOTAL,
  CHALLENGE_TYPES,
  ChallengeResourceStatus,
  ChallengeStatus,
  ChallengeType,
  MAX_CHALLENGE_RESOURCES,
  SeasonProjectStatus,
  type ChallengeRightsField,
  type ChallengeScoringDimension,
} from '@shenicest/shared'
import type { Database } from '../../db'
import {
  challengeFollows,
  challengeResources,
  challengeVersions,
  challenges,
  projects,
  seasonBudgets,
  seasonPointPools,
  seasonProjects,
  seasons,
} from '../../db/schema'
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
type VersionRow = typeof challengeVersions.$inferSelect
type SeasonProjectRow = typeof seasonProjects.$inferSelect

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

/**
 * 命题详情页新增字段的中文名（自动生成版本说明时用）。
 *
 * 与 `CHALLENGE_RIGHTS_FIELD_LABELS` 分开：那张表是七项权益的**展示**名，
 * 这里是「改动了哪几项」的**摘要**名，两者会随文案调整而分别演进。
 */
const DETAIL_FIELD_LABELS: Record<string, string> = {
  title: '标题',
  type: '命题类型',
  theme: '赛季主题',
  enterpriseName: '出题企业',
  capacity: '命题容量',
  ...FIELD_LABELS,
  summary: '简介',
  background: '背景',
  industry: '目标客户 / 产业对象',
  scope: '范围',
  outOfScope: '不做什么',
  monthlyGoal: '一个月最小成果',
  suggestedSkills: '建议技能',
  teamCapacity: '团队容量',
  ownerName: '负责人',
  responseSla: '响应时限',
  scoringWeights: '五维权重',
  singleWorkCap: '单次评分上限',
  rightsPublicScope: '公开范围',
  rightsConfidentiality: '保密',
  rightsIp: '知识产权',
  rightsEnterpriseUsage: '企业使用权',
  rightsProcurement: '采购或后续合作',
  rightsSpecialTerms: '特殊条件',
  rightsExclusivity: '独家或排他',
}

/** 已关闭 / 已归档的命题是历史记录，资源清单也不能再改（与命题编辑同一把锁）。 */
const LOCKED_STATUSES: readonly string[] = [ChallengeStatus.Closed, ChallengeStatus.Archived]

const CHALLENGE_TYPE_VALUES: readonly string[] = CHALLENGE_TYPES
const RESOURCE_KIND_VALUES: readonly string[] = CHALLENGE_RESOURCE_KINDS
const RESOURCE_STATUS_VALUES: readonly string[] = CHALLENGE_RESOURCE_STATUSES
const SCORING_DIMENSION_VALUES: readonly string[] = CHALLENGE_SCORING_DIMENSIONS

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

function versionDto(row: VersionRow) {
  return {
    id: row.id,
    version: row.version,
    note: row.note,
    changedBy: row.changedBy,
    createdAt: iso(row.createdAt)!,
  }
}

/** 「选择本命题的项目」一行（契约 §3.1）。`ownerName` 直接取 `ownerUserId`（无姓名列）。 */
export type ChallengeProjectDto = {
  seasonProjectId: number
  projectId: number
  name: string
  tagline: string | null
  stage: string
  ownerName: string
}

/**
 * 命题 DTO。
 *
 * `resources` / `versions` / `projects` 由调用方传入而不是在 dto 里查库：
 * 列表页要一次性把 N 个命题的子数据都取回来（一次 `inArray`），逐条查会退化成 N+1。
 */
function dto(
  row: ChallengeRow,
  resources: ResourceRow[],
  versions: VersionRow[],
  projectsOfChallenge: ChallengeProjectDto[],
) {
  const missingFields = missingFivePiece(row)
  return {
    id: row.id,
    seasonId: row.seasonId,
    title: row.title,
    type: row.type,
    theme: row.theme,
    enterpriseName: row.enterpriseName,
    capacity: row.capacity,
    // 已选项目数来自 `season_projects.challengeIds` 的真实计数（与 projects 同一份数据），
    // 不再写死 0：容量列的分母是 `capacity`，分子必须是真实值。
    selectedCount: projectsOfChallenge.length,
    fivePieceComplete: missingFields.length === 0,
    missingFields,
    resources: resources.map(resourceDto),
    realProblem: row.realProblem,
    targetCustomer: row.targetCustomer,
    minimumDeliverable: row.minimumDeliverable,
    resourceCommitment: row.resourceCommitment,
    resultEvidenceRules: row.resultEvidenceRules,
    // ---- 命题卡内容（契约 §1.1） -----------------------------------------
    summary: row.summary,
    background: row.background,
    industry: row.industry,
    scope: row.scope,
    outOfScope: row.outOfScope,
    monthlyGoal: row.monthlyGoal,
    suggestedSkills: row.suggestedSkills ?? [],
    teamCapacity: row.teamCapacity,
    ownerName: row.ownerName,
    responseSla: row.responseSla,
    // ---- 评分与奖励 -------------------------------------------------------
    scoringWeights: row.scoringWeights ?? null,
    singleWorkCap: row.singleWorkCap,
    // ---- 公开与权益（七项平铺） -------------------------------------------
    rightsPublicScope: row.rightsPublicScope,
    rightsConfidentiality: row.rightsConfidentiality,
    rightsIp: row.rightsIp,
    rightsEnterpriseUsage: row.rightsEnterpriseUsage,
    rightsProcurement: row.rightsProcurement,
    rightsSpecialTerms: row.rightsSpecialTerms,
    rightsExclusivity: row.rightsExclusivity,
    // ---- 侧栏 -------------------------------------------------------------
    versions: versions.map(versionDto),
    projects: projectsOfChallenge,
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

  /** 多个命题的版本记录（新版在前），一次查完再分组。 */
  private async versionsOfMany(challengeIds: number[]): Promise<Map<number, VersionRow[]>> {
    const grouped = new Map<number, VersionRow[]>()
    if (challengeIds.length === 0) return grouped
    const rows = await this.db
      .select()
      .from(challengeVersions)
      .where(inArray(challengeVersions.challengeId, challengeIds))
      .orderBy(asc(challengeVersions.challengeId), desc(challengeVersions.version), asc(challengeVersions.id))
    for (const row of rows) {
      const bucket = grouped.get(row.challengeId)
      if (bucket) bucket.push(row)
      else grouped.set(row.challengeId, [row])
    }
    return grouped
  }

  /**
   * 「选择本命题的项目」，一次取完再按命题分组。
   *
   * 取该赛季所有**未归档**赛季项目后在内存里按 `challengeIds` 过滤：与
   * `season-team` 的 `selectedCount` 同口径（那里也是内存计数），而且
   * `challengeIds` 是 JSON 数组列，SQL 层过滤要写 JSON 函数、跨库方言不一致。
   * 名称 / 简介来自 `projects`，阶段来自 `season_projects.stage`。
   */
  private async projectsOfMany(seasonId: number): Promise<Map<number, ChallengeProjectDto[]>> {
    const grouped = new Map<number, ChallengeProjectDto[]>()
    const rows = await this.db
      .select({
        seasonProjectId: seasonProjects.id,
        projectId: seasonProjects.projectId,
        ownerUserId: seasonProjects.ownerUserId,
        stage: seasonProjects.stage,
        challengeIds: seasonProjects.challengeIds,
        name: projects.name,
        tagline: projects.tagline,
      })
      .from(seasonProjects)
      .leftJoin(projects, eq(seasonProjects.projectId, projects.id))
      .where(and(
        eq(seasonProjects.seasonId, seasonId),
        ne(seasonProjects.status, SeasonProjectStatus.Archived),
      ))
      .orderBy(asc(seasonProjects.id))
    for (const row of rows) {
      for (const challengeId of row.challengeIds ?? []) {
        const item: ChallengeProjectDto = {
          seasonProjectId: row.seasonProjectId,
          projectId: row.projectId,
          name: row.name ?? '',
          tagline: row.tagline ?? null,
          stage: row.stage,
          // 没有姓名列，也不查外部 users 表：`ownerUserId` 就是这里能给出的唯一身份。
          ownerName: row.ownerUserId,
        }
        const bucket = grouped.get(challengeId)
        if (bucket) bucket.push(item)
        else grouped.set(challengeId, [item])
      }
    }
    return grouped
  }

  /** 关注数（COUNT，不加冗余字段，同 ADR-0008）。 */
  private async followCountOf(challengeId: number): Promise<number> {
    const rows = await this.db
      .select({ value: count() })
      .from(challengeFollows)
      .where(eq(challengeFollows.challengeId, challengeId))
    return rows[0]?.value ?? 0
  }

  /**
   * 版本记录写入（契约 §1.2）。三个写入口共用：
   * 新建 / 发布 / 已发布命题的内容更新。
   */
  private async writeVersion(
    challengeId: number,
    version: number,
    note: string,
    changedBy: string,
  ): Promise<void> {
    await this.db.insert(challengeVersions).values({
      challengeId,
      version,
      // 列宽 255，超长会让整次写操作失败 —— 这里截断而不是拒绝请求：
      // changeNote 只是备注，不该因为它把命题保存整个回滚。
      note: note.trim().slice(0, 255) || '更新命题',
      changedBy,
    })
  }

  /** 按变更字段生成中文摘要（`changeNote` 缺省时用）。 */
  private summarizeChanges(fields: string[]): string {
    const labels = fields
      .filter((field) => field !== 'version' && field !== 'updatedAt')
      .map((field) => DETAIL_FIELD_LABELS[field] ?? field)
    if (labels.length === 0) return '更新命题'
    return `更新${labels.join('、')}`
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

  /**
   * 文本字段（简介 / 背景 / 行业 / 范围 / 不做什么 / 一个月最小成果 / 负责人 / 响应时限 / 权益）。
   *
   * 空串一律落成 null：前端清空输入框提交的是 `''`，落库留空串会让
   * 「没填」和「填了空」在详情页呈现不一致（一个显示占位，一个显示空白）。
   */
  private normalizeText(
    value: string | null | undefined,
    field: string,
    max: number,
  ): string | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.length > max) {
      throw boomlandError('VALIDATION_ERROR', `该字段不能超过 ${max} 个字符`, 400, {
        field,
        detail: { max, length: trimmed.length },
      })
    }
    return trimmed
  }

  private normalizeSuggestedSkills(value: string[] | null | undefined): string[] | undefined {
    if (value === undefined) return undefined
    if (value === null) return []
    const { max, itemMax } = CHALLENGE_CARD_LIMITS.suggestedSkills
    const skills: string[] = []
    for (const raw of value) {
      const skill = raw.trim()
      if (!skill) continue
      if (skill.length > itemMax) {
        throw boomlandError(
          'VALIDATION_ERROR',
          `建议技能单条不能超过 ${itemMax} 个字符`,
          400,
          { field: 'suggestedSkills', detail: { itemMax, value: skill } },
        )
      }
      if (!skills.includes(skill)) skills.push(skill)
    }
    if (skills.length > max) {
      throw boomlandError(
        'VALIDATION_ERROR',
        `建议技能最多 ${max} 条`,
        400,
        { field: 'suggestedSkills', detail: { max, received: skills.length } },
      )
    }
    return skills
  }

  /** 1–99 整数或 null（`CHALLENGE_CARD_LIMITS.teamCapacity`）。 */
  private normalizeTeamCapacity(value: number | null | undefined): number | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    const { min, max } = CHALLENGE_CARD_LIMITS.teamCapacity
    if (!Number.isInteger(value) || value < min || value > max) {
      throw boomlandError(
        'VALIDATION_ERROR',
        `团队容量必须是 ${min}–${max} 的整数或留空（不限）`,
        400,
        { field: 'teamCapacity' },
      )
    }
    return value
  }

  /** 1–10000 整数或 null（`CHALLENGE_CARD_LIMITS.singleWorkCap`）。 */
  private normalizeSingleWorkCap(value: number | null | undefined): number | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    const { min, max } = CHALLENGE_CARD_LIMITS.singleWorkCap
    if (!Number.isInteger(value) || value < min || value > max) {
      throw boomlandError(
        'VALIDATION_ERROR',
        `命题单次评分上限必须是 ${min}–${max} 的整数或留空（用赛季上限）`,
        400,
        { field: 'singleWorkCap' },
      )
    }
    return value
  }

  /**
   * 五维权重（契约 §3.3）。
   *
   * - key 必须是 `CHALLENGE_SCORING_DIMENSIONS` 之一，未知 key 直接 400 ——
   *   静默丢弃未知 key 会让「配了 5 个维度、合计却变成 80」变得无法解释。
   * - 值为 0–100 整数，合计必须正好 `CHALLENGE_SCORING_WEIGHT_TOTAL`。
   * - 全 0 / 空对象视为「清空」→ null（未配置按等权）。
   */
  private normalizeScoringWeights(
    value: Record<string, number> | null | undefined,
  ): Record<string, number> | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    const entries = Object.entries(value)
    if (entries.length === 0) return null
    let total = 0
    const weights: Record<string, number> = {}
    for (const [key, raw] of entries) {
      if (!SCORING_DIMENSION_VALUES.includes(key)) {
        throw boomlandError('VALIDATION_ERROR', `未知的评分维度：${key}`, 400, {
          field: 'scoringWeights',
          detail: { dimension: key, allowed: [...SCORING_DIMENSION_VALUES] },
        })
      }
      if (
        !Number.isInteger(raw)
        || raw < 0
        || raw > CHALLENGE_SCORING_WEIGHT_MAX
      ) {
        throw boomlandError(
          'VALIDATION_ERROR',
          `评分权重必须是 0–${CHALLENGE_SCORING_WEIGHT_MAX} 的整数`,
          400,
          { field: 'scoringWeights', detail: { dimension: key, value: raw } },
        )
      }
      weights[key] = raw
      total += raw
    }
    // 全 0 = 清空：五个维度都写 0 在语义上就是「没配」，落成 {} 会让前端
    // 画出一组全 0 的进度条。
    if (total === 0) return null
    if (total !== CHALLENGE_SCORING_WEIGHT_TOTAL) {
      throw boomlandError(
        'VALIDATION_ERROR',
        `五维权重合计必须等于 ${CHALLENGE_SCORING_WEIGHT_TOTAL}（当前 ${total}）`,
        400,
        { field: 'scoringWeights', detail: { total, expected: CHALLENGE_SCORING_WEIGHT_TOTAL } },
      )
    }
    return weights as Record<ChallengeScoringDimension, number>
  }

  /** 七项权益：逐个按 `CHALLENGE_CARD_LIMITS.rights.max` 校验。 */
  private applyRights(
    updates: Partial<typeof challenges.$inferInsert>,
    body: UpdateChallengeBody,
  ): void {
    // 七项权益的 key 来自 shared 常量数组，逐个赋给 `updates` 时 TS 无法把
    // `ChallengeRightsField` 收窄到 insert 类型的 key 集合，这里用一个窄化的
    // 字典视图，避免写七段几乎一样的 if。
    const writable = updates as Record<string, string | null | undefined>
    for (const field of CHALLENGE_RIGHTS_FIELDS) {
      const value = body[field as ChallengeRightsField]
      if (value === undefined) continue
      writable[field] = this.normalizeText(value, field, CHALLENGE_CARD_LIMITS.rights.max) ?? null
    }
  }

  /**
   * 详情页新增字段的统一归一化（create / update 共用）。
   *
   * 抽出来是因为两处的字段集合与校验规则必须**逐字一致** —— 分成两份实现，
   * 迟早出现「创建时能填 300 字、编辑时只能 200 字」这种只在一条路径上出现的 bug。
   */
  private applyDetailFields(
    updates: Partial<typeof challenges.$inferInsert>,
    body: UpdateChallengeBody,
  ): void {
    const limits = CHALLENGE_CARD_LIMITS
    const textFields: Array<[string, string, number]> = [
      ['summary', 'summary', limits.summary.max],
      ['background', 'background', limits.background.max],
      ['industry', 'industry', limits.industry.max],
      ['scope', 'scope', limits.scope.max],
      ['outOfScope', 'outOfScope', limits.outOfScope.max],
      ['monthlyGoal', 'monthlyGoal', limits.monthlyGoal.max],
      ['ownerName', 'ownerName', limits.ownerName.max],
      ['responseSla', 'responseSla', limits.responseSla.max],
    ]
    const writable = updates as Record<string, unknown>
    for (const [field, key, max] of textFields) {
      const value = body[key as keyof UpdateChallengeBody] as string | null | undefined
      if (value === undefined) continue
      writable[field] = this.normalizeText(value, key, max) ?? null
    }
    if (body.suggestedSkills !== undefined) {
      updates.suggestedSkills = this.normalizeSuggestedSkills(body.suggestedSkills) ?? []
    }
    if (body.teamCapacity !== undefined) {
      updates.teamCapacity = this.normalizeTeamCapacity(body.teamCapacity) ?? null
    }
    if (body.scoringWeights !== undefined) {
      updates.scoringWeights = (this.normalizeScoringWeights(body.scoringWeights) ?? null) as
        typeof challenges.$inferInsert['scoringWeights']
    }
    if (body.singleWorkCap !== undefined) {
      updates.singleWorkCap = this.normalizeSingleWorkCap(body.singleWorkCap) ?? null
    }
    this.applyRights(updates, body)
  }

  /** 写后回读的统一 DTO 组装（避免每个写方法各查一遍三张子表）。 */
  private async readDto(challengeId: number, seasonId: number) {
    const row = await this.getRow(challengeId)
    const [resources, versions, projectsByChallenge] = await Promise.all([
      this.resourcesOf(challengeId),
      this.versionsOfMany([challengeId]),
      this.projectsOfMany(seasonId),
    ])
    return dto(row, resources, versions.get(challengeId) ?? [], projectsByChallenge.get(challengeId) ?? [])
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
    const ids = rows.map((row) => row.id)
    // 三张子表各一次查询：列表每行都要 versions / projects（契约 §3.4），
    // 逐条再查会退化成 N+1。
    const [resources, versions, projectsByChallenge] = await Promise.all([
      this.resourcesOfMany(ids),
      this.versionsOfMany(ids),
      this.projectsOfMany(seasonId),
    ])
    return {
      items: rows.map((row) => dto(
        row,
        resources.get(row.id) ?? [],
        versions.get(row.id) ?? [],
        projectsByChallenge.get(row.id) ?? [],
      )),
    }
  }

  /**
   * 命题详情（契约 §3.1）。
   *
   * 在列表 DTO 之上补三样只有详情才需要的东西：赛季上下文（规则 / 预算 / 积分池）、
   * 关注数与「我是否已关注」。列表接口不返回 `season`，也不查关注表。
   */
  async detail(challengeId: number, userId: string | null) {
    const row = await this.getRow(challengeId)
    if (row.status !== ChallengeStatus.Published && row.status !== ChallengeStatus.Closed) {
      await this.access.assertSeasonAccess(row.seasonId, userId ?? '')
    }
    const [resources, versions, projectsByChallenge, seasonRow, followCount, followRows, budgetRows, poolRows] =
      await Promise.all([
        this.resourcesOf(challengeId),
        this.versionsOfMany([challengeId]).then((map) => map.get(challengeId) ?? []),
        this.projectsOfMany(row.seasonId).then((map) => map.get(challengeId) ?? []),
        this.getSeason(row.seasonId),
        this.followCountOf(challengeId),
        userId
          ? this.db
            .select({ id: challengeFollows.id })
            .from(challengeFollows)
            .where(and(
              eq(challengeFollows.challengeId, challengeId),
              eq(challengeFollows.userId, userId),
            ))
            .limit(1)
          : Promise.resolve([] as Array<{ id: number }>),
        this.db
          .select({
            version: seasonBudgets.version,
            totalAmount: seasonBudgets.totalAmount,
            reason: seasonBudgets.reason,
          })
          .from(seasonBudgets)
          .where(and(eq(seasonBudgets.seasonId, row.seasonId), eq(seasonBudgets.status, 'active')))
          .limit(1),
        this.db
          .select({
            totalPoints: seasonPointPools.totalPoints,
            allocatedPoints: seasonPointPools.allocatedPoints,
            usedPoints: seasonPointPools.usedPoints,
          })
          .from(seasonPointPools)
          .where(eq(seasonPointPools.seasonId, row.seasonId))
          .limit(1),
      ])
    return {
      ...dto(row, resources, versions, projectsByChallenge),
      followCount,
      followed: followRows.length > 0,
      season: {
        id: seasonRow.id,
        code: seasonRow.code,
        name: seasonRow.name,
        rules: seasonRow.rules,
        activeBudget: budgetRows[0] ?? null,
        pointPool: poolRows[0] ?? null,
      },
    }
  }

  /**
   * 关注 / 取消关注（契约 §3.2）。
   *
   * 幂等：重复关注靠唯一索引 + `onDuplicateKeyUpdate` 吸收，不先查再插
   * （两次往返之间有并发窗口，靠唯一索引兜底才真的幂等）。
   */
  async follow(challengeId: number, userId: string) {
    const row = await this.getRow(challengeId)
    if (row.status !== ChallengeStatus.Published && row.status !== ChallengeStatus.Closed) {
      await this.access.assertSeasonAccess(row.seasonId, userId)
    }
    await this.db
      .insert(challengeFollows)
      .values({ challengeId, userId })
      .onDuplicateKeyUpdate({ set: { userId } })
    return { followed: true, followCount: await this.followCountOf(challengeId) }
  }

  async unfollow(challengeId: number, userId: string) {
    await this.getRow(challengeId)
    await this.db
      .delete(challengeFollows)
      .where(and(eq(challengeFollows.challengeId, challengeId), eq(challengeFollows.userId, userId)))
    return { followed: false, followCount: await this.followCountOf(challengeId) }
  }

  async create(seasonId: number, userId: string, body: CreateChallengeBody) {
    const season = await this.getSeason(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    this.assertNotFrozen(season)
    const title = body.title.trim()
    if (title.length < 2) {
      throw boomlandError('VALIDATION_ERROR', '命题标题至少 2 个字符', 400, { field: 'title' })
    }
    const detailFields: Partial<typeof challenges.$inferInsert> = {}
    this.applyDetailFields(detailFields, body)
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
      ...detailFields,
      status: ChallengeStatus.Draft,
      version: 1,
      createdBy: userId,
    })
    const row = await this.getRow(result.insertId)
    // 契约 §1.2：新建草稿写一条 v1。
    await this.writeVersion(row.id, row.version, body.changeNote?.trim() || '初版命题卡', userId)
    await writeAudit(this.db, {
      seasonId,
      actorUserId: userId,
      action: 'challenge.created',
      targetType: 'challenge',
      targetId: String(row.id),
      detail: { title: row.title },
    })
    return this.readDto(row.id, seasonId)
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
    this.applyDetailFields(updates, body)
    if (Object.keys(updates).length === 0) return this.readDto(challengeId, row.seasonId)
    // 契约 §1.2：只有**已发布**命题的内容变更才升版本；草稿 / 参考资料随便改。
    const bumped = row.status === ChallengeStatus.Published
    if (bumped) updates.version = row.version + 1
    await this.db.update(challenges).set(updates).where(eq(challenges.id, challengeId))
    if (bumped) {
      await this.writeVersion(
        challengeId,
        row.version + 1,
        body.changeNote?.trim() || this.summarizeChanges(Object.keys(updates)),
        userId,
      )
    }
    const updated = await this.getRow(challengeId)
    await writeAudit(this.db, {
      seasonId: row.seasonId,
      actorUserId: userId,
      action: 'challenge.updated',
      targetType: 'challenge',
      targetId: String(challengeId),
      detail: { fields: Object.keys(updates).filter((key) => key !== 'version') },
    })
    return this.readDto(updated.id, row.seasonId)
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
    await writeAudit(this.db, {
      seasonId: row.seasonId,
      actorUserId: userId,
      action,
      targetType: 'challenge',
      targetId: String(challengeId),
      detail: { from: row.status, to: next },
    })
    return this.readDto(challengeId, row.seasonId)
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

  async publish(challengeId: number, userId: string, changeNote?: string | null) {
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
    // 契约 §1.2：发布写一条**当前**版本（不升版本号）。
    await this.writeVersion(challengeId, row.version, changeNote?.trim() || '发布命题', userId)
    await writeAudit(this.db, {
      seasonId: row.seasonId,
      actorUserId: userId,
      action: 'challenge.published',
      targetType: 'challenge',
      targetId: String(challengeId),
      detail: { from: row.status, to: ChallengeStatus.Published },
    })
    return this.readDto(challengeId, row.seasonId)
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
