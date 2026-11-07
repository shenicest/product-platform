import {
  AnnouncementCategory,
  ChallengeStatus,
  SeasonApplicationStatus,
  SeasonStatus,
  SeasonType,
  WechatStatus,
  type SeasonSchedule,
} from '@shenicest/shared'
import type { ChipTone } from '@/components/ui/chip'

export type SeasonSummary = {
  id: number
  code: string
  name: string
  type: SeasonType | string
  city: string | null
  status: SeasonStatus | string
  themes: string[]
  schedule: SeasonSchedule | null
  organizerOrgs: Array<{ id: number; name: string }>
  pinned: boolean
  approvedAt: string | null
  participantCapacity: number | null
  participantCount: number
  publishedChallengeCount: number
}

export type RuleCardItem = {
  id: number
  key: string
  label: string
  value: string
  required: boolean
  visible: boolean
  sortOrder: number
}

export type SeasonDetail = SeasonSummary & {
  intro: string | null
  ruleCard: RuleCardItem[]
  rulesVersion: number
  awardingEntity: string | null
  agreementVersion: string
  startedAt: string | null
  applicationWindow: {
    opensAt: string | null
    closesAt: string | null
    isOpen: boolean
  }
  createdAt: string
  updatedAt: string
}

export type SeasonAnnouncement = {
  id: number
  seasonId: number
  title: string
  content: string
  category: AnnouncementCategory | string
  createdBy: string
  createdAt: string
}

export type SeasonChallenge = {
  id: number
  seasonId: number
  title: string
  realProblem: string | null
  targetCustomer: string | null
  minimumDeliverable: string | null
  resourceCommitment: string | null
  resultEvidenceRules: string | null
  status: ChallengeStatus | string
  version: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type SeasonApplication = {
  id: number
  seasonId: number
  userId: string
  skills: string
  experience: string
  themes: string[]
  teamIntent: string
  acceptsSolo: boolean
  availability: string
  cityMode: string
  visibility: string
  agreementVersion: string
  status: SeasonApplicationStatus | string
  reviewedBy: string | null
  reviewReason: string | null
  reviewedAt: string | null
  withdrawnAt: string | null
  contact: { wechat?: string; phone?: string } | null
  createdAt: string
  updatedAt: string
}

export type MySeasonApplication = {
  application: SeasonApplication
  season: SeasonSummary
  wechatStatus: WechatStatus | null
}

export type SeasonListResponse = {
  items: SeasonSummary[]
  total: number
  page: number
  pageSize: number
}

const STATUS_META: Record<string, { label: string; tone: ChipTone }> = {
  [SeasonStatus.Draft]: { label: '草稿', tone: 'neutral' },
  [SeasonStatus.Upcoming]: { label: '即将开始', tone: 'sky' },
  [SeasonStatus.Active]: { label: '进行中', tone: 'success' },
  [SeasonStatus.Suspended]: { label: '已暂停', tone: 'warning' },
  [SeasonStatus.Cancelled]: { label: '已取消', tone: 'danger' },
}

export function seasonStatusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, tone: 'neutral' as const }
}

export function seasonTypeLabel(type: string): string {
  return type === SeasonType.Hackathon ? '黑客松' : '赛季'
}

const APPLICATION_STATUS_META: Record<string, { label: string; tone: ChipTone }> = {
  [SeasonApplicationStatus.Submitted]: { label: '已提交', tone: 'sky' },
  [SeasonApplicationStatus.Accepted]: { label: '已通过', tone: 'success' },
  [SeasonApplicationStatus.Pending]: { label: '待定', tone: 'warning' },
  [SeasonApplicationStatus.Waitlisted]: { label: '候补', tone: 'warning' },
  [SeasonApplicationStatus.Rejected]: { label: '未通过', tone: 'danger' },
  [SeasonApplicationStatus.Withdrawn]: { label: '已撤回', tone: 'neutral' },
}

export function applicationStatusMeta(status: string) {
  return APPLICATION_STATUS_META[status] ?? { label: status, tone: 'neutral' as const }
}

const WECHAT_STATUS_LABELS: Record<string, string> = {
  [WechatStatus.NotInvited]: '未邀请',
  [WechatStatus.Invited]: '已邀请',
  [WechatStatus.Joined]: '已加入',
  [WechatStatus.Failed]: '邀请失败',
}

export function wechatStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return WECHAT_STATUS_LABELS[status] ?? status
}

const CHALLENGE_STATUS_META: Record<string, { label: string; tone: ChipTone }> = {
  [ChallengeStatus.Draft]: { label: '草稿', tone: 'neutral' },
  [ChallengeStatus.Reference]: { label: '参考资料', tone: 'warning' },
  [ChallengeStatus.Published]: { label: '已发布', tone: 'success' },
  [ChallengeStatus.Closed]: { label: '已关闭', tone: 'neutral' },
  [ChallengeStatus.Archived]: { label: '已归档', tone: 'neutral' },
}

export function challengeStatusMeta(status: string) {
  return CHALLENGE_STATUS_META[status] ?? { label: status, tone: 'neutral' as const }
}

export const ANNOUNCEMENT_CATEGORY_LABELS: Record<string, string> = {
  [AnnouncementCategory.General]: '一般通知',
  [AnnouncementCategory.Schedule]: '赛程变更',
  [AnnouncementCategory.Rules]: '规则变更',
}

export function announcementCategoryLabel(category: string): string {
  return ANNOUNCEMENT_CATEGORY_LABELS[category] ?? '公告'
}

const DATE_TIME = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const DATE_ONLY = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '待定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '待定'
  return DATE_TIME.format(date).replace(/\//g, '.')
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '待定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '待定'
  return DATE_ONLY.format(date).replace(/\//g, '.')
}

const SHANGHAI_PARTS = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

function shanghaiDateParts(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = SHANGHAI_PARTS.formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  const year = pick('year')
  const month = pick('month')
  const day = pick('day')
  if (!year || !month || !day) return null
  return { year, month, day }
}

/** `11.15` —— 用于首屏的报名 / 赛季区间。 */
export function formatDotDate(value: string | null | undefined): string {
  const parts = shanghaiDateParts(value)
  if (!parts) return '待定'
  return `${parts.month}.${parts.day}`
}

/** `12月1日`；跨年时补年份（`2027年1月20日`）。 */
export function formatMilestoneDate(
  value: string | null | undefined,
  now = new Date(),
): string {
  const parts = shanghaiDateParts(value)
  if (!parts) return '待定'
  const current = shanghaiDateParts(now.toISOString())
  const prefix = current && parts.year !== current.year ? `${parts.year}年` : ''
  return `${prefix}${parts.month}月${parts.day}日`
}

export const SCHEDULE_MILESTONES = [
  { key: 'applyOpen', label: '报名开放' },
  { key: 'applyClose', label: '报名截止' },
  { key: 'startAt', label: '开赛' },
  { key: 'teamDeadline', label: '组队截止' },
  { key: 'challengeFreezeAt', label: '命题冻结' },
  { key: 'workDeadline', label: '作品截止' },
  { key: 'scoreDeadline', label: '评分截止' },
  { key: 'settleDate', label: '结算日' },
] as const satisfies ReadonlyArray<{ key: keyof SeasonSchedule; label: string }>

export function nextMilestone(
  schedule: SeasonSchedule | null | undefined,
  now = new Date(),
): { key: keyof SeasonSchedule; label: string; at: string } | null {
  if (!schedule) return null
  for (const milestone of SCHEDULE_MILESTONES) {
    const at = schedule[milestone.key]
    if (at && new Date(at).getTime() > now.getTime()) {
      return { key: milestone.key, label: milestone.label, at }
    }
  }
  const last = SCHEDULE_MILESTONES[SCHEDULE_MILESTONES.length - 1]
  const at = schedule[last.key]
  return at ? { key: last.key, label: last.label, at } : null
}

export function currentMilestoneIndex(
  schedule: SeasonSchedule | null | undefined,
  now = new Date(),
): number {
  if (!schedule) return -1
  let index = -1
  SCHEDULE_MILESTONES.forEach((milestone, i) => {
    const at = schedule[milestone.key]
    if (at && new Date(at).getTime() <= now.getTime()) index = i
  })
  return index
}

export function seasonSpanLabel(schedule: SeasonSchedule | null | undefined): string | null {
  if (!schedule) return null
  return `${formatDate(schedule.startAt)} — ${formatDate(schedule.workDeadline)}`
}

export function participantLabel(season: SeasonSummary): string {
  if (season.participantCapacity === null) return `${season.participantCount} 人参与 · 不限名额`
  return `${season.participantCount} / ${season.participantCapacity} 人`
}

export function applicationWindowReason(season: SeasonDetail): string | null {
  if (season.status === SeasonStatus.Suspended) return '赛季已暂停，报名暂时关闭'
  if (season.status === SeasonStatus.Cancelled) return '赛季已取消'
  if (season.applicationWindow.isOpen) return null
  if (!season.applicationWindow.opensAt) return '报名时间待公布'
  const now = Date.now()
  const opensAt = new Date(season.applicationWindow.opensAt).getTime()
  if (now < opensAt) return `报名将于 ${formatDateTime(season.applicationWindow.opensAt)} 开放`
  return '报名已截止'
}

export type CreateSeasonApplicationBody = {
  skills: string
  experience: string
  themes: string[]
  teamIntent: string
  acceptsSolo: boolean
  availability: string
  cityMode: string
  contact: { wechat?: string; phone?: string }
  visibility?: string
  agreementVersion: string
}
