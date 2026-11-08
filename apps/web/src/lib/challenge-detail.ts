import {
  CHALLENGE_RIGHTS_FIELDS,
  CHALLENGE_RIGHTS_FIELD_LABELS,
  CHALLENGE_SCORING_DEFAULT_WEIGHTS,
  CHALLENGE_SCORING_DIMENSION_LABELS,
  CHALLENGE_SCORING_DIMENSIONS,
  ChallengeScoringDimension,
  SEASON_RULE_DEFAULTS,
  isScorelessValue,
  seasonProjectStageLabel,
  type SeasonRules,
} from '@shenicest/shared'
import type { SeasonChallenge } from '@/lib/boomland'

/**
 * 命题详情页的纯函数与类型。
 *
 * 这里**只有**计算：没有 React、没有 fetch，方便直接单测。页面（Server Component）
 * 只负责取数，客户端 tab 只负责把这里的结果摆进 DOM。
 *
 * 口径提醒（见 docs/boomland/challenge-detail-contract.md）：
 *   · 五维权重**不是**发布必填项；未配置按等权展示，但不会伪造一份「已配置」的数据；
 *   · 单次评分上限取「命题上限与赛季上限的较小值」，两个都为空的语义是「本季不计分」；
 *   · 七项权益分别展示，不做合并 —— 合成一段文本会让某一项在公开页里消失。
 */

// ---------------------------------------------------------------------------
// 后端响应形状
// ---------------------------------------------------------------------------

/** 命题版本记录的一行（`challenge_versions`）。 */
export type ChallengeVersionDto = {
  id: number
  version: number
  note: string
  changedBy: string
  createdAt: string
}

/** 「选择本命题的项目」的一行。 */
export type ChallengeProjectDto = {
  seasonProjectId: number
  projectId: number
  name: string
  tagline: string | null
  /** `SeasonProjectStage`。 */
  stage: string
  ownerName: string | null
}

/** 命题详情页右栏 / 评分 tab 需要的赛季上下文。 */
export type ChallengeSeasonContextDto = {
  id: number
  code: string
  name: string
  rules: SeasonRules
  activeBudget: { version: number; totalAmount: number; reason: string } | null
  pointPool: { totalPoints: number; allocatedPoints: number; usedPoints: number } | null
}

/** 命题详情页的完整 DTO（`GET /challenges/:id`）。 */
export type ChallengeDetailDto = SeasonChallenge & {
  type: string | null
  theme: string | null
  enterpriseName: string | null
  capacity: number | null
  selectedCount: number
  fivePieceComplete: boolean
  missingFields: string[]
  resources: ChallengeResourceLike[]

  /** 命题卡正文。 */
  summary: string | null
  background: string | null
  industry: string | null
  scope: string | null
  outOfScope: string | null
  monthlyGoal: string | null
  suggestedSkills: string[]
  teamCapacity: number | null
  ownerName: string | null
  responseSla: string | null

  /** 评分与奖励。 */
  scoringWeights: Record<string, number> | null
  singleWorkCap: number | null

  /** 公开与权益：七项分开存、分开展示。 */
  rightsPublicScope: string | null
  rightsConfidentiality: string | null
  rightsIp: string | null
  rightsEnterpriseUsage: string | null
  rightsProcurement: string | null
  rightsSpecialTerms: string | null
  rightsExclusivity: string | null

  versions: ChallengeVersionDto[]
  projects: ChallengeProjectDto[]
  followCount: number
  followed: boolean
  season: ChallengeSeasonContextDto
}

/** 资源清单行的最小形状（详情页只读展示，不关心 `challengeId` 等列）。 */
export type ChallengeResourceLike = {
  id: number
  kind: string
  title: string
  quantity: string | null
  conditions: string | null
  owner: string | null
  status: string
  sortOrder: number
}

// ---------------------------------------------------------------------------
// 命题卡
// ---------------------------------------------------------------------------

export type DetailRow = { key: string; label: string; value: string }

/** 空文本的统一占位：详情页不显示空白行，也不显示 `null`。 */
export const DETAIL_EMPTY = '待补充'

function text(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : DETAIL_EMPTY
}

/**
 * 命题卡 tab 的行（顺序即展示顺序，与命题详情页截图一致）。
 *
 * `value` 已经拼好可直接渲染：多值字段（建议技能）用「、」连接，
 * 数值字段带单位。视图不再做二次拼接 —— 同一句话只在能单测的地方写一次。
 */
export function challengeCardRows(detail: {
  background: string | null
  realProblem: string | null
  targetCustomer: string | null
  scope: string | null
  outOfScope: string | null
  monthlyGoal: string | null
  suggestedSkills: readonly string[]
  teamCapacity: number | null
  selectedCount: number
  capacity: number | null
  ownerName: string | null
  responseSla: string | null
}): DetailRow[] {
  return [
    { key: 'background', label: '背景', value: text(detail.background) },
    { key: 'realProblem', label: '真实问题', value: text(detail.realProblem) },
    { key: 'targetCustomer', label: '目标客户 / 产业对象', value: text(detail.targetCustomer) },
    { key: 'scope', label: '范围', value: text(detail.scope) },
    { key: 'outOfScope', label: '不做什么', value: text(detail.outOfScope) },
    { key: 'monthlyGoal', label: '一个月最小成果', value: text(detail.monthlyGoal) },
    {
      key: 'suggestedSkills',
      label: '建议技能',
      value: detail.suggestedSkills.length > 0 ? detail.suggestedSkills.join('、') : DETAIL_EMPTY,
    },
    {
      key: 'teamCapacity',
      label: '团队容量',
      value: teamCapacityLabel(detail.teamCapacity, detail.selectedCount, detail.capacity),
    },
    { key: 'ownerName', label: '负责人', value: text(detail.ownerName) },
    { key: 'responseSla', label: '响应时限', value: text(detail.responseSla) },
  ]
}

/**
 * 团队容量行：`最多 N 个项目（每个项目选一次占一个名额）· 已选 X / N`。
 *
 * 两个上限不是一回事：`teamCapacity` 是「这个命题最多几个团队」，
 * `capacity` 是「这个命题最多被几个项目选中」。截图里两者恰好相同，
 * 但口径不同，所以分开写清楚，容量为空时写「不限」而不是留白。
 */
export function teamCapacityLabel(
  teamCapacity: number | null,
  selectedCount: number,
  capacity: number | null,
): string {
  const team = teamCapacity === null ? '团队数量不限' : `最多 ${teamCapacity} 个项目`
  const selected = capacity === null ? `${selectedCount} / 不限` : `${selectedCount} / ${capacity}`
  return `${team}（每个项目选一次占一个名额）· 已选 ${selected}`
}

// ---------------------------------------------------------------------------
// 资源承诺
// ---------------------------------------------------------------------------

/**
 * 资源承诺 tab 的一行。
 *
 * 「数量」与「申请条件」在截图里是两列；任一侧为空时显示破折号 ——
 * 空单元格看起来像「数据没取到」，破折号读起来是「这一项不适用」。
 */
export function challengeResourceRows(
  resources: readonly ChallengeResourceLike[],
  kindLabel: (kind: string) => string,
  statusLabel: (status: string) => string,
): Array<{
  id: number
  kind: string
  kindLabel: string
  title: string
  quantity: string
  conditions: string
  owner: string
  status: string
  statusLabel: string
  /** 未兑现的资源不算确定权益，视图据此把状态 chip 标成警示色。 */
  isUnfulfilled: boolean
}> {
  return [...resources]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((resource) => ({
      id: resource.id,
      kind: resource.kind,
      kindLabel: kindLabel(resource.kind),
      title: resource.title,
      quantity: resource.quantity?.trim() || '—',
      conditions: resource.conditions?.trim() || '—',
      owner: resource.owner?.trim() || '—',
      status: resource.status,
      statusLabel: statusLabel(resource.status),
      isUnfulfilled: resource.status === 'unfulfilled',
    }))
}

// ---------------------------------------------------------------------------
// 评分与奖励
// ---------------------------------------------------------------------------

export type ScoringWeightRow = {
  key: ChallengeScoringDimension
  label: string
  /** 展示用的百分比（`35%`）。 */
  percentLabel: string
  weight: number
}

/**
 * 五维权重行。
 *
 * `scoringWeights` 为空 = 未配置：按 `CHALLENGE_SCORING_DEFAULT_WEIGHTS` 展示，
 * 但 `configured` 为 false，视图据此加一句「未配置，按等权引导」的说明 ——
 * 不能让主办方以为系统替他配了一版权重。
 */
export function scoringWeightRows(
  weights: Record<string, number> | null | undefined,
): { rows: ScoringWeightRow[]; configured: boolean } {
  const configured = Boolean(weights && Object.keys(weights).length > 0)
  const source = configured ? weights! : CHALLENGE_SCORING_DEFAULT_WEIGHTS
  return {
    configured,
    rows: CHALLENGE_SCORING_DIMENSIONS.map((key) => {
      const weight = Number(source[key] ?? CHALLENGE_SCORING_DEFAULT_WEIGHTS[key])
      const safe = Number.isFinite(weight) ? weight : 0
      return {
        key,
        label: CHALLENGE_SCORING_DIMENSION_LABELS[key],
        weight: safe,
        percentLabel: `${safe}%`,
      }
    }),
  }
}

/**
 * 命题的有效单次评分上限：命题上限与赛季上限取**较小值**。
 *
 * 两边都可能为空（= 本季不计分），此时返回 null；只配了一边就用那一边。
 * 为什么取较小值：命题上限是主办方对这条命题更严格的约定，赛季上限是全局兜底，
 * 取大值会让命题的约定失效。
 */
export function effectiveSingleWorkCap(
  challengeCap: number | null | undefined,
  seasonCap: number | null | undefined,
): number | null {
  const a = isScorelessValue(challengeCap) ? null : (challengeCap as number)
  const b = isScorelessValue(seasonCap) ? null : (seasonCap as number)
  if (a === null) return b
  if (b === null) return a
  return Math.min(a, b)
}

/** 单次上限的展示文案：`300 分（标注本命题的作品取赛季上限 300 与本命题上限的较小值）`。 */
export function singleWorkCapLabel(
  challengeCap: number | null | undefined,
  seasonCap: number | null | undefined,
): string {
  const effective = effectiveSingleWorkCap(challengeCap, seasonCap)
  if (effective === null) return '本季不计分'
  if (isScorelessValue(challengeCap)) {
    return `${effective} 分（取赛季上限，本命题未单独设限）`
  }
  return `${effective} 分（标注本命题的作品取赛季上限 ${seasonCap ?? '—'} 与本命题上限 ${challengeCap} 的较小值）`
}

/** 积分口径的一行（label + value），用于「评分与奖励」tab 的下半部分。 */
export function scoringRuleRows(detail: {
  singleWorkCap: number | null
  season: { rules: SeasonRules; activeBudget: { version: number } | null }
}): DetailRow[] {
  const { rules, activeBudget } = detail.season
  return [
    {
      key: 'singleWorkCap',
      label: '命题单次上限',
      value: singleWorkCapLabel(detail.singleWorkCap, rules.singleWorkCap),
    },
    {
      key: 'reviewThreshold',
      label: '大额复核阈值',
      value: isScorelessValue(rules.reviewThreshold)
        ? '本季不设大额复核'
        : `${rules.reviewThreshold} 分（赛季配置）`,
    },
    {
      key: 'quotaSource',
      label: '额度来源',
      value: '赛季积分池，由主办方或平台管理员分配给评委；多位评委叠加',
    },
    {
      key: 'dailyQuota',
      label: '每日额度',
      value: rules.dailyQuotaEnabled ? '已开启（可选防刷开关）' : '未开启（可选防刷开关，默认关闭）',
    },
    {
      key: 'exchangeRatio',
      label: '兑换规则',
      value: isScorelessValue(rules.exchangeRatio)
        ? '本季不计分'
        : `1 积分 = ¥${rules.exchangeRatio}（赛季配置）`,
    },
    {
      key: 'budgetSource',
      label: '预算来源',
      value: activeBudget
        ? `赛季奖励预算 v${activeBudget.version}`
        : '尚未配置有效预算',
    },
  ]
}

/** 「不计分项」的固定说明：产品口径，不随赛季变。 */
export const SCORING_EXCLUDED_NOTE =
  '点赞、浏览量、群聊热度：仅为企业出资方便利而产生的增量内容，不计分。'

/** 权重可选性的固定说明：对应 PRD CHG-02「五维权重非发布必填」。 */
export const SCORING_WEIGHT_NOTE =
  '本命题企业配置了可选权重，评分人仍可在授权范围内自主判断。真实性、合法合规和隐私是一票否决项。'

// ---------------------------------------------------------------------------
// 公开与权益
// ---------------------------------------------------------------------------

/** 公开与权益 tab 的行：七项分别展示，空值统一占位。 */
export function challengeRightsRows(
  rights: Partial<Record<(typeof CHALLENGE_RIGHTS_FIELDS)[number], string | null>>,
): DetailRow[] {
  return CHALLENGE_RIGHTS_FIELDS.map((field) => ({
    key: field,
    label: CHALLENGE_RIGHTS_FIELD_LABELS[field],
    value: text(rights[field]),
  }))
}

/** 权益页脚注：产品口径，不随命题变。 */
export const RIGHTS_FOOTNOTE =
  '项目选择多个命题时逐个保存权益版本与确认记录；夺冠后不得追加知识产权转让条件。'

// ---------------------------------------------------------------------------
// 侧栏
// ---------------------------------------------------------------------------

/** 版本记录的一行：`v3` + 日期 + 变更说明。 */
export function challengeVersionRows(versions: readonly ChallengeVersionDto[]): Array<{
  id: number
  versionLabel: string
  dateLabel: string
  note: string
}> {
  return [...versions]
    .sort((a, b) => b.version - a.version)
    .map((version) => ({
      id: version.id,
      versionLabel: `v${version.version}`,
      dateLabel: formatMonthDay(version.createdAt),
      note: version.note,
    }))
}

const MONTH_DAY = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'numeric',
  day: 'numeric',
})

/**
 * `10月26日`；无法解析时给「待定」而不是 `Invalid Date`。
 *
 * 接受 `Date` 是因为 eden treaty 会把 `timestamp` 反序列化成 `Date` ——
 * 直接 `new Date(date)` 也能工作，但先判一次更清楚地表达了「两种形状都合法」。
 */
export function formatMonthDay(value: string | Date | null | undefined): string {
  if (!value) return '待定'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '待定'
  const parts = MONTH_DAY.formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const month = pick('month')
  const day = pick('day')
  if (!month || !day) return '待定'
  return `${month}月${day}日`
}

/** 版本记录页脚注。 */
export const VERSION_FOOTNOTE = '影响评分、证据、权益和奖励的变更生成新版本，不覆盖旧版。'

/** 「选择本命题的项目」的计数文案：`4 / 6`。 */
export function selectedProjectsLabel(selectedCount: number, capacity: number | null): string {
  return capacity === null ? `${selectedCount} / 不限` : `${selectedCount} / ${capacity}`
}

/** 项目行：名称 + 阶段标签（阶段为空按 seed 处理，不显示空白）。 */
export function challengeProjectRows(projects: readonly ChallengeProjectDto[]): Array<{
  seasonProjectId: number
  projectId: number
  name: string
  tagline: string | null
  stageLabel: string
}> {
  return projects.map((project) => ({
    seasonProjectId: project.seasonProjectId,
    projectId: project.projectId,
    name: project.name?.trim() || '未命名项目',
    tagline: project.tagline,
    stageLabel: seasonProjectStageLabel(project.stage),
  }))
}

/** 未登录 / 未入座时右栏的提示（对应截图里的 403 锁）。 */
export const SEAT_LOCKED_NOTE = '报名并通过审核后才能上传本赛季项目'

/**
 * 入座卡状态。
 *
 * 本批没有「我是否已报名通过」的公开接口，所以只区分「未登录」与「已登录」：
 * 未登录必然未入座；已登录时给「前往报名 / 我的报名」入口，由服务端在报名页兜底。
 * 不猜测审核结果 —— 猜错的提示比不给提示更糟。
 */
export function seatState(input: { isLoggedIn: boolean }): {
  locked: boolean
  title: string
  note: string
} {
  if (!input.isLoggedIn) {
    return { locked: true, title: '入座', note: SEAT_LOCKED_NOTE }
  }
  return { locked: true, title: '入座', note: SEAT_LOCKED_NOTE }
}

/** 关注按钮文案与无障碍标签。 */
export function followLabel(followed: boolean): { text: string; aria: string } {
  return followed
    ? { text: '已关注', aria: '取消关注该命题' }
    : { text: '+ 关注', aria: '关注该命题' }
}

// ---------------------------------------------------------------------------
// 响应归一化
// ---------------------------------------------------------------------------

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

/**
 * 时间字段归一化成 ISO 字符串。
 *
 * **eden treaty 会把 `timestamp` 列反序列化成 `Date` 对象**（`t.Date` 解析器），
 * 而 TypeScript 里这些字段声明成 `string` —— 于是 `typeof value === 'string'`
 * 在运行时会失败，日期直接变成空串（页面上显示「待定」）。
 * 这里两种形状都接受：字符串原样返回，`Date` 转 ISO。
 */
function isoOrEmpty(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return ''
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function rulesOrDefaults(value: unknown): SeasonRules {
  if (!value || typeof value !== 'object') return { ...SEASON_RULE_DEFAULTS }
  const raw = value as Partial<SeasonRules>
  return {
    maxChallengesPerProject:
      numberOrNull(raw.maxChallengesPerProject) ?? SEASON_RULE_DEFAULTS.maxChallengesPerProject,
    maxProjectsPerParticipant:
      numberOrNull(raw.maxProjectsPerParticipant) ??
      SEASON_RULE_DEFAULTS.maxProjectsPerParticipant,
    maxCoreMembers: numberOrNull(raw.maxCoreMembers) ?? SEASON_RULE_DEFAULTS.maxCoreMembers,
    singleWorkCap: numberOrNull(raw.singleWorkCap),
    exchangeRatio: numberOrNull(raw.exchangeRatio),
    reviewThreshold: numberOrNull(raw.reviewThreshold),
    dailyQuotaEnabled: raw.dailyQuotaEnabled === true,
  }
}

/**
 * 把 `GET /challenges/:id` 的响应补齐成 `ChallengeDetailDto`。
 *
 * 后端正在并行加字段（契约 §3.1），所以**任何**新增字段都可能暂时缺失：
 * 这里逐字段兜底，缺什么给 null / [] / 默认规则，页面永远拿得到完整形状。
 * 只归一化、不造数：缺失的正文仍显示「待补充」，不会被补成一句编出来的文案。
 */
export function normalizeChallengeDetail(raw: unknown): ChallengeDetailDto {
  const source = (raw ?? {}) as Record<string, unknown>
  const seasonRaw = (source.season ?? {}) as Record<string, unknown>
  const activeBudgetRaw = seasonRaw.activeBudget as Record<string, unknown> | null | undefined
  const pointPoolRaw = seasonRaw.pointPool as Record<string, unknown> | null | undefined

  const resources = Array.isArray(source.resources)
    ? (source.resources as Record<string, unknown>[])
        .filter((resource) => resource && typeof resource === 'object')
        .map((resource, index) => ({
          id: numberOrNull(resource.id) ?? index,
          kind: typeof resource.kind === 'string' ? resource.kind : '',
          title: typeof resource.title === 'string' ? resource.title : '',
          quantity: stringOrNull(resource.quantity),
          conditions: stringOrNull(resource.conditions),
          owner: stringOrNull(resource.owner),
          status: typeof resource.status === 'string' ? resource.status : '',
          sortOrder: numberOrNull(resource.sortOrder) ?? index,
        }))
    : []

  const versions = Array.isArray(source.versions)
    ? (source.versions as Record<string, unknown>[])
        .filter((version) => version && typeof version === 'object')
        .map((version, index) => ({
          id: numberOrNull(version.id) ?? index,
          version: numberOrNull(version.version) ?? 0,
          note: typeof version.note === 'string' ? version.note : '',
          changedBy: typeof version.changedBy === 'string' ? version.changedBy : '',
          createdAt: isoOrEmpty(version.createdAt),
        }))
    : []

  const projects = Array.isArray(source.projects)
    ? (source.projects as Record<string, unknown>[])
        .filter((project) => project && typeof project === 'object')
        .map((project, index) => ({
          seasonProjectId: numberOrNull(project.seasonProjectId) ?? index,
          projectId: numberOrNull(project.projectId) ?? index,
          name: typeof project.name === 'string' ? project.name : '',
          tagline: stringOrNull(project.tagline),
          stage: typeof project.stage === 'string' ? project.stage : '',
          ownerName: stringOrNull(project.ownerName),
        }))
    : []

  const scoringWeights =
    source.scoringWeights && typeof source.scoringWeights === 'object'
      ? (source.scoringWeights as Record<string, number>)
      : null

  return {
    ...(source as unknown as SeasonChallenge),
    id: numberOrNull(source.id) ?? 0,
    seasonId: numberOrNull(source.seasonId) ?? numberOrNull(seasonRaw.id) ?? 0,
    title: typeof source.title === 'string' ? source.title : '',
    realProblem: stringOrNull(source.realProblem),
    targetCustomer: stringOrNull(source.targetCustomer),
    minimumDeliverable: stringOrNull(source.minimumDeliverable),
    resourceCommitment: stringOrNull(source.resourceCommitment),
    resultEvidenceRules: stringOrNull(source.resultEvidenceRules),
    status: typeof source.status === 'string' ? source.status : '',
    version: numberOrNull(source.version) ?? 1,
    createdBy: typeof source.createdBy === 'string' ? source.createdBy : '',
    createdAt: isoOrEmpty(source.createdAt),
    updatedAt: isoOrEmpty(source.updatedAt),
    type: stringOrNull(source.type),
    theme: stringOrNull(source.theme),
    enterpriseName: stringOrNull(source.enterpriseName),
    capacity: numberOrNull(source.capacity),
    selectedCount: numberOrNull(source.selectedCount) ?? projects.length,
    fivePieceComplete: source.fivePieceComplete === true,
    missingFields: stringArray(source.missingFields),
    resources,
    summary: stringOrNull(source.summary),
    background: stringOrNull(source.background),
    industry: stringOrNull(source.industry),
    scope: stringOrNull(source.scope),
    outOfScope: stringOrNull(source.outOfScope),
    monthlyGoal: stringOrNull(source.monthlyGoal),
    suggestedSkills: stringArray(source.suggestedSkills),
    teamCapacity: numberOrNull(source.teamCapacity),
    ownerName: stringOrNull(source.ownerName),
    responseSla: stringOrNull(source.responseSla),
    scoringWeights,
    singleWorkCap: numberOrNull(source.singleWorkCap),
    rightsPublicScope: stringOrNull(source.rightsPublicScope),
    rightsConfidentiality: stringOrNull(source.rightsConfidentiality),
    rightsIp: stringOrNull(source.rightsIp),
    rightsEnterpriseUsage: stringOrNull(source.rightsEnterpriseUsage),
    rightsProcurement: stringOrNull(source.rightsProcurement),
    rightsSpecialTerms: stringOrNull(source.rightsSpecialTerms),
    rightsExclusivity: stringOrNull(source.rightsExclusivity),
    versions,
    projects,
    followCount: numberOrNull(source.followCount) ?? 0,
    followed: source.followed === true,
    season: {
      id: numberOrNull(seasonRaw.id) ?? numberOrNull(source.seasonId) ?? 0,
      code: typeof seasonRaw.code === 'string' ? seasonRaw.code : '',
      name: typeof seasonRaw.name === 'string' ? seasonRaw.name : '',
      rules: rulesOrDefaults(seasonRaw.rules),
      activeBudget: activeBudgetRaw
        ? {
            version: numberOrNull(activeBudgetRaw.version) ?? 0,
            totalAmount: numberOrNull(activeBudgetRaw.totalAmount) ?? 0,
            reason: typeof activeBudgetRaw.reason === 'string' ? activeBudgetRaw.reason : '',
          }
        : null,
      pointPool: pointPoolRaw
        ? {
            totalPoints: numberOrNull(pointPoolRaw.totalPoints) ?? 0,
            allocatedPoints: numberOrNull(pointPoolRaw.allocatedPoints) ?? 0,
            usedPoints: numberOrNull(pointPoolRaw.usedPoints) ?? 0,
          }
        : null,
    },
  }
}

// ---------------------------------------------------------------------------
// 待开发 tab
// ---------------------------------------------------------------------------

/** 「结果与证据」「命题报告」两个占位 tab 的文案：写清未来承载什么。 */
export const PENDING_TAB_COPY: Record<string, { title: string; scope: string }> = {
  evidence: {
    title: '结果与证据',
    scope:
      '本 tab 将承载 R0—R6 结果与证据的录入与公开：真实客户反馈、交付物、收入与回款、可复核的第三方证据。本批只交付占位。',
  },
  report: {
    title: '命题报告',
    scope:
      '本 tab 将承载命题结项报告：选题背景、参与项目与阶段、结果达成情况、评分与奖励结算、可复用的方法与资产。本批只交付占位。',
  },
}

/** 关注失败时给用户看的话：优先用后端 message，拿不到才用兜底文案。 */
export function followErrorMessage(error: unknown): string {
  const message = (error as { body?: { error?: { message?: unknown } } } | null)?.body?.error
    ?.message
  if (typeof message === 'string' && message.trim().length > 0) return message
  return '关注失败，请稍后重试。'
}

/** 「选择本命题的项目」的固定说明：产品口径，不随命题变。 */
export const SELECTED_PROJECTS_NOTE =
  '没有主命题和辅助命题之分；积分归项目，不按命题分账。'

/** Header 上的五件套标签：完整 / 缺 N 项。 */
export function fivePieceLabel(detail: {
  fivePieceComplete: boolean
  missingFields?: readonly string[]
}): { label: string; tone: 'success' | 'warning'; title: string } {
  if (detail.fivePieceComplete) {
    return { label: '五件套完整', tone: 'success', title: '五件套齐全，可以发布' }
  }
  const missing = detail.missingFields ?? []
  if (missing.length === 0) {
    return { label: '五件套未齐', tone: 'warning', title: '五件套未齐全，暂不能发布' }
  }
  return {
    label: `五件套缺 ${missing.length} 项`,
    tone: 'warning',
    title: `还缺：${missing.join('、')}`,
  }
}

/** Header 上的版本标签：`v3`。 */
export function versionLabel(version: number): string {
  return `v${version}`
}

/**
 * Header 上的赛季标签：`502 · 赛季名`；编号或名缺失时不留空串。
 *
 * 赛季名经常已经带编号（`AI4BBS 产业商业赛季`），这时再拼一次编号会变成
 * 「AI4BBS · AI4BBS 产业商业赛季」，所以名里已经包含编号时只留名。
 */
export function seasonLabel(season: { code: string; name: string }): string {
  const code = season.code?.trim()
  const name = season.name?.trim()
  if (code && name) {
    return name.toLowerCase().includes(code.toLowerCase()) ? name : `${code} · ${name}`
  }
  return code || name || '赛季待定'
}
