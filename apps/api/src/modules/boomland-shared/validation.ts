import {
  SEASON_RULE_DEFAULTS,
  SEASON_RULE_LIMITS,
  SeasonStatus,
  type SeasonRules,
  type SeasonSchedule,
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
  const order = [
    'applyOpen',
    'applyClose',
    'startAt',
    'teamDeadline',
    'scoreDeadline',
    'settleDate',
  ] as const
  const values: number[] = []
  for (const key of order) {
    const timestamp = Date.parse(schedule[key])
    if (!Number.isFinite(timestamp)) return `赛程时间不合法：${key}`
    values.push(timestamp)
  }
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] <= values[i - 1]) {
      return `赛程必须严格递增：${order[i - 1]} 必须早于 ${order[i]}`
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

export function normalizeRules(partial: Partial<SeasonRules> | undefined): SeasonRules {
  return {
    maxChallengesPerProject: partial?.maxChallengesPerProject ?? SEASON_RULE_DEFAULTS.maxChallengesPerProject,
    maxProjectsPerParticipant: partial?.maxProjectsPerParticipant ?? SEASON_RULE_DEFAULTS.maxProjectsPerParticipant,
    maxCoreMembers: partial?.maxCoreMembers ?? SEASON_RULE_DEFAULTS.maxCoreMembers,
    singleWorkCap: partial?.singleWorkCap ?? SEASON_RULE_DEFAULTS.singleWorkCap,
    exchangeRatio: partial?.exchangeRatio ?? SEASON_RULE_DEFAULTS.exchangeRatio,
    reviewThreshold: partial?.reviewThreshold ?? SEASON_RULE_DEFAULTS.reviewThreshold,
    dailyQuotaEnabled: partial?.dailyQuotaEnabled ?? SEASON_RULE_DEFAULTS.dailyQuotaEnabled,
  }
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max
}

function isInteger(value: number): boolean {
  return Number.isInteger(value)
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
  if (!isInteger(rules.singleWorkCap) || !inRange(
    rules.singleWorkCap,
    limits.singleWorkCap.min,
    limits.singleWorkCap.max,
  )) errors.push('单次评分上限必须为正整数')
  if (!inRange(rules.exchangeRatio, limits.exchangeRatio.min, limits.exchangeRatio.max)) {
    errors.push('积分兑换比例必须为正数')
  }
  if (!inRange(rules.reviewThreshold, limits.reviewThreshold.min, limits.reviewThreshold.max)) {
    errors.push('复核阈值必须为非负数')
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
