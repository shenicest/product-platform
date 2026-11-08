import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import {
  AnnouncementCategory,
  ChallengeStatus,
  EnterpriseCooperationStatus,
  EnterpriseCooperationTier,
  EnterprisePublicScope,
  ENTERPRISE_COOPERATION_AMOUNT_LIMITS,
  ENTERPRISE_COOPERATION_TIERS,
  SEASON_REQUIRED_RULE_CARD_KEYS,
  SEASON_RULE_CARD_SCORELESS,
  seasonRequiredRuleCardItems,
  SeasonApplicationStatus,
  SeasonStatus,
  type SeasonRules,
  type SeasonSchedule,
} from '@shenicest/shared'
import type { Database } from '../../db'
import {
  auditLogs,
  challenges,
  organizerOrgMembers,
  organizerOrgs,
  pointAllocations,
  seasonAnnouncements,
  seasonApplications,
  seasonBudgets,
  seasonEnterpriseCooperations,
  seasonOrganizers,
  seasonParticipants,
  seasonPointPools,
  seasonRuleCardItems,
  seasonVerifierGrants,
  seasons,
  scheduleFromRow,
  scheduleToColumns,
} from '../../db/schema'
import { UserProfileService } from '../user/service'
import {
  BoomlandAccessService,
  boomlandError,
  getSeasonSummary,
  iso,
  isPublicSeason,
  isScorelessSeasonRules,
  normalizeRules,
  normalizeThemes,
  validateRules,
  validateSchedule,
  writeAudit,
  type SeasonSummaryDto,
} from '../boomland-shared'
import type {
  AnnouncementBody,
  CloneSeasonBody,
  CreateSeasonBody,
  EnterpriseCooperationItemInput,
  ListManageQuery,
  ListSeasonsQuery,
  UpdateEnterpriseCooperationsBody,
  UpdateOrganizersBody,
  UpdateRuleCardBody,
  UpdateRulesBody,
  UpdateScheduleBody,
  UpdateSeasonBody,
  UpdateSeasonThemesBody,
} from './model'

type SeasonRow = typeof seasons.$inferSelect
type RuleCardRow = typeof seasonRuleCardItems.$inferSelect
type CooperationRow = typeof seasonEnterpriseCooperations.$inferSelect

type RuleCardDto = {
  id: number
  key: string
  label: string
  value: string
  required: boolean
  visible: boolean
  sortOrder: number
}

export type EnterpriseCooperationDto = {
  id: number
  seasonId: number
  enterpriseName: string
  tier: string
  grade: string | null
  totalAmount: number
  managementFee: number
  prizePoolAmount: number
  dataGrant: string | null
  publicScope: string
  status: string
  sortOrder: number
}

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 100

const REQUIRED_RULE_CARD_KEYS: ReadonlySet<string> = new Set(SEASON_REQUIRED_RULE_CARD_KEYS)

/**
 * 已从必要项移除的历史 key。
 *
 * 旧赛季的规则卡行里可能还留着它们（当时是 `required=true`）：读的时候过滤掉，
 * 写的时候丢弃，避免历史数据在公开页以「可选条目」的身份复活成重复内容。
 */
const LEGACY_RULE_CARD_KEYS: ReadonlySet<string> = new Set([
  'work_deadline',
  'score_deadline',
  'submission_requirements',
  'review_process',
  'milestone_rewards',
  'scoring_rewards',
])

function pageOf(query: { page?: number; pageSize?: number }) {
  const page = Math.max(1, query.page ?? 1)
  const pageSize = Math.max(1, Math.min(query.pageSize ?? PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

function statusValues(raw?: string): string[] | null {
  if (!raw) return null
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean)
  if (values.length === 0) return null
  const allowed = new Set<string>(Object.values(SeasonStatus))
  for (const value of values) {
    if (!allowed.has(value)) {
      throw boomlandError('VALIDATION_ERROR', `未知赛季状态：${value}`, 400, { field: 'status' })
    }
  }
  return values
}

/**
 * 可写规则类配置的赛季状态：赛程 / 规则卡 / 赛季主题共用。
 *
 * 三者都是「已批准赛季改了就影响报名者认知」的内容，所以允许的状态集合必须一致：
 * 草稿期随便改，开赛前后（upcoming / active）也能改但要发公告，暂停中同样可改；
 * 已取消的赛季一律不可改。
 */
const RULE_EDITABLE_STATUSES: string[] = [
  SeasonStatus.Draft,
  SeasonStatus.Upcoming,
  SeasonStatus.Active,
  SeasonStatus.Suspended,
]

const COOPERATION_TIER_VALUES = new Set<string>(ENTERPRISE_COOPERATION_TIERS)
const COOPERATION_STATUS_VALUES = new Set<string>(Object.values(EnterpriseCooperationStatus))
const COOPERATION_PUBLIC_SCOPE_VALUES = new Set<string>(Object.values(EnterprisePublicScope))

function cooperationDto(row: CooperationRow): EnterpriseCooperationDto {
  return {
    id: row.id,
    seasonId: row.seasonId,
    enterpriseName: row.enterpriseName,
    tier: row.tier,
    grade: row.grade,
    totalAmount: row.totalAmount,
    managementFee: row.managementFee,
    prizePoolAmount: row.prizePoolAmount,
    dataGrant: row.dataGrant,
    publicScope: row.publicScope,
    status: row.status,
    sortOrder: row.sortOrder,
  }
}

/**
 * 校验并归一化一条企业合作配置。
 *
 * `index` 参与错误里的 `field`（如 `items[1].tier`）：整表替换一次提交多行，
 * 只说「档位不合法」前端定位不到是哪一行，只能整表重看。
 *
 * 金额走 `ENTERPRISE_COOPERATION_AMOUNT_LIMITS` 而不是写死 0..1e8 —— 上下限
 * 属于领域常量，和前端表格的输入框校验共用同一份。
 */
function normalizeCooperation(
  item: EnterpriseCooperationItemInput,
  index: number,
): typeof seasonEnterpriseCooperations.$inferInsert {
  const field = (name: string) => `items[${index}].${name}`
  const enterpriseName = item.enterpriseName.trim()
  if (enterpriseName.length < 1 || enterpriseName.length > 255) {
    throw boomlandError('VALIDATION_ERROR', `第 ${index + 1} 条企业名需为 1—255 个字符`, 400, {
      field: field('enterpriseName'),
    })
  }
  if (!COOPERATION_TIER_VALUES.has(item.tier)) {
    throw boomlandError('VALIDATION_ERROR', `第 ${index + 1} 条合作档位不合法：${item.tier}`, 400, {
      field: field('tier'),
    })
  }
  if (!COOPERATION_STATUS_VALUES.has(item.status)) {
    throw boomlandError('VALIDATION_ERROR', `第 ${index + 1} 条签约状态不合法：${item.status}`, 400, {
      field: field('status'),
    })
  }
  if (!COOPERATION_PUBLIC_SCOPE_VALUES.has(item.publicScope)) {
    throw boomlandError('VALIDATION_ERROR', `第 ${index + 1} 条公开授权不合法：${item.publicScope}`, 400, {
      field: field('publicScope'),
    })
  }
  const grade = item.grade?.trim() || null
  if (grade && grade.length > 16) {
    throw boomlandError('VALIDATION_ERROR', `第 ${index + 1} 条等级不能超过 16 个字符`, 400, {
      field: field('grade'),
    })
  }
  const dataGrant = item.dataGrant?.trim() || null
  // 数据授权是 text 列，但一屏表格里的一条授权说明不该无限长；超过就说明放错了字段。
  if (dataGrant && dataGrant.length > 2000) {
    throw boomlandError('VALIDATION_ERROR', `第 ${index + 1} 条数据授权说明不能超过 2000 个字符`, 400, {
      field: field('dataGrant'),
    })
  }
  const amounts = {
    totalAmount: item.totalAmount,
    managementFee: item.managementFee,
    prizePoolAmount: item.prizePoolAmount,
  } as const
  for (const [key, value] of Object.entries(amounts)) {
    if (!Number.isInteger(value)
      || value < ENTERPRISE_COOPERATION_AMOUNT_LIMITS.min
      || value > ENTERPRISE_COOPERATION_AMOUNT_LIMITS.max) {
      throw boomlandError(
        'VALIDATION_ERROR',
        `第 ${index + 1} 条金额需为 ${ENTERPRISE_COOPERATION_AMOUNT_LIMITS.min}—${ENTERPRISE_COOPERATION_AMOUNT_LIMITS.max} 的整数（元）`,
        400,
        { field: field(key) },
      )
    }
  }
  return {
    seasonId: 0, // 由调用方回填：这里只负责行内容，避免校验函数偷偷依赖赛季 id
    enterpriseName,
    tier: item.tier,
    grade,
    totalAmount: amounts.totalAmount,
    managementFee: amounts.managementFee,
    prizePoolAmount: amounts.prizePoolAmount,
    dataGrant,
    publicScope: item.publicScope,
    status: item.status,
    sortOrder: index,
  }
}

function ruleCardDto(row: RuleCardRow): RuleCardDto {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    value: row.value,
    required: row.required,
    visible: row.visible,
    sortOrder: row.sortOrder,
  }
}

/**
 * 按赛季配置生成「必要条目」的展示内容（label / value / required / visible）。
 *
 * 唯一真相源是 shared 的 `seasonRequiredRuleCardItems`：后端读、后端写、前端预览
 * 都走同一份生成逻辑，规则卡里显示的内容不可能和赛季配置对不上。
 */
function generatedRequiredItems(rules: SeasonRules, schedule: SeasonSchedule | null) {
  return new Map<string, ReturnType<typeof seasonRequiredRuleCardItems>[number]>(
    seasonRequiredRuleCardItems({ rules, schedule }).map((item) => [item.key as string, item]),
  )
}

/**
 * 读路径：必要条目用赛季配置重建（忽略库里存的旧文案），可选条目原样返回。
 *
 * 顺序沿用库里的 `sortOrder` —— 主办方可以调整必要条目在列表中的位置，这个位置
 * 属于「展示顺序」，不属于「文案」，所以仍然尊重库里的值。历史数据里可能缺少
 * 某个必要行（旧 key 合并前的老赛季），这里补齐到末尾，保证必要条目永远齐全。
 */
function buildRuleCard(
  rows: RuleCardRow[],
  rules: SeasonRules,
  schedule: SeasonSchedule | null,
): RuleCardDto[] {
  const generated = generatedRequiredItems(rules, schedule)
  const items: RuleCardDto[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (LEGACY_RULE_CARD_KEYS.has(row.key)) continue
    const required = generated.get(row.key)
    if (!required) {
      items.push(ruleCardDto(row))
      continue
    }
    seen.add(row.key)
    items.push({
      ...ruleCardDto(row),
      label: required.label,
      value: required.value,
      required: true,
      visible: true,
    })
  }
  let nextSortOrder = rows.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1
  for (const key of SEASON_REQUIRED_RULE_CARD_KEYS) {
    if (seen.has(key)) continue
    const required = generated.get(key)!
    items.push({
      id: 0,
      key,
      label: required.label,
      value: required.value,
      required: true,
      visible: true,
      sortOrder: nextSortOrder,
    })
    nextSortOrder += 1
  }
  return items
}

export class SeasonService {
  private access: BoomlandAccessService
  private users: UserProfileService

  constructor(private db: Database) {
    this.access = new BoomlandAccessService(db)
    this.users = new UserProfileService(db)
  }

  private async getRow(seasonId: number): Promise<SeasonRow | null> {
    const rows = await this.db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1)
    return rows[0] ?? null
  }

  async getSeasonRow(seasonId: number): Promise<SeasonRow> {
    const row = await this.getRow(seasonId)
    if (!row) throw boomlandError('SEASON_NOT_FOUND', '赛季不存在', 404)
    return row
  }

  private assertStatus(row: SeasonRow, allowed: string[], message?: string) {
    if (!allowed.includes(row.status)) {
      throw boomlandError('SEASON_INVALID_STATUS', message ?? `当前状态 ${row.status} 不允许该操作`, 409)
    }
  }

  private async assertCodeAvailable(code: string) {
    const rows = await this.db.select({ id: seasons.id }).from(seasons).where(eq(seasons.code, code)).limit(1)
    if (rows.length > 0) {
      throw boomlandError('SEASON_CODE_TAKEN', '赛季编号已存在', 409, { field: 'code' })
    }
  }

  private async assertOrganizerOrgs(orgIds: number[], userId: string) {
    const unique = [...new Set(orgIds)]
    if (unique.length === 0) {
      throw boomlandError('VALIDATION_ERROR', '至少选择一个主办方组织', 400, { field: 'organizerOrgIds' })
    }
    const orgs = await this.db
      .select({ id: organizerOrgs.id })
      .from(organizerOrgs)
      .where(inArray(organizerOrgs.id, unique))
    if (orgs.length !== unique.length) {
      throw boomlandError('ORGANIZER_ORG_NOT_FOUND', '主办方组织不存在', 404, { field: 'organizerOrgIds' })
    }
    if (!(await this.access.isOperator(userId))) {
      const own = new Set(await this.access.getOrganizerOrgIds(userId))
      if (unique.some((orgId) => !own.has(orgId))) {
        throw boomlandError('NOT_SEASON_ORGANIZER', '只能使用自己所属的主办方组织', 403)
      }
    }
    return unique
  }

  /**
   * 读规则卡：必要条目按赛季配置重建，可选条目原样返回。
   *
   * 传 `row` 而不是只传 id —— 生成必要条目的文案需要 `rules` 与 `schedule`，
   * 调用方（公开详情 / 管理详情 / 写后回读）本来就都有这行数据。
   */
  private async ruleCard(row: SeasonRow) {
    const rows = await this.db
      .select()
      .from(seasonRuleCardItems)
      .where(eq(seasonRuleCardItems.seasonId, row.id))
      .orderBy(asc(seasonRuleCardItems.sortOrder), asc(seasonRuleCardItems.id))
    return buildRuleCard(rows, row.rules, scheduleFromRow(row))
  }

  private async seedRuleCard(
    writer: any,
    seasonId: number,
    rules: SeasonRules,
    schedule: SeasonSchedule | null,
  ) {
    const values = seasonRequiredRuleCardItems({ rules, schedule }).map((item, index) => ({
      seasonId,
      key: item.key,
      label: item.label,
      value: item.value,
      required: true,
      visible: true,
      sortOrder: index,
    }))
    await writer.insert(seasonRuleCardItems).values(values)
  }

  private applicationWindow(row: SeasonRow) {
    const isOpen = isApplicationWindowOpenRow(row)
    return {
      opensAt: iso(row.applyOpen),
      closesAt: iso(row.applyClose),
      isOpen,
    }
  }

  private async summary(row: SeasonRow): Promise<SeasonSummaryDto> {
    return getSeasonSummary(this.db, row)
  }

  private async announce(
    row: SeasonRow,
    actorUserId: string,
    category: string,
    input: { title?: string; content?: string } | undefined,
    fallbackTitle: string,
    fallbackContent: string,
  ) {
    if (!row.approvedAt) return
    const title = input?.title?.trim() || fallbackTitle
    const content = input?.content?.trim() || fallbackContent
    await this.db.insert(seasonAnnouncements).values({
      seasonId: row.id,
      title,
      content,
      category,
      createdBy: actorUserId,
    })
  }

  private async computeReadiness(row: SeasonRow) {
    const schedule = scheduleFromRow(row)
    const [budgetRows, poolRows, allocationRows, verifierRows, challengeRows, orgRows] = await Promise.all([
      this.db
        .select({ totalAmount: seasonBudgets.totalAmount })
        .from(seasonBudgets)
        .where(and(eq(seasonBudgets.seasonId, row.id), eq(seasonBudgets.status, 'active')))
        .limit(1),
      this.db
        .select({ totalPoints: seasonPointPools.totalPoints })
        .from(seasonPointPools)
        .where(eq(seasonPointPools.seasonId, row.id))
        .limit(1),
      this.db
        .select({ value: count() })
        .from(pointAllocations)
        .where(and(eq(pointAllocations.seasonId, row.id), eq(pointAllocations.status, 'active'))),
      this.db
        .select({ value: count() })
        .from(seasonVerifierGrants)
        .where(and(eq(seasonVerifierGrants.seasonId, row.id), eq(seasonVerifierGrants.status, 'active'))),
      this.db
        .select({ value: count() })
        .from(challenges)
        .where(and(eq(challenges.seasonId, row.id), eq(challenges.status, ChallengeStatus.Published))),
      this.db
        .select({ orgId: seasonOrganizers.orgId })
        .from(seasonOrganizers)
        .where(eq(seasonOrganizers.seasonId, row.id)),
    ])

    let organizerReady = false
    if (orgRows.length > 0) {
      const members = await this.db
        .select({ orgId: organizerOrgMembers.orgId })
        .from(organizerOrgMembers)
        .where(inArray(organizerOrgMembers.orgId, orgRows.map((org) => org.orgId)))
        .limit(1)
      organizerReady = members.length > 0
    }

    const scheduleError = schedule ? validateSchedule(schedule) : '赛程尚未填写完整'
    const rulesErrors = validateRules(row.rules)
    if (!row.agreementVersion.trim()) rulesErrors.push('协议版本不能为空')
    // 计分口径三项全空 = 本季不计分：预算 / 积分池 / 评委分配在业务上没有意义，
    // 发布门槛免除这三项。这是「免除」而不是「放行」：detail 里写明原因，
    // 主办方看到的是「本季不计分，免除…」而不是一个假的「已配置」。
    const scoreless = isScorelessSeasonRules(row.rules)

    const checks = [
      {
        key: 'schedule',
        label: '赛程完整',
        passed: scheduleError === null,
        ...(scheduleError ? { detail: scheduleError } : {}),
      },
      {
        key: 'challenges',
        label: '至少一个已发布命题',
        passed: (challengeRows[0]?.value ?? 0) >= 1,
        detail: `已发布 ${challengeRows[0]?.value ?? 0} 个`,
      },
      scoreless
        ? {
          key: 'budget',
          label: '预算已配置',
          passed: true,
          detail: `${SEASON_RULE_CARD_SCORELESS}，免除预算配置`,
        }
        : {
          key: 'budget',
          label: '预算已配置',
          passed: (budgetRows[0]?.totalAmount ?? 0) > 0,
          detail: `当前有效预算 ${budgetRows[0]?.totalAmount ?? 0} 元`,
        },
      scoreless
        ? {
          key: 'point_pool',
          label: '积分池已充值',
          passed: true,
          detail: `${SEASON_RULE_CARD_SCORELESS}，免除积分池配置`,
        }
        : {
          key: 'point_pool',
          label: '积分池已充值',
          passed: (poolRows[0]?.totalPoints ?? 0) > 0,
          detail: `当前积分总量 ${poolRows[0]?.totalPoints ?? 0}`,
        },
      scoreless
        ? {
          key: 'scorers',
          label: '至少一名评委已分配积分',
          passed: true,
          detail: `${SEASON_RULE_CARD_SCORELESS}，免除评委分配`,
        }
        : {
          key: 'scorers',
          label: '至少一名评委已分配积分',
          passed: (allocationRows[0]?.value ?? 0) >= 1,
          detail: `有效分配 ${allocationRows[0]?.value ?? 0} 条`,
        },
      {
        key: 'verifiers',
        label: '至少一名核验员',
        passed: (verifierRows[0]?.value ?? 0) >= 1,
        detail: `有效授权 ${verifierRows[0]?.value ?? 0} 条`,
      },
      {
        key: 'rules',
        label: '规则与协议完整',
        passed: rulesErrors.length === 0,
        ...(rulesErrors.length > 0 ? { detail: rulesErrors.join('；') } : {}),
      },
      {
        key: 'organizers',
        label: '主办方组织有效',
        passed: organizerReady,
        detail: organizerReady ? '至少一个组织有成员' : '没有可用的主办方组织成员',
      },
      {
        key: 'awarding_entity',
        label: '授奖主体已填写',
        passed: Boolean(row.awardingEntity?.trim()),
        detail: row.awardingEntity?.trim() ? row.awardingEntity : '未填写',
      },
    ]
    return {
      seasonId: row.id,
      ready: checks.every((check) => check.passed),
      checks,
      generatedAt: new Date().toISOString(),
    }
  }

  async readiness(seasonId: number, userId: string) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    return this.computeReadiness(row)
  }

  async listPublic(query: ListSeasonsQuery) {
    const { page, pageSize, offset } = pageOf(query)
    const conditions = [isNotNull(seasons.approvedAt), ne(seasons.status, SeasonStatus.Cancelled)]
    const statuses = statusValues(query.status)
    if (statuses) conditions.push(inArray(seasons.status, statuses))
    if (query.type) conditions.push(eq(seasons.type, query.type))
    if (query.city) conditions.push(eq(seasons.city, query.city))
    if (query.theme) {
      conditions.push(sql`JSON_CONTAINS(${seasons.themes}, ${JSON.stringify(query.theme)})`)
    }
    if (query.q) {
      const pattern = `%${query.q}%`
      conditions.push(or(like(seasons.name, pattern), like(seasons.code, pattern))!)
    }
    const where = and(...conditions)
    const [rows, totalRows] = await Promise.all([
      this.db.select().from(seasons).where(where)
        .orderBy(
          desc(seasons.pinned),
          sql`CASE ${seasons.status} WHEN ${SeasonStatus.Active} THEN 0 WHEN ${SeasonStatus.Upcoming} THEN 1 WHEN ${SeasonStatus.Suspended} THEN 2 ELSE 3 END`,
          asc(seasons.startAt),
          desc(seasons.id),
        )
        .limit(pageSize).offset(offset),
      this.db.select({ value: count() }).from(seasons).where(where),
    ])
    const items = await Promise.all(rows.map((row) => this.summary(row)))
    return { items, total: totalRows[0]?.value ?? 0, page, pageSize }
  }

  private async manageableSeasonIds(userId: string): Promise<number[] | null> {
    if (await this.access.isOperator(userId)) return null
    const orgIds = await this.access.getOrganizerOrgIds(userId)
    if (orgIds.length === 0) return []
    const rows = await this.db
      .select({ id: seasonOrganizers.seasonId })
      .from(seasonOrganizers)
      .where(inArray(seasonOrganizers.orgId, orgIds))
    return [...new Set(rows.map((row) => row.id))]
  }

  async listManage(userId: string, query: ListManageQuery) {
    const { page, pageSize, offset } = pageOf(query)
    const manageable = await this.manageableSeasonIds(userId)
    if (manageable !== null && manageable.length === 0) {
      return { items: [], total: 0, page, pageSize }
    }
    const conditions = []
    if (manageable !== null) conditions.push(inArray(seasons.id, manageable))
    const statuses = statusValues(query.status)
    if (statuses) conditions.push(inArray(seasons.status, statuses))
    if (query.type) conditions.push(eq(seasons.type, query.type))
    if (query.pendingApproval === 'true') {
      conditions.push(and(eq(seasons.status, SeasonStatus.Upcoming), isNull(seasons.approvedAt))!)
    }
    if (query.q) {
      const pattern = `%${query.q}%`
      conditions.push(or(like(seasons.name, pattern), like(seasons.code, pattern))!)
    }
    const where = and(...conditions)
    const [rows, totalRows] = await Promise.all([
      this.db.select().from(seasons).where(where).orderBy(desc(seasons.updatedAt), desc(seasons.id))
        .limit(pageSize).offset(offset),
      this.db.select({ value: count() }).from(seasons).where(where),
    ])
    const items = await Promise.all(rows.map(async (row) => {
      const [summary, applicationRows, acceptedRows, readiness] = await Promise.all([
        this.summary(row),
        this.db.select({ value: count() }).from(seasonApplications).where(eq(seasonApplications.seasonId, row.id)),
        this.db.select({ value: count() }).from(seasonApplications).where(
          and(eq(seasonApplications.seasonId, row.id), eq(seasonApplications.status, SeasonApplicationStatus.Accepted)),
        ),
        this.computeReadiness(row),
      ])
      return {
        ...summary,
        pendingApproval: row.status === SeasonStatus.Upcoming && row.approvedAt === null,
        readinessReady: readiness.ready,
        applicationCount: applicationRows[0]?.value ?? 0,
        acceptedCount: acceptedRows[0]?.value ?? 0,
      }
    }))
    return { items, total: totalRows[0]?.value ?? 0, page, pageSize }
  }

  /**
   * 平台管理员视角的“全部赛季”列表。
   *
   * 主办方后台的赛季选择器需要覆盖所有赛季：一个主办方账号往往同时带着
   * 平台管理员角色，若只列自己组织的赛季，选择器会漏掉在管的其它赛季。
   *
   * 这里刻意**不复用** {@link listManage} 的逐行 readiness 计算（每行一次
   * 多表查询，100 行就是几百次往返），选择器只需要摘要字段，所以只补一个
   * “是否待批”标记，保证下拉框打开足够快。
   */
  async listAllForAdmin(query: ListManageQuery) {
    const { page, pageSize, offset } = pageOf(query)
    const conditions = []
    const statuses = statusValues(query.status)
    if (statuses) conditions.push(inArray(seasons.status, statuses))
    if (query.type) conditions.push(eq(seasons.type, query.type))
    if (query.pendingApproval === 'true') {
      conditions.push(and(eq(seasons.status, SeasonStatus.Upcoming), isNull(seasons.approvedAt))!)
    }
    if (query.q) {
      const pattern = `%${query.q}%`
      conditions.push(or(like(seasons.name, pattern), like(seasons.code, pattern))!)
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const [rows, totalRows] = await Promise.all([
      this.db.select().from(seasons).where(where).orderBy(desc(seasons.updatedAt), desc(seasons.id))
        .limit(pageSize).offset(offset),
      this.db.select({ value: count() }).from(seasons).where(where),
    ])
    const items = await Promise.all(rows.map(async (row) => ({
      ...(await this.summary(row)),
      pendingApproval: row.status === SeasonStatus.Upcoming && row.approvedAt === null,
    })))
    return { items, total: totalRows[0]?.value ?? 0, page, pageSize }
  }

  async getPublicDetail(seasonId: number) {
    const row = await this.getSeasonRow(seasonId)
    if (!isPublicSeason(row)) throw boomlandError('SEASON_NOT_FOUND', '赛季不存在或暂未公开', 404)
    const [summary, ruleCard] = await Promise.all([this.summary(row), this.ruleCard(row)])
    return {
      ...summary,
      intro: row.intro,
      ruleCard,
      rulesVersion: row.rulesVersion,
      awardingEntity: row.awardingEntity,
      agreementVersion: row.agreementVersion,
      startedAt: iso(row.startedAt),
      applicationWindow: this.applicationWindow(row),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    }
  }

  async getManageDetail(seasonId: number, userId: string) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const [summary, ruleCard, orgRows] = await Promise.all([
      this.summary(row),
      this.ruleCard(row),
      this.db.select({ orgId: seasonOrganizers.orgId }).from(seasonOrganizers)
        .where(eq(seasonOrganizers.seasonId, seasonId)),
    ])
    return {
      ...summary,
      intro: row.intro,
      ruleCard,
      rulesVersion: row.rulesVersion,
      awardingEntity: row.awardingEntity,
      // 协议版本是赛季表字段，管理端编辑器需要它做预填（写操作走 PATCH /seasons/:id）。
      agreementVersion: row.agreementVersion,
      startedAt: iso(row.startedAt),
      applicationWindow: this.applicationWindow(row),
      rules: row.rules,
      organizerOrgIds: orgRows.map((org) => org.orgId),
      pendingApproval: row.status === SeasonStatus.Upcoming && row.approvedAt === null,
      rejection: row.rejectionReason && row.rejectedAt
        ? { reason: row.rejectionReason, at: iso(row.rejectedAt), by: row.rejectedBy }
        : null,
      timestamps: {
        submittedAt: iso(row.submittedAt),
        approvedAt: iso(row.approvedAt),
        approvedBy: row.approvedBy,
        startedAt: iso(row.startedAt),
        suspendedAt: iso(row.suspendedAt),
        statusBeforeSuspend: row.statusBeforeSuspend,
        resumedAt: iso(row.resumedAt),
        cancelledAt: iso(row.cancelledAt),
        cancelReason: row.cancelReason,
      },
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    }
  }

  async create(userId: string, body: CreateSeasonBody) {
    const name = body.name.trim()
    const type = body.type ?? 'season'
    if (type === 'hackathon' && !body.city?.trim()) {
      throw boomlandError('VALIDATION_ERROR', '黑客松必须填写城市', 400, { field: 'city' })
    }
    const themes = normalizeThemes(body.themes)
    const rules = normalizeRules(body.rules)
    const ruleErrors = validateRules(rules)
    if (ruleErrors.length > 0) {
      throw boomlandError('RULES_INVALID', ruleErrors.join('；'), 400, { field: 'rules' })
    }
    if (body.schedule) {
      const scheduleError = validateSchedule(body.schedule)
      if (scheduleError) throw boomlandError('SCHEDULE_INVALID', scheduleError, 400, { field: 'schedule' })
    }
    await this.assertCodeAvailable(body.code)
    const orgIds = await this.assertOrganizerOrgs(body.organizerOrgIds, userId)
    const scheduleColumns = body.schedule ? scheduleToColumns(body.schedule) : {}
    const seasonId = await this.db.transaction(async (tx) => {
      const [result] = await tx.insert(seasons).values({
        code: body.code,
        name,
        type,
        city: body.city?.trim() || null,
        intro: body.intro ?? null,
        themes,
        ...scheduleColumns,
        status: SeasonStatus.Draft,
        awardingEntity: body.awardingEntity?.trim() || null,
        participantCapacity: body.participantCapacity ?? null,
        agreementVersion: body.agreementVersion?.trim() || 'v1',
        rulesVersion: 1,
        rules,
        createdBy: userId,
      })
      await tx.insert(seasonOrganizers).values(orgIds.map((orgId) => ({ seasonId: result.insertId, orgId })))
      await tx.insert(seasonPointPools).values({ seasonId: result.insertId, createdBy: userId })
      await this.seedRuleCard(tx, result.insertId, rules, body.schedule ?? null)
      await tx.insert(auditLogs).values({
        actorUserId: userId,
        action: 'season.created',
        targetType: 'season',
        targetId: String(result.insertId),
        seasonId: result.insertId,
        detail: { code: body.code, name },
      })
      return result.insertId
    })
    return this.getManageDetail(seasonId, userId)
  }

  async updateCore(seasonId: number, userId: string, body: UpdateSeasonBody) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    this.assertStatus(row, [SeasonStatus.Draft], '只有草稿赛季可以编辑核心字段')
    const updates: Partial<typeof seasons.$inferInsert> = {}
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.type !== undefined) updates.type = body.type
    if (body.city !== undefined) updates.city = body.city?.trim() || null
    if (body.intro !== undefined) updates.intro = body.intro
    if (body.themes !== undefined) updates.themes = normalizeThemes(body.themes)
    if (body.agreementVersion !== undefined) updates.agreementVersion = body.agreementVersion.trim()
    if (body.awardingEntity !== undefined) updates.awardingEntity = body.awardingEntity?.trim() || null
    if (body.participantCapacity !== undefined) updates.participantCapacity = body.participantCapacity
    const nextType = body.type ?? row.type
    const nextCity = body.city !== undefined ? body.city?.trim() : row.city
    if (nextType === 'hackathon' && !nextCity) {
      throw boomlandError('VALIDATION_ERROR', '黑客松必须填写城市', 400, { field: 'city' })
    }
    if (Object.keys(updates).length > 0) {
      await this.db.update(seasons).set(updates).where(eq(seasons.id, seasonId))
      await writeAudit(this.db, {
        actorUserId: userId,
        action: 'season.updated',
        targetType: 'season',
        targetId: String(seasonId),
        seasonId,
        detail: { fields: Object.keys(updates) },
      })
    }
    return this.getManageDetail(seasonId, userId)
  }

  async updateSchedule(seasonId: number, userId: string, body: UpdateScheduleBody) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    this.assertStatus(row, RULE_EDITABLE_STATUSES, '当前状态不能修改赛程')
    const error = validateSchedule(body.schedule)
    if (error) throw boomlandError('SCHEDULE_INVALID', error, 400, { field: 'schedule' })
    await this.db.update(seasons).set({
      ...scheduleToColumns(body.schedule),
      rulesVersion: row.rulesVersion + 1,
    }).where(eq(seasons.id, seasonId))
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.schedule_updated',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { before: scheduleFromRow(row), after: body.schedule },
    })
    await this.announce(
      row,
      userId,
      AnnouncementCategory.Schedule,
      body.announcement,
      '赛程已更新',
      `报名 ${body.schedule.applyOpen} 至 ${body.schedule.applyClose}，开赛 ${body.schedule.startAt}。`,
    )
    return this.getManageDetail(seasonId, userId)
  }

  async updateRules(seasonId: number, userId: string, body: UpdateRulesBody) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    this.assertStatus(row, [SeasonStatus.Draft, SeasonStatus.Upcoming], '开赛后不能修改类型化规则')
    const errors = validateRules(body.rules)
    if (errors.length > 0) throw boomlandError('RULES_INVALID', errors.join('；'), 400, { field: 'rules' })
    await this.db.update(seasons).set({
      rules: body.rules,
      rulesVersion: row.rulesVersion + 1,
    }).where(eq(seasons.id, seasonId))
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.rules_updated',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { before: row.rules, after: body.rules },
    })
    await this.announce(
      row,
      userId,
      AnnouncementCategory.Rules,
      body.announcement,
      '赛季规则已更新',
      '赛季规则已更新，请以最新规则卡为准。',
    )
    return this.getManageDetail(seasonId, userId)
  }

  async updateRuleCard(seasonId: number, userId: string, body: UpdateRuleCardBody) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    this.assertStatus(row, RULE_EDITABLE_STATUSES, '当前状态不能修改规则卡')
    // 必要条目的文案由赛季配置生成：客户端传来的 label / value / visible 一律忽略，
    // 只有它在数组里的**位置**被采纳（下标即 sortOrder）。
    const generated = generatedRequiredItems(row.rules, scheduleFromRow(row))
    const keys = new Set<string>()
    const dropped: string[] = []
    const items: Array<typeof seasonRuleCardItems.$inferInsert> = []
    for (const item of body.items) {
      const key = item.key.trim()
      if (LEGACY_RULE_CARD_KEYS.has(key)) {
        // 旧 key 已不是规则卡的一部分，静默丢弃而不是当作可选条目写回去。
        dropped.push(key)
        continue
      }
      if (keys.has(key)) {
        throw boomlandError('VALIDATION_ERROR', `规则卡 key 重复：${key}`, 400, { field: 'items' })
      }
      keys.add(key)
      const requiredItem = generated.get(key)
      if (requiredItem) {
        items.push({
          seasonId,
          key,
          label: requiredItem.label,
          value: requiredItem.value,
          required: true,
          visible: true,
          sortOrder: items.length,
        })
        continue
      }
      const label = item.label.trim()
      const value = item.value.trim()
      if (!label || !value) {
        throw boomlandError('VALIDATION_ERROR', '规则卡条目 label/value 不能为空', 400, { field: 'items' })
      }
      items.push({
        seasonId,
        key,
        label,
        value,
        required: false,
        visible: item.visible !== false,
        sortOrder: items.length,
      })
    }
    const missing = [...REQUIRED_RULE_CARD_KEYS].filter((key) => !keys.has(key))
    if (missing.length > 0) {
      throw boomlandError('RULE_CARD_REQUIRED_ITEM', `缺少必要规则卡条目：${missing.join(', ')}`, 400, {
        field: 'items',
        detail: { missing },
      })
    }
    await this.db.transaction(async (tx) => {
      await tx.delete(seasonRuleCardItems).where(eq(seasonRuleCardItems.seasonId, seasonId))
      await tx.insert(seasonRuleCardItems).values(items)
    })
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.rule_card_updated',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: {
        keys: items.map((item) => item.key),
        ...(dropped.length > 0 ? { droppedLegacyKeys: dropped } : {}),
      },
    })
    if (body.announcement?.title || body.announcement?.content) {
      await this.announce(
        row,
        userId,
        AnnouncementCategory.General,
        body.announcement,
        '规则卡已更新',
        '赛季规则卡已更新，请查看最新内容。',
      )
    }
    return { items: await this.ruleCard(row) }
  }

  /**
   * 读赛季主题。
   *
   * 公开口径与 `GET /seasons/:id` 完全一致（`isPublicSeason`）：未批准或已取消的
   * 赛季对外就是不存在。主题是报名表单的选项来源，泄露草稿赛季的方向等于提前
   * 透露还没发布的内容。
   */
  async listThemes(seasonId: number) {
    const row = await this.getSeasonRow(seasonId)
    if (!isPublicSeason(row)) throw boomlandError('SEASON_NOT_FOUND', '赛季不存在或暂未公开', 404)
    return { themes: row.themes ?? [] }
  }

  /**
   * 整表替换赛季主题。
   *
   * 与规则卡同口径：允许的状态集合一致（见 `RULE_EDITABLE_STATUSES`），已批准赛季
   * 写入要 `rulesVersion + 1` 并发一条 `rules` 分类公告 —— 主题决定报名者选的方向，
   * 改了方向等于改了规则，报名者需要收到通知。
   */
  async updateThemes(seasonId: number, userId: string, body: UpdateSeasonThemesBody) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    this.assertStatus(row, RULE_EDITABLE_STATUSES, '当前状态不能修改赛季主题')
    const themes = normalizeThemes(body.themes)
    const approved = row.approvedAt !== null
    await this.db.update(seasons).set({
      themes,
      // 未批准赛季的版本号还属于「草稿内部迭代」，对外没人看过，不占版本；
      // 已批准才 +1，让报名者看到的「规则已更新」是真实发生的变化。
      ...(approved ? { rulesVersion: row.rulesVersion + 1 } : {}),
    }).where(eq(seasons.id, seasonId))
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.themes_updated',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { before: row.themes ?? [], after: themes },
    })
    await this.announce(
      row,
      userId,
      AnnouncementCategory.Rules,
      undefined,
      '赛季主题已更新',
      `赛季主题已更新为：${themes.join('、') || '（空）'}。请按最新主题选择报名方向。`,
    )
    return { themes }
  }

  /**
   * 读企业合作配置（主办方后台表格）。
   *
   * 整表按 `sortOrder` 返回：这份配置是商务口径的内部资料，顺序就是主办方排的
   * 展示顺序，不做二次排序。
   */
  async listCooperations(seasonId: number, userId: string) {
    await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    return { items: await this.cooperationRows(seasonId) }
  }

  /**
   * 整表替换企业合作配置（语义同规则卡：先删后插，一次事务）。
   *
   * 只有已取消的赛季拒绝写入：合作配置是商务台账，草稿到开赛后都可能调整，
   * 但赛季取消之后台账就冻结了（钱和授权都不能再改）。
   *
   * 必须走事务：先删后插之间若失败，赛季会变成「一条配置都没有」，
   * 而合作配置没有草稿态可以恢复。
   */
  async updateCooperations(seasonId: number, userId: string, body: UpdateEnterpriseCooperationsBody) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    if (row.status === SeasonStatus.Cancelled) {
      throw boomlandError('SEASON_INVALID_STATUS', '已取消的赛季不能修改企业合作配置', 409)
    }
    const items = body.items.map((item, index) => ({
      ...normalizeCooperation(item, index),
      seasonId,
    }))
    await this.db.transaction(async (tx) => {
      await tx.delete(seasonEnterpriseCooperations)
        .where(eq(seasonEnterpriseCooperations.seasonId, seasonId))
      if (items.length > 0) {
        await tx.insert(seasonEnterpriseCooperations).values(items)
      }
    })
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.cooperations_updated',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: {
        count: items.length,
        enterpriseNames: items.map((item) => item.enterpriseName),
      },
    })
    return { items: await this.cooperationRows(seasonId) }
  }

  private async cooperationRows(seasonId: number): Promise<EnterpriseCooperationDto[]> {
    const rows = await this.db
      .select()
      .from(seasonEnterpriseCooperations)
      .where(eq(seasonEnterpriseCooperations.seasonId, seasonId))
      .orderBy(asc(seasonEnterpriseCooperations.sortOrder), asc(seasonEnterpriseCooperations.id))
    return rows.map(cooperationDto)
  }

  async updateOrganizers(seasonId: number, userId: string, body: UpdateOrganizersBody) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const operator = await this.access.isOperator(userId)
    if (row.status !== SeasonStatus.Draft && !operator) {
      throw boomlandError('SEASON_INVALID_STATUS', '提交后只有平台管理员可以调整主办方组织', 409)
    }
    if (row.status === SeasonStatus.Cancelled) {
      throw boomlandError('SEASON_CANCELLED', '已取消赛季不能修改主办方', 409)
    }
    const orgIds = await this.assertOrganizerOrgs(body.organizerOrgIds, userId)
    await this.db.transaction(async (tx) => {
      await tx.delete(seasonOrganizers).where(eq(seasonOrganizers.seasonId, seasonId))
      await tx.insert(seasonOrganizers).values(orgIds.map((orgId) => ({ seasonId, orgId })))
    })
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.organizers_updated',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { organizerOrgIds: orgIds },
    })
    const orgs = await this.db
      .select({ id: organizerOrgs.id, name: organizerOrgs.name })
      .from(seasonOrganizers)
      .innerJoin(organizerOrgs, eq(seasonOrganizers.orgId, organizerOrgs.id))
      .where(eq(seasonOrganizers.seasonId, seasonId))
    return { organizerOrgs: orgs }
  }

  async submit(seasonId: number, userId: string) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    this.assertStatus(row, [SeasonStatus.Draft], '只有草稿赛季可以提交')
    const readiness = await this.computeReadiness(row)
    if (!readiness.ready) {
      throw boomlandError('SEASON_NOT_READY', '赛季尚未满足发布条件', 409, {
        field: 'readiness',
        detail: { checks: readiness.checks },
      })
    }
    const operator = await this.access.isOperator(userId)
    const now = new Date()
    await this.db.update(seasons).set({
      status: SeasonStatus.Upcoming,
      submittedAt: now,
      approvedAt: operator ? now : null,
      approvedBy: operator ? userId : null,
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
    }).where(eq(seasons.id, seasonId))
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.submitted',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { autoApproved: operator },
    })
    if (operator) {
      await writeAudit(this.db, {
        actorUserId: userId,
        action: 'season.approved',
        targetType: 'season',
        targetId: String(seasonId),
        seasonId,
        detail: { autoApproved: true },
      })
    }
    return this.getManageDetail(seasonId, userId)
  }

  async approve(seasonId: number, userId: string) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertOperator(userId)
    if (row.status !== SeasonStatus.Upcoming || row.approvedAt !== null) {
      throw boomlandError('SEASON_NOT_PENDING', '该赛季不是待批状态', 409)
    }
    const readiness = await this.computeReadiness(row)
    if (!readiness.ready) {
      throw boomlandError('SEASON_NOT_READY', '赛季尚未满足发布条件', 409, {
        field: 'readiness',
        detail: { checks: readiness.checks },
      })
    }
    await this.db.update(seasons).set({
      approvedAt: new Date(),
      approvedBy: userId,
    }).where(eq(seasons.id, seasonId))
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.approved',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
    })
    return this.getManageDetail(seasonId, userId)
  }

  async reject(seasonId: number, userId: string, reason: string) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertOperator(userId)
    if (row.status !== SeasonStatus.Upcoming || row.approvedAt !== null) {
      throw boomlandError('SEASON_NOT_PENDING', '该赛季不是待批状态', 409)
    }
    const trimmed = reason.trim()
    if (trimmed.length < 2) {
      throw boomlandError('VALIDATION_ERROR', '驳回原因至少 2 个字符', 400, { field: 'reason' })
    }
    await this.db.update(seasons).set({
      status: SeasonStatus.Draft,
      rejectedAt: new Date(),
      rejectedBy: userId,
      rejectionReason: trimmed,
      approvedAt: null,
      approvedBy: null,
    }).where(eq(seasons.id, seasonId))
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.rejected',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { reason: trimmed },
    })
    return this.getManageDetail(seasonId, userId)
  }

  async start(seasonId: number, userId: string) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    if (row.status !== SeasonStatus.Upcoming || row.approvedAt === null) {
      throw boomlandError('SEASON_NOT_APPROVED', '赛季尚未批准，不能开赛', 409)
    }
    if (!row.startAt || Date.now() < row.startAt.getTime()) {
      throw boomlandError('SEASON_NOT_STARTED', '未到开赛时间，不能开赛', 409, {
        detail: { startAt: iso(row.startAt) },
      })
    }
    await this.db.update(seasons).set({
      status: SeasonStatus.Active,
      startedAt: new Date(),
    }).where(eq(seasons.id, seasonId))
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.started',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
    })
    return this.getManageDetail(seasonId, userId)
  }

  async suspend(seasonId: number, userId: string) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    this.assertStatus(row, [SeasonStatus.Upcoming, SeasonStatus.Active], '当前状态不能暂停')
    await this.db.update(seasons).set({
      status: SeasonStatus.Suspended,
      statusBeforeSuspend: row.status,
      suspendedAt: new Date(),
    }).where(eq(seasons.id, seasonId))
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.suspended',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { before: row.status },
    })
    return this.getManageDetail(seasonId, userId)
  }

  async resume(seasonId: number, userId: string) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    this.assertStatus(row, [SeasonStatus.Suspended], '只有暂停中的赛季可以恢复')
    const next = row.statusBeforeSuspend ?? SeasonStatus.Upcoming
    await this.db.update(seasons).set({
      status: next,
      statusBeforeSuspend: null,
      resumedAt: new Date(),
    }).where(eq(seasons.id, seasonId))
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.resumed',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { resumedTo: next },
    })
    return this.getManageDetail(seasonId, userId)
  }

  async cancel(seasonId: number, userId: string, reason: string) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    if (row.status === SeasonStatus.Active) {
      throw boomlandError('SEASON_ALREADY_STARTED', '开赛后不能取消', 409)
    }
    if (row.status === SeasonStatus.Suspended && row.statusBeforeSuspend === SeasonStatus.Active) {
      throw boomlandError('SEASON_ALREADY_STARTED', '开赛后不能取消', 409)
    }
    this.assertStatus(row, [SeasonStatus.Draft, SeasonStatus.Upcoming, SeasonStatus.Suspended], '当前状态不能取消')
    const trimmed = reason.trim()
    if (trimmed.length < 2) {
      throw boomlandError('VALIDATION_ERROR', '取消原因至少 2 个字符', 400, { field: 'reason' })
    }
    await this.db.transaction(async (tx) => {
      await tx.update(seasons).set({
        status: SeasonStatus.Cancelled,
        cancelledAt: new Date(),
        cancelReason: trimmed,
        pinned: false,
      }).where(eq(seasons.id, seasonId))
      await tx.update(seasonPointPools).set({ status: 'closed' }).where(eq(seasonPointPools.seasonId, seasonId))
    })
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.cancelled',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { reason: trimmed },
    })
    return this.getManageDetail(seasonId, userId)
  }

  async clone(seasonId: number, userId: string, body: CloneSeasonBody) {
    const source = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    await this.assertCodeAvailable(body.code)
    const name = (body.name?.trim() || `${source.name}（副本）`).slice(0, 255)
    const orgRows = await this.db
      .select({ orgId: seasonOrganizers.orgId })
      .from(seasonOrganizers)
      .where(eq(seasonOrganizers.seasonId, seasonId))
    const sourceCard = await this.db
      .select()
      .from(seasonRuleCardItems)
      .where(eq(seasonRuleCardItems.seasonId, seasonId))
      .orderBy(asc(seasonRuleCardItems.sortOrder), asc(seasonRuleCardItems.id))
    const newId = await this.db.transaction(async (tx) => {
      const [result] = await tx.insert(seasons).values({
        code: body.code,
        name,
        type: source.type,
        city: source.city,
        intro: source.intro,
        themes: source.themes,
        status: SeasonStatus.Draft,
        awardingEntity: source.awardingEntity,
        participantCapacity: source.participantCapacity,
        agreementVersion: source.agreementVersion,
        rulesVersion: 1,
        rules: source.rules,
        createdBy: userId,
      })
      await tx.insert(seasonOrganizers).values(orgRows.map((org) => ({ seasonId: result.insertId, orgId: org.orgId })))
      await tx.insert(seasonPointPools).values({ seasonId: result.insertId, createdBy: userId })
      // 复制赛季清空赛程，所以必要条目按「无赛程」重新生成（截止时间显示为「待定」）；
      // 可选条目与来源顺序保留。必要条目的旧文案不复制 —— 它们由赛季配置生成。
      const clonedCard = buildRuleCard(sourceCard, source.rules, null)
      await tx.insert(seasonRuleCardItems).values(clonedCard.map((item, index) => ({
        seasonId: result.insertId,
        key: item.key,
        label: item.label,
        value: item.value,
        required: item.required,
        visible: item.visible,
        sortOrder: index,
      })))
      await tx.insert(auditLogs).values({
        actorUserId: userId,
        action: 'season.cloned',
        targetType: 'season',
        targetId: String(result.insertId),
        seasonId: result.insertId,
        detail: { sourceSeasonId: seasonId, code: body.code, name },
      })
      return result.insertId
    })
    return this.getManageDetail(newId, userId)
  }

  async pin(seasonId: number, userId: string, pinned: boolean) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertOperator(userId)
    if (pinned && (row.approvedAt === null || row.status === SeasonStatus.Cancelled)) {
      throw boomlandError('PIN_NOT_ALLOWED', '只有已批准且未取消的赛季可以置顶', 409)
    }
    await this.db.transaction(async (tx) => {
      if (pinned) {
        await tx.update(seasons).set({ pinned: false }).where(eq(seasons.pinned, true))
      }
      await tx.update(seasons).set({ pinned }).where(eq(seasons.id, seasonId))
    })
    await writeAudit(this.db, {
      actorUserId: userId,
      action: pinned ? 'season.pinned' : 'season.unpinned',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
    })
    return this.summary(await this.getSeasonRow(seasonId))
  }

  async createAnnouncement(seasonId: number, userId: string, body: AnnouncementBody) {
    const row = await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    if (row.approvedAt === null || row.status === SeasonStatus.Cancelled) {
      throw boomlandError('ANNOUNCEMENT_NOT_ALLOWED', '未批准或已取消的赛季不能发公告', 409)
    }
    const [result] = await this.db.insert(seasonAnnouncements).values({
      seasonId,
      title: body.title.trim(),
      content: body.content.trim(),
      category: body.category ?? AnnouncementCategory.General,
      createdBy: userId,
    })
    await writeAudit(this.db, {
      actorUserId: userId,
      action: 'season.announcement_created',
      targetType: 'season',
      targetId: String(seasonId),
      seasonId,
      detail: { announcementId: result.insertId, title: body.title.trim() },
    })
    const rows = await this.db.select().from(seasonAnnouncements)
      .where(eq(seasonAnnouncements.id, result.insertId)).limit(1)
    return mapAnnouncement(rows[0]!)
  }

  async listAnnouncements(seasonId: number, viewerId: string | null) {
    const row = await this.getSeasonRow(seasonId)
    if (!isPublicSeason(row)) {
      if (!viewerId) throw boomlandError('SEASON_NOT_FOUND', '赛季不存在或暂未公开', 404)
      await this.access.assertSeasonAccess(seasonId, viewerId)
    }
    const rows = await this.db.select().from(seasonAnnouncements)
      .where(eq(seasonAnnouncements.seasonId, seasonId))
      .orderBy(desc(seasonAnnouncements.createdAt))
    return { items: rows.map(mapAnnouncement) }
  }

  async listAuditLogs(seasonId: number, userId: string, query: {
    action?: string
    targetType?: string
    targetId?: string
    page?: number
    pageSize?: number
  }) {
    await this.getSeasonRow(seasonId)
    await this.access.assertSeasonAccess(seasonId, userId)
    const { page, pageSize, offset } = pageOf(query)
    const conditions = [eq(auditLogs.seasonId, seasonId)]
    if (query.action) conditions.push(eq(auditLogs.action, query.action))
    if (query.targetType) conditions.push(eq(auditLogs.targetType, query.targetType))
    if (query.targetId) conditions.push(eq(auditLogs.targetId, query.targetId))
    const where = and(...conditions)
    const [rows, totalRows] = await Promise.all([
      this.db.select().from(auditLogs).where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(pageSize).offset(offset),
      this.db.select({ value: count() }).from(auditLogs).where(where),
    ])
    const items = await Promise.all(rows.map(async (row) => {
      const profile = await this.users.getPublicProfile(row.actorUserId)
      return {
        id: row.id,
        actorUserId: row.actorUserId,
        actorName: profile?.nickname ?? null,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        seasonId: row.seasonId,
        detail: row.detail,
        createdAt: iso(row.createdAt),
      }
    }))
    return { items, total: totalRows[0]?.value ?? 0, page, pageSize }
  }
}

function isApplicationWindowOpenRow(row: SeasonRow): boolean {
  if (!row.approvedAt) return false
  if (row.status !== SeasonStatus.Upcoming && row.status !== SeasonStatus.Active) return false
  if (!row.applyOpen || !row.applyClose) return false
  const now = new Date()
  return now >= row.applyOpen && now <= row.applyClose
}

function mapAnnouncement(row: typeof seasonAnnouncements.$inferSelect) {
  return {
    id: row.id,
    seasonId: row.seasonId,
    title: row.title,
    content: row.content,
    category: row.category,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt),
  }
}
