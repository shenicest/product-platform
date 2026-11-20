import { SeasonStatus, type SeasonSchedule } from '@shenicest/shared'
import type { ChipTone } from '@/components/ui/chip'
import {
  formatDate,
  formatMilestoneDate,
  participantLabel,
  seasonSpanLabel,
  seasonTypeLabel,
  type SeasonDetail,
  type SeasonSummary,
} from '@/lib/boomland'
import { seasonOrganizerLabel, seasonStatusView } from '@/lib/season-landing'
import { seasonRegistration } from '@/lib/season-registration'

/**
 * 首页「当前赛季」入口的纯展示模型。
 *
 * 首页不是赛季上下文，它只需要一个「现在最值得去的那一季」：
 * 名称、状态、报名窗口、赛程、规模，以及一个去 `/seasons/:id` 的入口。
 * 业务判断（报名状态）仍然来自 `lib/season-registration.ts`，
 * 这里只负责选人 + 映射文案，方便单测。
 *
 * 为什么不在组件里直接挑「第一个赛季」：列表接口的排序是
 * 「置顶 → 进行中 → 即将开始」，但首页不应该依赖某个接口的默认排序 ——
 * 一旦后端调整排序，首页的入口就会静默换成另一场赛季。规则写在这里，
 * 后端排序只当兜底。
 */

const STATUS_TONE: Record<'pink' | 'yellow' | 'gray', ChipTone> = {
  pink: 'accent',
  yellow: 'warning',
  gray: 'neutral',
}

export type SeasonSpotlight = {
  id: number
  code: string
  name: string
  /** 去掉名称前缀「BoomLand」后的展示名。 */
  displayName: string
  organizer: string
  intro: string
  href: string
  /** 赛季 / 黑客松；用来解释「这一季」是什么形态。 */
  typeLabel: string
  statusLabel: string
  statusTone: ChipTone
  registrationLabel: string
  registrationTone: ChipTone
  registrationOpen: boolean
  /** 票券脚注：报名开放 / 截止的具体日期，或「报名已截止」。 */
  registrationNote: string
  /** 活动区间（开赛 — 作品截止），`2026.11.01 — 2026.12.20`。 */
  activityRange: string
  /** 报名窗口，`2026.10.12 — 2026.10.26`。 */
  registrationRange: string
  participantLabel: string
  challengeCount: number
  /** 原始比赛状态；组件用它区分 LIVE / 筹备 / 报名中。 */
  status: string
  /** 赛季主题；首页只展示业务配置过的主题标签。 */
  themes: string[]
  /** 是否平台置顶；首页副标题里作为一枚状态词。 */
  pinned: boolean
  /** 作品截止时间（倒计时目标）；赛程缺失时为 null。 */
  workDeadline: string | null
  /** 交付窗口第几天（从 1 起算）；未开赛或赛程缺失时为 0。 */
  dayIndex: number
  /** 交付窗口总天数（开赛 → 作品截止）。 */
  dayTotal: number
  /** 同一时间可见的其他赛季，供首页「并行 N 个赛季」入口使用。 */
  parallelSeasons: SeasonSpotlightParallel[]
}

export type SeasonSpotlightParallel = {
  id: number
  name: string
  city: string | null
  typeLabel: string
  statusLabel: string
  href: string
}

/**
 * 当前赛季的选择顺序：平台置顶 → 进行中 → 即将开始。
 *
 * 只接收公开列表（接口已过滤草稿 / 取消），所以这里不重复判断状态合法性；
 * 没有可展示的赛季时返回 null，由首页渲染「新一季筹备中」的空态入口。
 */
export function pickCurrentSeason<T extends Pick<SeasonSummary, 'pinned' | 'status'>>(
  items: readonly T[],
): T | null {
  if (items.length === 0) return null

  const pinned = items.find((item) => item.pinned)
  if (pinned) return pinned

  const active = items.find((item) => item.status === SeasonStatus.Active)
  if (active) return active

  const upcoming = items.find((item) => item.status === SeasonStatus.Upcoming)
  return upcoming ?? null
}

function registrationNote(registration: {
  state: 'not-open' | 'open' | 'closed'
  opensAt: string | null
  closesAt: string | null
}): string {
  if (registration.state === 'closed') return '报名已截止'
  if (registration.state === 'not-open') {
    return registration.opensAt
      ? `报名 ${formatMilestoneDate(registration.opensAt)} 开放`
      : '报名时间待公布'
  }
  return registration.closesAt
    ? `报名截止 ${formatMilestoneDate(registration.closesAt)}`
    : '报名进行中'
}

function registrationRangeLabel(registration: {
  opensAt: string | null
  closesAt: string | null
}): string {
  if (!registration.opensAt && !registration.closesAt) return '报名时间待公布'
  return `${formatDate(registration.opensAt)} — ${formatDate(registration.closesAt)}`
}

const DAY_MS = 86_400_000

/**
 * 赛季进行到第几天。
 *
 * 用「开赛 → 作品截止」作为交付窗口：报名在前、评分与结算在后，选手
 * 感知的「赛季进行时」就是这一段。`dayIndex` 按整日向下取整（开赛当天
 * 即第 1 天），超过作品截止后夹到总天数，首页不会出现 DAY 41 / 29 的读数。
 */
export function seasonDayProgress(
  schedule: SeasonSchedule | null | undefined,
  now = new Date(),
): { dayIndex: number; dayTotal: number } {
  const start = schedule?.startAt ? new Date(schedule.startAt).getTime() : NaN
  const end = schedule?.workDeadline ? new Date(schedule.workDeadline).getTime() : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { dayIndex: 0, dayTotal: 0 }
  }

  const dayTotal = Math.max(1, Math.ceil((end - start) / DAY_MS))
  if (now.getTime() < start) return { dayIndex: 0, dayTotal }

  const elapsedDays = Math.floor((now.getTime() - start) / DAY_MS)
  return {
    dayIndex: Math.min(dayTotal, Math.max(1, elapsedDays)),
    dayTotal,
  }
}

function toParallelSeasonView(season: SeasonSummary): SeasonSpotlightParallel {
  return {
    id: season.id,
    name: season.name,
    city: season.city,
    typeLabel: seasonTypeLabel(season.type),
    statusLabel: seasonStatusView(season.status).label,
    href: `/seasons/${season.id}`,
  }
}

/**
 * 赛季 → 首页入口视图。
 *
 * `detail` 可选：首页只拿列表也能渲染（`intro` / `applicationWindow` 缺失时
 * 用赛程与主题兜底），详情请求失败不应该让首页的入口整块消失。
 */
export function toSeasonSpotlight(
  season: SeasonSummary,
  detail: SeasonDetail | null = null,
  options: {
    /** 与当前赛季同时在线的其他赛季；由服务端列表接口直接传入。 */
    parallelSeasons?: readonly SeasonSummary[]
    /** 注入「现在」便于单测；页面侧留空即可。 */
    now?: Date
  } = {},
): SeasonSpotlight {
  const status = seasonStatusView(season.status)
  const registration = seasonRegistration(detail ?? season)
  const themes = season.themes ?? []
  const displayName = season.name.replace(/^boomland\s*/i, '').trim() || season.name
  const dayProgress = seasonDayProgress(season.schedule, options.now)

  return {
    id: season.id,
    code: season.code,
    name: season.name,
    displayName,
    organizer: seasonOrganizerLabel(season),
    intro:
      detail?.intro?.trim() ||
      (themes.length > 0
        ? themes.join(' / ')
        : '把真实问题做成有人用、可交付的东西。'),
    href: `/seasons/${season.id}`,
    typeLabel: seasonTypeLabel(season.type),
    statusLabel: status.label,
    statusTone: STATUS_TONE[status.tone],
    registrationLabel: registration.label,
    registrationTone: registration.tone,
    registrationOpen: registration.state === 'open',
    registrationNote: registrationNote(registration),
    activityRange: seasonSpanLabel(season.schedule) ?? '赛程待定',
    registrationRange: registrationRangeLabel(registration),
    participantLabel: participantLabel(season),
    challengeCount: season.publishedChallengeCount,
    status: season.status,
    themes,
    pinned: season.pinned,
    workDeadline: season.schedule?.workDeadline ?? null,
    dayIndex: dayProgress.dayIndex,
    dayTotal: dayProgress.dayTotal,
    parallelSeasons: (options.parallelSeasons ?? [])
      .filter((item) => item.id !== season.id)
      .map(toParallelSeasonView),
  }
}
