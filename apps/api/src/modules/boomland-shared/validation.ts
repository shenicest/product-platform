import {
  isScorelessValue,
  SEASON_RULE_DEFAULTS,
  SEASON_RULE_LIMITS,
  SEASON_SCHEDULE_CHAIN,
  SEASON_SCHEDULE_KEYS,
  SEASON_SCHEDULE_LABELS,
  SeasonStatus,
  type SeasonRules,
  type SeasonSchedule,
  type SeasonScheduleKey,
} from '@shenicest/shared'
import { boomlandError } from './errors'

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function normalizeThemes(themes: string[] | undefined): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of themes ?? []) {
    const value = raw.trim()
    if (!value) continue
    if (value.length > 50) {
      throw boomlandError('VALIDATION_ERROR', '单个主题不能超过 50 个字符', 400, { field: 'themes' })
    }
    if (!seen.has(value)) {
      seen.add(value)
      result.push(value)
    }
  }
  if (result.length > 20) {
    throw boomlandError('VALIDATION_ERROR', '主题最多 20 个', 400, { field: 'themes' })
  }
  return result
}

export function validateSchedule(schedule: SeasonSchedule): string | null {
  const values: number[] = []
  for (const key of SEASON_SCHEDULE_CHAIN) {
    const timestamp = Date.parse(schedule[key])
    if (!Number.isFinite(timestamp)) return `赛程时间不合法：${key}`
    values.push(timestamp)
  }
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] <= values[i - 1]) {
      return `赛程必须严格递增：${SEASON_SCHEDULE_CHAIN[i - 1]} 必须早于 ${SEASON_SCHEDULE_CHAIN[i]}`
    }
  }
  const workDeadline = Date.parse(schedule.workDeadline)
  if (!Number.isFinite(workDeadline)) return '赛程时间不合法：workDeadline'
  if (workDeadline > values[4]) return '作品截止不能晚于评分截止'
  const challengeFreezeAt = Date.parse(schedule.challengeFreezeAt)
  if (!Number.isFinite(challengeFreezeAt)) return '赛程时间不合法：challengeFreezeAt'
  if (challengeFreezeAt > values[3]) return '命题冻结不能晚于组队截止'
  return null
}

// ---------------------------------------------------------------------------
// 赛程增量修改（PATCH /seasons/:id/schedule）
// ---------------------------------------------------------------------------

/**
 * 本次增量修改的错误。
 *
 * `httpStatus` 与 `field` 一起返回，是因为「已过去的时间不能改」是**冲突**
 * （409，当前资源状态导致不允许），而「顺序不合法」是**参数问题**（400）；
 * 调用方（Elysia handler）不需要再翻译一遍错误码。
 */
export type SeasonSchedulePatchIssue = {
  code: 'SCHEDULE_INVALID' | 'SCHEDULE_MILESTONE_LOCKED'
  httpStatus: 400 | 409
  message: string
  /** 点号路径（`schedule.startAt`），与前端表单错误的 key 口径一致。 */
  field: string
}

export type SeasonSchedulePatchOutcome =
  | {
      /** 合并后的完整赛程（八个节点齐全）。 */
      schedule: SeasonSchedule
      /** 真正发生变化的节点，按 `SEASON_SCHEDULE_KEYS` 顺序。 */
      changed: SeasonScheduleKey[]
      /** 已经过去、本次被锁定的节点。 */
      locked: SeasonScheduleKey[]
    }
  | { error: SeasonSchedulePatchIssue }

function scheduleIssue(
  code: SeasonSchedulePatchIssue['code'],
  httpStatus: SeasonSchedulePatchIssue['httpStatus'],
  message: string,
  field: string,
): { error: SeasonSchedulePatchIssue } {
  return { error: { code, httpStatus, message, field } }
}

/**
 * 某个赛程节点是否已经过去。
 *
 * 口径是**严格早于现在**：正好等于现在的那一毫秒仍然算「还没过去」，
 * 不然刚填好的截止时间会在提交瞬间变成历史。
 */
export function isPastScheduleValue(
  value: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!value) return false
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp < now.getTime()
}

/** 已经过去、不能再改的赛程节点（没有现有值 = 还没排期，不算过去）。 */
export function lockedScheduleKeys(
  schedule: SeasonSchedule | null | undefined,
  now: Date = new Date(),
): SeasonScheduleKey[] {
  if (!schedule) return []
  return SEASON_SCHEDULE_KEYS.filter((key) => isPastScheduleValue(schedule[key], now))
}

/**
 * 把「只改几个节点」的增量提交合并成完整赛程并校验。
 *
 * 三条规则同时成立：
 *   1. **已过去的节点锁定**：库里已经过去的时间点是历史事实，本次只能原样重复
 *      提交（幂等），改一个毫秒都返回 `SCHEDULE_MILESTONE_LOCKED`。
 *   2. **旧节点不再参与校验**：顺序与 `<=` 约束只看「仍然可编辑」的节点。
 *      已过去的节点是既成事实，把它们的旧值再拿来比较，只会让「改后面的节点」
 *      被前面已经发生的事莫名拦住。
 *   3. **新值不能落到过去**：没被锁定的节点（新排期或原来的未来节点）提交的时间
 *      必须不早于现在。否则改完立刻变成锁定的历史，且顺序约束会被绕开。
 *
 * 未提交的节点一律沿用库里的值，所以调用方只传真正改动的字段即可；
 * 首次排期（库里没有赛程）必须一次给齐八个节点。
 */
export function applySchedulePatch(input: {
  /** 库里现有的赛程；从未排期（或历史数据缺列）时为 null。 */
  current: SeasonSchedule | null
  /** 本次提交的节点子集。 */
  patch: Partial<SeasonSchedule>
  now?: Date
}): SeasonSchedulePatchOutcome {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()

  // 1. 只解析本次提交的节点。
  const submitted: SeasonScheduleKey[] = []
  const parsed: Partial<Record<SeasonScheduleKey, number>> = {}
  for (const key of SEASON_SCHEDULE_KEYS) {
    const raw = input.patch[key]
    if (raw === undefined) continue
    submitted.push(key)
    const timestamp = typeof raw === 'string' ? Date.parse(raw) : Number.NaN
    if (!Number.isFinite(timestamp)) {
      return scheduleIssue(
        'SCHEDULE_INVALID',
        400,
        `赛程时间不合法：${SEASON_SCHEDULE_LABELS[key]}`,
        `schedule.${key}`,
      )
    }
    parsed[key] = timestamp
  }

  // 2. 现有值：用来判断哪些节点已经过去、以及合并未提交的节点。
  const currentValues: Partial<Record<SeasonScheduleKey, number>> = {}
  if (input.current) {
    for (const key of SEASON_SCHEDULE_KEYS) {
      const timestamp = Date.parse(input.current[key])
      if (Number.isFinite(timestamp)) currentValues[key] = timestamp
    }
  }
  const locked = new Set<SeasonScheduleKey>(
    SEASON_SCHEDULE_KEYS.filter((key) => {
      const timestamp = currentValues[key]
      return timestamp !== undefined && timestamp < nowMs
    }),
  )

  // 3. 已过去的节点只能原样重复提交。
  for (const key of submitted) {
    if (locked.has(key) && parsed[key] !== currentValues[key]) {
      return scheduleIssue(
        'SCHEDULE_MILESTONE_LOCKED',
        409,
        `${SEASON_SCHEDULE_LABELS[key]}已经过去，不能再修改`,
        `schedule.${key}`,
      )
    }
  }

  // 4. 合并：未提交的节点沿用库里的值。
  const merged = {} as SeasonSchedule
  const missing: SeasonScheduleKey[] = []
  for (const key of SEASON_SCHEDULE_KEYS) {
    const timestamp = parsed[key] ?? currentValues[key]
    if (timestamp === undefined) {
      missing.push(key)
      continue
    }
    merged[key] = new Date(timestamp).toISOString()
  }
  if (missing.length > 0) {
    return scheduleIssue(
      'SCHEDULE_INVALID',
      400,
      `赛程尚未填写完整：还缺 ${missing.map((key) => SEASON_SCHEDULE_LABELS[key]).join('、')}`,
      'schedule',
    )
  }

  // 5. 新提交且未被锁定的时间不能落到过去。
  for (const key of submitted) {
    if (locked.has(key)) continue
    if ((parsed[key] as number) < nowMs) {
      return scheduleIssue(
        'SCHEDULE_INVALID',
        400,
        `${SEASON_SCHEDULE_LABELS[key]}不能早于当前时间`,
        `schedule.${key}`,
      )
    }
  }

  // 6. 只校验仍然可编辑的节点。
  const editableChain = SEASON_SCHEDULE_CHAIN.filter((key) => !locked.has(key))
  for (let i = 1; i < editableChain.length; i += 1) {
    const previousKey = editableChain[i - 1]
    const currentKey = editableChain[i]
    if (Date.parse(merged[currentKey]) <= Date.parse(merged[previousKey])) {
      return scheduleIssue(
        'SCHEDULE_INVALID',
        400,
        `${SEASON_SCHEDULE_LABELS[currentKey]} 必须晚于${SEASON_SCHEDULE_LABELS[previousKey]}`,
        `schedule.${currentKey}`,
      )
    }
  }
  const editable = (key: SeasonScheduleKey) => !locked.has(key)
  if (
    editable('workDeadline')
    && editable('scoreDeadline')
    && Date.parse(merged.workDeadline) > Date.parse(merged.scoreDeadline)
  ) {
    return scheduleIssue('SCHEDULE_INVALID', 400, '作品截止不能晚于评分截止', 'schedule.workDeadline')
  }
  if (
    editable('challengeFreezeAt')
    && editable('teamDeadline')
    && Date.parse(merged.challengeFreezeAt) > Date.parse(merged.teamDeadline)
  ) {
    return scheduleIssue(
      'SCHEDULE_INVALID',
      400,
      '命题冻结不能晚于组队截止',
      'schedule.challengeFreezeAt',
    )
  }

  // 7. 变化集合按**时间戳**比较：同一时刻的不同写法（`Z` / `+08:00`）不算改动。
  const changed = SEASON_SCHEDULE_KEYS.filter(
    (key) => currentValues[key] !== Date.parse(merged[key]),
  )

  return { schedule: merged, changed: [...changed], locked: [...locked] }
}

/**
 * 计分口径三项的默认值回落。
 *
 * `undefined`（调用方没传）→ 用默认值；显式 `null`（留空 = 本季不计分）→ 原样保留。
 * 不能用 `??`：它会把显式 null 一起换成默认值，等于把「不计分」悄悄改回「计分」。
 */
function scoreValueOrDefault(
  partial: Partial<SeasonRules> | undefined,
  key: 'singleWorkCap' | 'exchangeRatio' | 'reviewThreshold',
): number | null {
  const value = partial?.[key]
  return value === undefined ? SEASON_RULE_DEFAULTS[key] : value
}

export function normalizeRules(partial: Partial<SeasonRules> | undefined): SeasonRules {
  return {
    maxChallengesPerProject: partial?.maxChallengesPerProject ?? SEASON_RULE_DEFAULTS.maxChallengesPerProject,
    maxProjectsPerParticipant: partial?.maxProjectsPerParticipant ?? SEASON_RULE_DEFAULTS.maxProjectsPerParticipant,
    maxCoreMembers: partial?.maxCoreMembers ?? SEASON_RULE_DEFAULTS.maxCoreMembers,
    singleWorkCap: scoreValueOrDefault(partial, 'singleWorkCap'),
    exchangeRatio: scoreValueOrDefault(partial, 'exchangeRatio'),
    reviewThreshold: scoreValueOrDefault(partial, 'reviewThreshold'),
    dailyQuotaEnabled: partial?.dailyQuotaEnabled ?? SEASON_RULE_DEFAULTS.dailyQuotaEnabled,
  }
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}

function isInteger(value: number): boolean {
  return Number.isInteger(value)
}

/**
 * 计分口径三项的校验：`null` 与 `0` 都表示「本季不计分」，属于合法配置。
 *
 * 三项互相独立 —— 只填其中一项也算「本季计分」，所以这里不做「要么全空要么全填」
 * 的联动校验；「是否本季计分」由 `isScorelessValue` 在发布门槛处统一判定。
 */
function validateScoreValue(
  value: number | null,
  options: { label: string; min: number; max: number; integer?: boolean },
): string | null {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return `${options.label}必须为数字或留空`
  if (options.integer && !isInteger(value)) return `${options.label}必须为整数或留空`
  if (!inRange(value, options.min, options.max)) {
    return `${options.label}必须在 ${options.min}–${options.max} 之间，或留空表示本季不计分`
  }
  return null
}

export function validateRules(rules: SeasonRules): string[] {
  const errors: string[] = []
  const limits = SEASON_RULE_LIMITS
  if (!isInteger(rules.maxChallengesPerProject) || !inRange(
    rules.maxChallengesPerProject,
    limits.maxChallengesPerProject.min,
    limits.maxChallengesPerProject.max,
  )) errors.push('每个项目可选命题上限必须为 1–3 的整数')
  if (!isInteger(rules.maxProjectsPerParticipant) || !inRange(
    rules.maxProjectsPerParticipant,
    limits.maxProjectsPerParticipant.min,
    limits.maxProjectsPerParticipant.max,
  )) errors.push('每人最多参与项目数必须为 1–20 的整数')
  if (!isInteger(rules.maxCoreMembers) || !inRange(
    rules.maxCoreMembers,
    limits.maxCoreMembers.min,
    limits.maxCoreMembers.max,
  )) errors.push('团队核心成员上限必须为 1–3 的整数')
  const scoreErrors = [
    validateScoreValue(rules.singleWorkCap, {
      label: '单次评分上限',
      ...limits.singleWorkCap,
      integer: true,
    }),
    validateScoreValue(rules.exchangeRatio, { label: '积分兑换比例', ...limits.exchangeRatio }),
    validateScoreValue(rules.reviewThreshold, { label: '复核阈值', ...limits.reviewThreshold }),
  ]
  for (const message of scoreErrors) {
    if (message) errors.push(message)
  }
  if (typeof rules.dailyQuotaEnabled !== 'boolean') errors.push('每日限额开关必须为布尔值')
  return errors
}

export interface ContactInput {
  wechat?: string
  phone?: string
}

export function normalizeContact(input: ContactInput): { wechat?: string; phone?: string } {
  const wechat = input.wechat?.trim()
  const phone = input.phone?.trim()
  const hasControl = (value: string | undefined) => value !== undefined && /[\u0000-\u001f\u007f]/.test(value)
  if (hasControl(wechat) || hasControl(phone)) {
    throw boomlandError('INVALID_CONTACT', '联系方式不能包含控制字符', 400, { field: 'contact' })
  }
  if (wechat && wechat.length > 100) {
    throw boomlandError('INVALID_CONTACT', '微信号不能超过 100 个字符', 400, { field: 'contact.wechat' })
  }
  if (phone && phone.length > 50) {
    throw boomlandError('INVALID_CONTACT', '手机号不能超过 50 个字符', 400, { field: 'contact.phone' })
  }
  if (!wechat && !phone) {
    throw boomlandError('CONTACT_REQUIRED', '请至少填写微信或手机号', 400, { field: 'contact' })
  }
  return {
    ...(wechat ? { wechat } : {}),
    ...(phone ? { phone } : {}),
  }
}

export function maskContact(contact: { wechat?: string; phone?: string }): string | null {
  const parts: string[] = []
  if (contact.wechat) {
    const value = contact.wechat
    parts.push(`微信 ${value.slice(0, 2)}***${value.slice(-2)}`)
  }
  if (contact.phone) {
    const value = contact.phone
    parts.push(`手机 ${value.slice(0, 3)}****${value.slice(-4)}`)
  }
  return parts.length > 0 ? parts.join(' / ') : null
}

export function isPublicSeason(season: { approvedAt: Date | null; status: string }): boolean {
  return season.approvedAt !== null && season.status !== SeasonStatus.Cancelled
}

/**
 * 本季是否不计分：计分口径三项（单次评分上限 / 兑换比例 / 大额复核）全部为空或 0。
 *
 * 三项是同一套计分口径的组成部分，全部未配置时「预算 / 积分池 / 评委」在业务上
 * 没有意义，发布门槛据此免除这三项（见 `SeasonService.computeReadiness`）。
 * 只要有一项配了值，就视为本季计分，三项门槛照常校验。
 */
export function isScorelessSeasonRules(rules: SeasonRules): boolean {
  return (
    isScorelessValue(rules.singleWorkCap)
    && isScorelessValue(rules.exchangeRatio)
    && isScorelessValue(rules.reviewThreshold)
  )
}

export function isApplicationWindowOpen(season: {
  approvedAt: Date | null
  status: string
  applyOpen: Date | null
  applyClose: Date | null
}, now = new Date()): boolean {
  if (!season.approvedAt) return false
  if (season.status !== SeasonStatus.Upcoming && season.status !== SeasonStatus.Active) return false
  if (!season.applyOpen || !season.applyClose) return false
  return now >= season.applyOpen && now <= season.applyClose
}

export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}
