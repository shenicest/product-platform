import { SeasonStatus } from '@shenicest/shared'
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

/**
 * 赛季 → 首页入口视图。
 *
 * `detail` 可选：首页只拿列表也能渲染（`intro` / `applicationWindow` 缺失时
 * 用赛程与主题兜底），详情请求失败不应该让首页的入口整块消失。
 */
export function toSeasonSpotlight(
  season: SeasonSummary,
  detail: SeasonDetail | null = null,
): SeasonSpotlight {
  const status = seasonStatusView(season.status)
  const registration = seasonRegistration(detail ?? season)
  const themes = season.themes ?? []
  const displayName = season.name.replace(/^boomland\s*/i, '').trim() || season.name

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
  }
}
