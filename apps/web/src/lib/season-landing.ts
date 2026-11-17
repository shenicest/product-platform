import {
  myApplicationMeta,
  seasonTypeLabel,
  type SeasonDetail,
} from '@/lib/boomland'
import { SeasonStatus } from '@shenicest/shared'
import type { ChipTone } from '@/components/ui/chip'
import {
  seasonApplicationCta,
  seasonRegistration,
  type SeasonRegistrationState,
} from '@/lib/season-registration'

/**
 * 火热赛季落地页的纯展示模型。
 *
 * 设计稿（BoomLand V2.6）的赛季卡是一张「票券」：编号、状态、标题、主办方、
 * 一句话介绍、类型 / 命题数、时间窗、名额进度与一个 CTA。这里的职责只是把
 * `SeasonDetail` 映射成这些槽位，**不做任何业务判断** —— 报名是否开放来自
 * `lib/season-registration.ts`，用户能不能报名、点哪里去来自同一处的
 * `seasonApplicationCta()`。
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
  /** 赛季报名状态：未开放 / 报名中 / 报名已截止。 */
  registrationState: SeasonRegistrationState
  registrationLabel: string
  registrationTone: ChipTone
  registrationOpen: boolean
  /** 我的报名状态徽章（未报名时不出徽章）：审核中 / 候补中 / 已报名 / 已撤回 / 未通过。 */
  applicationLabel: string | null
  /** 票券 CTA：立即报名 / 报名审核中 / 候补中 / 查看我的报名 / 重新报名 / 查看未通过原因。 */
  ctaLabel: string | null
  /** 只在「报名中」且确实可点时才有值；其余情况卡片不展示按钮。 */
  ctaHref: string | null
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

export function seasonGroup(season: SeasonDetail): SeasonGroup {
  if (seasonRegistration(season).state === 'open') return '报名中'
  if (season.status === SeasonStatus.Upcoming) return '即将开始'
  return '进行中'
}

/**
 * 赛季详情 → 票券卡槽位。
 *
 * `viewer` 是「当前看页面的人」：未登录时没有报名状态（`applicationStatus`
 * 为 null）；登录后由页面把该赛季的报名状态查出来传进来。票券 CTA 的文案
 * 完全由 `seasonApplicationCta()` 决定，组件不再自己拼条件。
 *
 * 票券卡只在「报名中」才给按钮：未开放 / 已截止时卡片只做导航入口，
 * 不给一个点了也没用的按钮，所以 `ctaLabel` / `ctaHref` 此时都是 null
 * （详情页海报仍会渲染禁用票券并说明原因，那里有空间解释）。
 */
export function toSeasonCard(
  season: SeasonDetail,
  viewer: { isLoggedIn?: boolean; applicationStatus?: string | null } = {},
): SeasonCardView {
  const status = seasonStatusView(season.status)
  const registration = seasonRegistration(season)
  const applicationStatus = viewer.applicationStatus ?? null
  const registrationOpen = registration.state === 'open'
  const cta = seasonApplicationCta({
    seasonId: season.id,
    seasonStatus: season.status,
    isLoggedIn: viewer.isLoggedIn ?? false,
    registration,
    applicationStatus,
  })
  // 暂停 / 取消的赛季即使窗口还开着也不能报名，同样不给按钮。
  const ctaVisible = registrationOpen && cta.href !== null
  const application =
    applicationStatus === null ? null : myApplicationMeta(applicationStatus)
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
    registrationState: registration.state,
    registrationLabel: registration.label,
    registrationTone: registration.tone,
    registrationOpen,
    applicationLabel: application?.label ?? null,
    ctaLabel: ctaVisible ? cta.label : null,
    ctaHref: ctaVisible ? cta.href : null,
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
