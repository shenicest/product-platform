import {
  SEASON_RULE_DEFAULTS,
  SEASON_RULE_LIMITS,
  type SeasonRules,
  type SeasonSchedule,
  type SeasonType,
} from '@shenicest/shared'
import type { SeasonSummary } from '@/lib/boomland'

/**
 * 主办方后台的领域类型与表单校验。
 *
 * 这里只放**纯函数**（没有 React、没有 fetch），方便直接单测：
 * 赛季草稿表单的字段规则与后端 `CreateSeasonBody` 一一对应，
 * 后端仍然是最终裁判，前端校验只负责把明显填错的挡在提交之前。
 */

// ---------------------------------------------------------------------------
// 后端响应形状
// ---------------------------------------------------------------------------

export type OrganizerOrg = {
  id: number
  name: string
  memberCount: number
  isMember: boolean
  createdAt: string
}

/** `GET /organizer/seasons` 的一行：摘要 + 主办方列表页要用的几个计数。 */
export type ManagedSeason = SeasonSummary & {
  pendingApproval: boolean
  readinessReady: boolean
  applicationCount: number
  acceptedCount: number
}

/** `GET /admin/seasons/all` 的一行：只补“是否待批”，不做 readiness。 */
export type AdminSeasonListItem = SeasonSummary & {
  pendingApproval: boolean
}

export type SeasonListPage<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type SeasonReadiness = {
  seasonId: number
  ready: boolean
  checks: Array<{ key: string; label: string; passed: boolean; detail?: string }>
  generatedAt: string
}

/** `GET /seasons/:id/manage` —— 赛季全量可管理视图。 */
export type SeasonManageDetail = SeasonSummary & {
  intro: string | null
  rulesVersion: number
  awardingEntity: string | null
  agreementVersion: string
  startedAt: string | null
  applicationWindow: { opensAt: string | null; closesAt: string | null; isOpen: boolean }
  rules: SeasonRules
  organizerOrgIds: number[]
  pendingApproval: boolean
  rejection: { reason: string; at: string | null; by: string | null } | null
  timestamps: {
    submittedAt: string | null
    approvedAt: string | null
    approvedBy: string | null
    startedAt: string | null
    suspendedAt: string | null
    statusBeforeSuspend: string | null
    resumedAt: string | null
    cancelledAt: string | null
    cancelReason: string | null
  }
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// 赛季表单
// ---------------------------------------------------------------------------

/** 表单里的赛程：与 `SeasonSchedule` 同字段，但允许留空（草稿可以没有赛程）。 */
export type SeasonScheduleDraft = {
  [K in keyof SeasonSchedule]: string
}

export type SeasonDraftValues = {
  code: string
  name: string
  type: SeasonType
  city: string
  intro: string
  themes: string[]
  agreementVersion: string
  awardingEntity: string
  /** 空串表示不限名额。 */
  participantCapacity: string
  organizerOrgIds: number[]
  schedule: SeasonScheduleDraft
  rules: SeasonRules
}

export const EMPTY_SCHEDULE_DRAFT: SeasonScheduleDraft = {
  applyOpen: '',
  applyClose: '',
  startAt: '',
  teamDeadline: '',
  challengeFreezeAt: '',
  workDeadline: '',
  scoreDeadline: '',
  settleDate: '',
}

/** 赛程字段的展示顺序与中文名（与 `SCHEDULE_MILESTONES` 保持一致）。 */
export const SCHEDULE_FIELDS: ReadonlyArray<{ key: keyof SeasonSchedule; label: string }> = [
  { key: 'applyOpen', label: '报名开放' },
  { key: 'applyClose', label: '报名截止' },
  { key: 'startAt', label: '开赛' },
  { key: 'teamDeadline', label: '组队截止' },
  { key: 'challengeFreezeAt', label: '命题冻结' },
  { key: 'workDeadline', label: '作品截止' },
  { key: 'scoreDeadline', label: '评分截止' },
  { key: 'settleDate', label: '结算日' },
]

/** 赛季编号：与后端 `CreateSeasonBody.code` 的 pattern 一致。 */
export const SEASON_CODE_PATTERN = /^[A-Za-z0-9_-]+$/

/** 表单 → 请求体的输出结构（`POST /seasons`）。 */
export type CreateSeasonPayload = {
  code: string
  name: string
  type: SeasonType
  city: string | null
  intro: string | null
  themes: string[]
  agreementVersion: string
  awardingEntity: string | null
  participantCapacity: number | null
  organizerOrgIds: number[]
  schedule: SeasonSchedule | null
  rules: SeasonRules
}

// ---------------------------------------------------------------------------
// 校验
// ---------------------------------------------------------------------------

/**
 * 字段级错误。key 用点号路径（`schedule.startAt`），方便表单把错误
 * 定位到具体控件，也和后端 `error.field` 的口径对齐。
 */
export type SeasonDraftErrors = Partial<Record<string, string>>

/** 草稿至少要有编号、名称、类型，以及一个可选的主办方组织（后端必填）。 */
export function validateSeasonDraft(
  values: SeasonDraftValues,
  options: { organizerOrgOptions: readonly number[] },
): SeasonDraftErrors {
  const errors: SeasonDraftErrors = {}

  const code = values.code.trim()
  if (!code) errors.code = '请填写赛季编号'
  else if (code.length > 32) errors.code = '赛季编号最多 32 个字符'
  else if (!SEASON_CODE_PATTERN.test(code)) {
    errors.code = '赛季编号只能包含字母、数字、下划线和连字符'
  }

  const name = values.name.trim()
  if (!name) errors.name = '请填写赛季名称'
  else if (name.length < 2) errors.name = '赛季名称至少 2 个字符'
  else if (name.length > 255) errors.name = '赛季名称最多 255 个字符'

  if (values.type === 'hackathon' && !values.city.trim()) {
    errors.city = '黑客松必须填写城市'
  }

  if (values.agreementVersion.trim().length > 32) {
    errors.agreementVersion = '协议版本最多 32 个字符'
  }

  const capacity = values.participantCapacity.trim()
  if (capacity) {
    if (!/^\d+$/.test(capacity)) errors.participantCapacity = '选手名额必须是正整数'
    else if (Number(capacity) < 1 || Number(capacity) > 100_000) {
      errors.participantCapacity = '选手名额必须在 1–100000 之间'
    }
  }

  if (values.organizerOrgIds.length === 0) {
    errors.organizerOrgIds = '请至少选择一个主办方组织'
  } else if (options.organizerOrgOptions.length === 0) {
    errors.organizerOrgIds = '你还不属于任何主办方组织，请联系平台管理员'
  } else {
    const allowed = new Set(options.organizerOrgOptions)
    if (values.organizerOrgIds.some((id) => !allowed.has(id))) {
      errors.organizerOrgIds = '只能选择自己所属的主办方组织'
    }
  }

  if (values.themes.length > 20) errors.themes = '主题最多 20 个'
  else if (values.themes.some((theme) => theme.length > 50)) {
    errors.themes = '单个主题不能超过 50 个字符'
  }

  Object.assign(errors, validateScheduleDraft(values.schedule))
  Object.assign(errors, validateRulesDraft(values.rules))

  return errors
}

/**
 * 赛程校验（与后端 `validateSchedule` 同序同口径）。
 *
 * 全部留空 = 合法的“草稿还没排期”；但只要填了一个，就必须八个都填且严格递增。
 */
export function validateScheduleDraft(schedule: SeasonScheduleDraft): SeasonDraftErrors {
  const errors: SeasonDraftErrors = {}
  const filled = SCHEDULE_FIELDS.filter((field) => schedule[field.key].trim() !== '')
  if (filled.length === 0) return errors
  if (filled.length !== SCHEDULE_FIELDS.length) {
    for (const field of SCHEDULE_FIELDS) {
      if (schedule[field.key].trim()) continue
      errors[`schedule.${field.key}`] = '请补全赛程（要么全部留空）'
    }
    return errors
  }

  const parsed = SCHEDULE_FIELDS.map((field) => ({
    key: field.key,
    label: field.label,
    time: Date.parse(schedule[field.key]),
  }))
  for (const item of parsed) {
    if (!Number.isFinite(item.time)) {
      errors[`schedule.${item.key}`] = `${item.label} 不是合法时间`
    }
  }
  if (Object.keys(errors).length > 0) return errors

  const order = ['applyOpen', 'applyClose', 'startAt', 'teamDeadline', 'scoreDeadline', 'settleDate'] as const
  const byKey = new Map(parsed.map((item) => [item.key, item]))
  for (let i = 1; i < order.length; i += 1) {
    const previous = byKey.get(order[i - 1])!
    const current = byKey.get(order[i])!
    if (current.time <= previous.time) {
      errors[`schedule.${current.key}`] = `${current.label} 必须晚于${previous.label}`
    }
  }
  const workDeadline = byKey.get('workDeadline')!
  const scoreDeadline = byKey.get('scoreDeadline')!
  if (workDeadline.time > scoreDeadline.time) {
    errors['schedule.workDeadline'] = '作品截止不能晚于评分截止'
  }
  const challengeFreezeAt = byKey.get('challengeFreezeAt')!
  const teamDeadline = byKey.get('teamDeadline')!
  if (challengeFreezeAt.time > teamDeadline.time) {
    errors['schedule.challengeFreezeAt'] = '命题冻结不能晚于组队截止'
  }
  return errors
}

/**
 * 规则校验：范围与整数要求直接取 `SEASON_RULE_LIMITS`，不重复写字面量。
 *
 * 计分口径三项（`singleWorkCap` / `exchangeRatio` / `reviewThreshold`）允许
 * `null` 或 `0` —— 那是「本季不计分」的表达，不是填错；其余三项必须 ≥1。
 */
export function validateRulesDraft(rules: SeasonRules): SeasonDraftErrors {
  const errors: SeasonDraftErrors = {}
  const integerRules = [
    ['maxChallengesPerProject', '每个项目可选命题上限', SEASON_RULE_LIMITS.maxChallengesPerProject],
    ['maxProjectsPerParticipant', '每人最多参与项目数', SEASON_RULE_LIMITS.maxProjectsPerParticipant],
    ['maxCoreMembers', '团队核心成员上限', SEASON_RULE_LIMITS.maxCoreMembers],
  ] as const
  for (const [key, label, limit] of integerRules) {
    const value = rules[key]
    if (!Number.isInteger(value) || value < limit.min || value > limit.max) {
      errors[`rules.${key}`] = `${label}必须是 ${limit.min}–${limit.max} 的整数`
    }
  }

  // 计分口径三项：null / 0 = 本季不计分，其余按上限校验。
  const scorelessRules = [
    ['singleWorkCap', '单次评分上限', SEASON_RULE_LIMITS.singleWorkCap, '必须是 0 或正整数'],
    ['exchangeRatio', '积分兑换比例', SEASON_RULE_LIMITS.exchangeRatio, '不能为负数'],
    ['reviewThreshold', '复核阈值', SEASON_RULE_LIMITS.reviewThreshold, '不能为负数'],
  ] as const
  for (const [key, label, limit, message] of scorelessRules) {
    const value = rules[key]
    if (value === null) continue
    if (!Number.isFinite(value) || value < limit.min || value > limit.max) {
      errors[`rules.${key}`] = `${label}${message}（留空或 0 表示本季不计分）`
    }
  }
  return errors
}

// ---------------------------------------------------------------------------
// 表单 → 请求体
// ---------------------------------------------------------------------------

/** 把表单值转成 `POST /seasons` 的请求体；调用前应先通过 {@link validateSeasonDraft}。 */
export function toCreateSeasonPayload(values: SeasonDraftValues): CreateSeasonPayload {
  const capacity = values.participantCapacity.trim()
  const schedule = buildSchedule(values.schedule)
  return {
    code: values.code.trim(),
    name: values.name.trim(),
    type: values.type,
    city: values.type === 'hackathon' ? values.city.trim() || null : values.city.trim() || null,
    intro: values.intro.trim() || null,
    themes: values.themes,
    agreementVersion: values.agreementVersion.trim() || 'v1',
    awardingEntity: values.awardingEntity.trim() || null,
    participantCapacity: capacity ? Number(capacity) : null,
    organizerOrgIds: values.organizerOrgIds,
    schedule,
    rules: values.rules,
  }
}

/** 全空时返回 null（草稿不排期是合法的）。 */
export function buildSchedule(schedule: SeasonScheduleDraft): SeasonSchedule | null {
  if (SCHEDULE_FIELDS.every((field) => !schedule[field.key].trim())) return null
  return {
    applyOpen: new Date(schedule.applyOpen).toISOString(),
    applyClose: new Date(schedule.applyClose).toISOString(),
    startAt: new Date(schedule.startAt).toISOString(),
    teamDeadline: new Date(schedule.teamDeadline).toISOString(),
    challengeFreezeAt: new Date(schedule.challengeFreezeAt).toISOString(),
    workDeadline: new Date(schedule.workDeadline).toISOString(),
    scoreDeadline: new Date(schedule.scoreDeadline).toISOString(),
    settleDate: new Date(schedule.settleDate).toISOString(),
  }
}

// ---------------------------------------------------------------------------
// 空白表单 / 预填
// ---------------------------------------------------------------------------

/** 新草稿的默认值：规则取共享默认值，赛程留空，类型默认“赛季”。 */
export function emptySeasonDraft(
  defaults: { organizerOrgIds?: number[]; organizerOrgOptions?: readonly number[] } = {},
): SeasonDraftValues {
  const organizerOrgIds = defaults.organizerOrgIds
    ?? (defaults.organizerOrgOptions && defaults.organizerOrgOptions.length > 0
      ? [defaults.organizerOrgOptions[0]]
      : [])
  return {
    code: '',
    name: '',
    type: 'season',
    city: '',
    intro: '',
    themes: [],
    agreementVersion: 'v1',
    awardingEntity: '',
    participantCapacity: '',
    organizerOrgIds,
    schedule: { ...EMPTY_SCHEDULE_DRAFT },
    rules: { ...SEASON_RULE_DEFAULTS },
  }
}

/**
 * “复制上季”的预填值。
 *
 * 只搬运**内容字段**：编号、名称、赛程必须重填 —— 上季的编号已被占用，
 * 时间线也早已过期。发布状态类字段（status / approvedAt / pinned）不参与，
 * 复制出来的永远是一个草稿。
 */
export function draftFromPreviousSeason(season: SeasonManageDetail): SeasonDraftValues {
  return {
    code: '',
    name: nextSeasonName(season.name),
    type: (season.type === 'hackathon' ? 'hackathon' : 'season') as SeasonType,
    city: season.city ?? '',
    intro: season.intro ?? '',
    themes: [...season.themes],
    agreementVersion: season.agreementVersion,
    awardingEntity: season.awardingEntity ?? '',
    participantCapacity: season.participantCapacity === null ? '' : String(season.participantCapacity),
    organizerOrgIds: [...season.organizerOrgIds],
    schedule: { ...EMPTY_SCHEDULE_DRAFT },
    rules: { ...season.rules },
  }
}

/** `2026 春季赛季` → `2027 春季赛季`；没有年份时补“（新）”。 */
export function nextSeasonName(name: string): string {
  const next = name.replace(/(\d{4})/, (match) => String(Number(match) + 1))
  if (next !== name) return next
  return `${name}（新）`.slice(0, 255)
}

/**
 * 推荐赛季编号。
 *
 * 编号已被占用时换一个：`BL2026A` 这类 `前缀+数字+字母后缀` 的编号自增后缀
 * （→ `BL2026B`）；没有后缀或后缀用尽时在末尾追加序号。返回的候选值保证
 * 不与 `existing` 冲突、且不超过 32 个字符。
 */
export function suggestSeasonCode(previousCode: string, existing: readonly string[] = []): string {
  const taken = new Set(existing.map((code) => code.toUpperCase()))
  const stripSuffix = /^(.*\d+?)[A-Za-z]$/
  const withSuffix = /^(.*?)(\d+)([A-Za-z])$/.exec(previousCode)

  const candidates: string[] = []
  if (withSuffix) {
    const [, prefix, digits, suffix] = withSuffix
    for (let code = suffix.toUpperCase().charCodeAt(0) + 1; code <= 90; code += 1) {
      candidates.push(`${prefix}${digits}${String.fromCharCode(code)}`)
    }
  }
  const base = previousCode.replace(stripSuffix, '$1')
  for (let index = 2; index <= 99; index += 1) candidates.push(`${base}-${index}`)
  candidates.push(`BL${Date.now().toString(36).toUpperCase()}`)

  return candidates.find((code) => code.length <= 32 && !taken.has(code.toUpperCase()))
    ?? previousCode.slice(0, 32)
}

// ---------------------------------------------------------------------------
// 赛季选择器
// ---------------------------------------------------------------------------

/** 选择器里的一档：全部赛季 / 一个赛季。没有赛季时只剩“全部赛季”。 */
export type SeasonPickerOption = { value: string; label: string }

/** 选择器需要的最小赛季字段（状态用来在选项里标注）。 */
export type PickableSeason = {
  id: number
  name: string
  code: string
  status: string
  approvedAt: string | null
}

export const ALL_SEASONS_VALUE = 'all'

/**
 * 选择器里的状态文案。
 *
 * 口径与后端一致（见 docs/boomland/CONTEXT.md「Season Status」「Pending Approval」）：
 * “待批准”不是一个独立 status，而是 `upcoming` + `approvedAt` 为空，
 * 所以这里必须先判待批，再落到状态本身。
 *
 * 注意：当前后端 `SeasonStatus` 没有“已归档”（只有命题有 `archived`），
 * 但 PRD 的赛季状态机里预留了 `ended` / `archived`，这里一并给出中文文案，
 * 后端上线后选择器不用再改。出现未知状态时原样回显，不猜。
 */
export function seasonPickerStatusLabel(season: {
  status: string
  approvedAt?: string | null
}): string {
  if (season.status === 'upcoming' && !season.approvedAt) return '待批准'
  const labels: Record<string, string> = {
    draft: '草稿',
    upcoming: '即将开始',
    active: '进行中',
    suspended: '已暂停',
    settling: '结算中',
    ended: '已结束',
    archived: '已归档',
    cancelled: '已取消',
  }
  return labels[season.status] ?? season.status
}

/**
 * 把赛季列表折成选择器选项。
 *
 * 顺序保持调用方给的顺序（管理器按更新时间倒序，选择器里最新的赛季在最上面），
 * 并在前面挂一个“全部赛季”。每个赛季的 label 末尾带上状态，一眼能看出
 * 哪一个是草稿、哪一个在等批准、哪一个正在跑。没有赛季时返回空数组 ——
 * 调用方据此禁用选择器。
 */
export function toSeasonPickerOptions(
  seasons: ReadonlyArray<{
    id: number
    name: string
    code: string
    status?: string
    approvedAt?: string | null
  }>,
): SeasonPickerOption[] {
  if (seasons.length === 0) return []
  return [
    { value: ALL_SEASONS_VALUE, label: '全部赛季' },
    ...seasons.map((season) => {
      const base = `${season.name} · ${season.code}`
      const status = season.status
        ? ` · ${seasonPickerStatusLabel({ status: season.status, approvedAt: season.approvedAt ?? null })}`
        : ''
      return { value: String(season.id), label: `${base}${status}` }
    }),
  ]
}

/** 从 URL query 里解析当前选中的赛季 id；非数字或缺失一律视为“全部赛季”。 */
export function parseSeasonId(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
