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

// ---------------------------------------------------------------------------
// 北京时间 ↔ datetime-local
// ---------------------------------------------------------------------------

/**
 * 赛程草稿（`datetime-local` 字符串）↔ 后端 ISO 的互转。
 *
 * 放在这里而不是 `organizer-settings.ts`：`SeasonScheduleDraft` / `SCHEDULE_FIELDS`
 * 都定义在本文件，`draftFromSeason`（回填表单）也要用它 —— 如果转换留在
 * `organizer-settings.ts`，两个模块会互相 import 成环。
 *
 * 时间口径：赛程表标题写的是「北京时间」，所以这里的互转**固定按 UTC+8**，
 * 不跟浏览器本地时区走 —— 否则同一份数据在伦敦和上海会显示成不同时刻。
 */

const BEIJING_TIME_ZONE = 'Asia/Shanghai'
/** 中国不实行夏令时，固定偏移即可；用它把「北京墙上时间」解析成绝对时刻。 */
const BEIJING_OFFSET = '+08:00'

const BEIJING_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: BEIJING_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** ISO → `YYYY-MM-DDTHH:mm`（北京时间）；空值 / 非法值给空串（= 待定）。 */
export function isoToBeijingInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = BEIJING_PARTS.formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const year = pick('year')
  const month = pick('month')
  const day = pick('day')
  const hour = pick('hour')
  const minute = pick('minute')
  if (!year || !month || !day || !hour || !minute) return ''
  return `${year}-${month}-${day}T${hour}:${minute}`
}

/** `YYYY-MM-DDTHH:mm`（北京时间）→ ISO；空值 / 非法值给 null。 */
export function beijingInputToIso(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // `datetime-local` 可能给 `...T10:00` 或带秒的 `...T10:00:30`。
  const normalized = trimmed.length === 16 ? `${trimmed}:00` : trimmed
  const date = new Date(`${normalized}${BEIJING_OFFSET}`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** 后端赛程 → 表单草稿（八个 `datetime-local` 字符串，北京时间）。 */
export function toScheduleDraft(schedule: SeasonSchedule | null | undefined): SeasonScheduleDraft {
  const draft: SeasonScheduleDraft = { ...EMPTY_SCHEDULE_DRAFT }
  if (!schedule) return draft
  for (const field of SCHEDULE_FIELDS) {
    draft[field.key] = isoToBeijingInput(schedule[field.key])
  }
  return draft
}

/**
 * 表单草稿 → `PUT /seasons/:id/schedule` 的 `schedule`。
 *
 * 全空表示「这个赛季不排期」，返回 null；只要有一格填了就必须八格齐全，
 * 任何一格空/非法也返回 null —— 调用前应先跑 {@link validateScheduleDraft}，
 * 页面只在校验通过后才提交。
 */
export function toSchedulePayload(draft: SeasonScheduleDraft): SeasonSchedule | null {
  if (SCHEDULE_FIELDS.every((field) => !draft[field.key].trim())) return null
  const schedule = {} as SeasonSchedule
  for (const field of SCHEDULE_FIELDS) {
    const iso = beijingInputToIso(draft[field.key])
    if (!iso) return null
    schedule[field.key] = iso
  }
  return schedule
}

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
 * 把一个已有赛季的字段摊成表单值。
 *
 * `keepCode` 决定编号怎么处理：
 *   · `false`（复制上季）—— 编号清空，由用户重填：上季的编号已被占用；
 *   · `true`（编辑当前草稿）—— 编号原样带回来（创建后不可改，表单里也只读）。
 *
 * 赛程按北京时间回填成 `datetime-local` 字符串（见 {@link toScheduleDraft}）；
 * 上季没排期时八格全空，等价于「还没排期」。发布状态类字段
 * （status / approvedAt / pinned）不参与，产出永远是一份草稿值。
 */
export function draftFromSeason(
  season: SeasonManageDetail,
  options: { keepCode: boolean; rename?: boolean },
): SeasonDraftValues {
  return {
    code: options.keepCode ? season.code : '',
    name: options.rename ? nextSeasonName(season.name) : season.name,
    type: (season.type === 'hackathon' ? 'hackathon' : 'season') as SeasonType,
    city: season.city ?? '',
    intro: season.intro ?? '',
    themes: [...season.themes],
    agreementVersion: season.agreementVersion,
    awardingEntity: season.awardingEntity ?? '',
    participantCapacity: season.participantCapacity === null ? '' : String(season.participantCapacity),
    organizerOrgIds: [...season.organizerOrgIds],
    schedule: toScheduleDraft(season.schedule),
    rules: { ...season.rules },
  }
}

/**
 * “复制上季”的预填值。
 *
 * 搬运全部**内容字段**（含赛程）：名称进一年、编号清空（上季的编号已被占用），
 * 赛程时间原样回填到表单里，用户按需改。发布状态类字段不参与，
 * 复制出来的永远是一个草稿。
 */
export function draftFromPreviousSeason(season: SeasonManageDetail): SeasonDraftValues {
  return draftFromSeason(season, { keepCode: false, rename: true })
}

/**
 * “编辑当前赛季”的预填值：用于草稿态下直接打开同一张表单改这个赛季。
 *
 * 与复制上季的区别只有两处：编号带回来（且表单里只读）、名称不自动进一年。
 */
export function draftFromCurrentSeason(season: SeasonManageDetail): SeasonDraftValues {
  return draftFromSeason(season, { keepCode: true, rename: false })
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

/**
 * 选择器里的一档：一个赛季。
 *
 * 没有「全部赛季」这一档 —— 主办方后台的每个 tab 都是**按赛季**组织的
 * （报名队列、选手名单、命题库、赛季设置都挂在一个赛季上），
 * 「全部赛季」既取不到数据，也会让用户先选一次才能开始干活。
 */
export type SeasonPickerOption = { value: string; label: string }

/** 选择器需要的最小赛季字段（状态用来在选项里标注）。 */
export type PickableSeason = {
  id: number
  name: string
  code: string
  status: string
  approvedAt: string | null
}

/**
 * 默认选中的赛季：列表里最新的那个。
 *
 * 列表由后端按 `updatedAt` 倒序返回（见 `SeasonService.listManaged`），
 * 所以第一项就是「最近动过的赛季」—— 也就是主办方打开后台时最可能要继续
 * 处理的那一个。没有赛季时返回 null，调用方据此渲染空态。
 */
export function defaultSeasonId(seasons: ReadonlyArray<{ id: number }>): number | null {
  return seasons[0]?.id ?? null
}

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
 * 顺序保持调用方给的顺序（管理器按更新时间倒序，选择器里最新的赛季在最上面）。
 * 每个赛季的 label 末尾带上状态，一眼能看出哪一个是草稿、哪一个在等批准、
 * 哪一个正在跑。没有赛季时返回空数组 —— 调用方据此禁用选择器。
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
  return seasons.map((season) => {
    const base = `${season.name} · ${season.code}`
    const status = season.status
      ? ` · ${seasonPickerStatusLabel({ status: season.status, approvedAt: season.approvedAt ?? null })}`
      : ''
    return { value: String(season.id), label: `${base}${status}` }
  })
}

/** 从 URL query 里解析当前选中的赛季 id；非数字或缺失返回 null（由调用方回落到最新赛季）。 */
export function parseSeasonId(raw: string | null | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * 决定「这一屏该看哪个赛季」：URL 里有合法 id 就用它，否则回落到最新赛季。
 *
 * 主办方后台没有「全部赛季」这种聚合视图 —— 每个 tab 的数据都挂在一个赛季上，
 * 所以缺省值不能是 null（那只会把用户挡在空态前面），必须是列表里的第一个。
 * 列表由后端按 `updatedAt` 倒序返回，第一项就是最近动过的赛季。
 *
 * `OrganizerShell`（选择器高亮、tab 链接）与各页面的服务端取数都走这一个函数，
 * 两边的「默认赛季」因此永远一致，不会出现选择器显示 A、页面取的是 B。
 */
export function resolveSeasonId(
  raw: string | null | undefined,
  seasons: ReadonlyArray<{ id: number }>,
): number | null {
  return parseSeasonId(raw) ?? defaultSeasonId(seasons)
}
