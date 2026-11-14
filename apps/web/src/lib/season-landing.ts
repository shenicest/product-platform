import {
  seasonTypeLabel,
  type SeasonDetail,
} from '@/lib/boomland'
import { SeasonStatus } from '@shenicest/shared'

/**
 * 火热赛季落地页的纯展示模型。
 *
 * 设计稿（BoomLand V2.6）的赛季卡是一张「票券」：编号、状态、标题、主办方、
 * 一句话介绍、类型 / 命题数、时间窗、名额进度与一个 CTA。这里的职责只是把
 * `SeasonDetail` 映射成这些槽位，**不做任何业务判断** —— 报名是否开放仍然
 * 来自后端返回的 `applicationWindow.isOpen`。
 *
 * 设计稿卡片上还有「项目数 / 作品数 / 奖励池」三项，当前 `SeasonSummary`
 * 不提供这些字段（见 docs/boomland/design-v26-conflicts.md），所以这里只
 * 展示真实存在的「命题数」。
 */

export type SeasonGroup = '即将开始' | '报名中' | '进行中'

export const SEASON_GROUPS: readonly SeasonGroup[] = ['即将开始', '报名中', '进行中']

/** 卡片排序：阶段越早越靠前（与设计稿 `activityOrder` 一致）。 */
const GROUP_RANK: Record<SeasonGroup, number> = {
  即将开始: 0,
  报名中: 1,
  进行中: 2,
}

export function sortCardsByStage<T extends { group: SeasonGroup }>(
  cards: readonly T[],
): T[] {
  return [...cards].sort(
    (left, right) => GROUP_RANK[left.group] - GROUP_RANK[right.group],
  )
}

export type SeasonCardView = {
  id: number
  code: string
  name: string
  organizer: string
  description: string
  typeLabel: string
  statusLabel: string
  /** 票券卡上的状态文案：设计稿卡片把「即将开始」写作「未开始」。 */
  ticketStatusLabel: string
  statusTone: 'pink' | 'yellow' | 'gray'
  registrationLabel: string | null
  registrationOpen: boolean
  /** 未开始（即将开始）的赛季用另一张封面。 */
  upcoming: boolean
  group: SeasonGroup
  dateRange: string
  participantCount: number
  participantCapacity: number | null
  challengeCount: number
  pinned: boolean
  href: string
}

/** 设计稿给的两张赛季封面：已开赛 / 未开赛。 */
export const SEASON_COVER_ACTIVE =
  'https://shenicest-projects-1422809617.cos.ap-shanghai.myqcloud.com/assets/product-platform/boomland/cover1.png'
export const SEASON_COVER_UPCOMING =
  'https://shenicest-projects-1422809617.cos.ap-shanghai.myqcloud.com/assets/product-platform/boomland/cover2.png'

const SHANGHAI_DATE = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** `2026-12-19`：设计稿票券上的日期格式（与站内 `2026.12.19` 不同）。 */
export function isoDate(value: string | null | undefined): string {
  if (!value) return '待定'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '待定'
  const parts = SHANGHAI_DATE.formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

export function dateRangeLabel(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  return `${isoDate(start)} — ${isoDate(end)}`
}

export function seasonOrganizerLabel(season: SeasonDetail): string {
  const names = season.organizerOrgs.map((org) => org.name.trim()).filter(Boolean)
  return names.length > 0 ? names.join(' × ') : 'BoomLand'
}

export function seasonStatusView(status: string): {
  label: string
  tone: 'pink' | 'yellow' | 'gray'
} {
  switch (status) {
    case SeasonStatus.Active:
      return { label: '进行中', tone: 'pink' }
    case SeasonStatus.Upcoming:
      return { label: '即将开始', tone: 'yellow' }
    case SeasonStatus.Suspended:
      return { label: '已暂停', tone: 'gray' }
    case SeasonStatus.Cancelled:
      return { label: '已取消', tone: 'gray' }
    default:
      return { label: '草稿', tone: 'gray' }
  }
}

/** 报名窗口的人话标签；`null` 表示还没有任何报名时间可展示。 */
export function registrationView(season: SeasonDetail): {
  label: string | null
  open: boolean
} {
  if (season.applicationWindow.isOpen) return { label: '报名中', open: true }
  if (!season.applicationWindow.opensAt) return { label: null, open: false }
  const opensAt = new Date(season.applicationWindow.opensAt).getTime()
  if (Number.isNaN(opensAt)) return { label: null, open: false }
  return {
    label: opensAt > Date.now() ? '报名未开放' : '报名已截止',
    open: false,
  }
}

export function seasonGroup(season: SeasonDetail): SeasonGroup {
  const registration = registrationView(season)
  if (registration.open) return '报名中'
  if (season.status === SeasonStatus.Upcoming) return '即将开始'
  return '进行中'
}

export function toSeasonCard(season: SeasonDetail): SeasonCardView {
  const status = seasonStatusView(season.status)
  const registration = registrationView(season)
  return {
    id: season.id,
    code: season.code,
    name: season.name,
    organizer: seasonOrganizerLabel(season),
    description:
      season.intro?.trim() ||
      (season.themes.length > 0 ? season.themes.join(' / ') : '把真实问题做成有人用的东西。'),
    typeLabel: seasonTypeLabel(season.type),
    statusLabel: status.label,
    ticketStatusLabel:
      season.status === SeasonStatus.Upcoming ? '未开始' : status.label,
    statusTone: status.tone,
    registrationLabel: registration.label,
    registrationOpen: registration.open,
    upcoming: season.status === SeasonStatus.Upcoming,
    group: seasonGroup(season),
    dateRange: dateRangeLabel(season.schedule?.startAt, season.schedule?.workDeadline),
    participantCount: season.participantCount,
    participantCapacity: season.participantCapacity,
    challengeCount: season.publishedChallengeCount,
    pinned: season.pinned,
    href: `/seasons/${season.id}`,
  }
}

/**
 * 首屏推荐位：置顶优先；否则取「进行中 + 报名开放」里参与人数最多的一场，
 * 再退到第一场。与设计稿 `selectedFeaturedEvent()` 的口径一致。
 */
export function featuredIndex(cards: readonly SeasonCardView[]): number {
  if (cards.length === 0) return 0
  const pinned = cards.findIndex((card) => card.pinned)
  if (pinned >= 0) return pinned
  const openActive = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.registrationOpen)
    .sort((a, b) => b.card.participantCount - a.card.participantCount)
  if (openActive.length > 0) return openActive[0].index
  return 0
}

/**
 * 时间轴当前节点：最后一个已经到期的节点；还没开始的返回 -1。
 *
 * 放在 lib 而不是组件里，是为了让「读取当前时间」只发生在一个可测试的
 * 纯函数边界上（React 的 purity 规则不允许在渲染期直接调 `Date.now()`）。
 */
export function currentTimelineIndex(
  dates: ReadonlyArray<string | null | undefined>,
): number {
  const now = Date.now()
  let current = -1
  dates.forEach((value, index) => {
    if (!value) return
    const at = new Date(value).getTime()
    if (!Number.isNaN(at) && at <= now) current = index
  })
  return current
}
