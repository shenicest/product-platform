import { SeasonApplicationStatus, SeasonStatus, type WechatStatus } from '@shenicest/shared'
import type { ChipTone } from '@/components/ui/chip'
import {
  applicationStatusMeta,
  formatDateTime,
  seasonStatusMeta,
  seasonTypeLabel,
  wechatStatusLabel,
  type MySeasonApplication,
  type SeasonSummary,
} from '@/lib/boomland'
import type { SearchParams } from '@/lib/project-filters'

/**
 * 个人中心「报名」tab 的纯函数层。
 *
 * 这一层只做「数据 → 文案」的映射，不碰 React，也不碰网络：
 * 表格行、卡片状态、截止提示都是可单测的字符串结果，
 * Server Component 只负责把它们摆进 DOM。
 */

/** 已报名表格每页条数。与旧「我的报名」页保持一致。 */
export const MY_APPLICATIONS_PAGE_SIZE = 10

/** 「公开的赛季」一次最多展示多少张卡。 */
export const PUBLIC_SEASON_LIMIT = 12

/** 空单元格的占位符：整站统一用全角破折号。 */
const EMPTY_CELL = '—'

// ---------------------------------------------------------------------------
// 已报名表格
// ---------------------------------------------------------------------------

/**
 * 表头：与设计稿逐列一致（7 列）。
 *
 * 撤回入口放在「审核状态」格里而不是单独加一列 —— 设计稿的列数固定为 7，
 * 而「能不能撤回」本来就是审核状态的一部分。
 */
export const MY_APPLICATION_COLUMNS = [
  { key: 'season', label: '赛季' },
  { key: 'submittedAt', label: '提交时间' },
  { key: 'reviewStatus', label: '审核状态' },
  { key: 'reviewNote', label: '审核说明' },
  { key: 'wechat', label: '微信群' },
  { key: 'seasonCode', label: '赛季标识' },
  { key: 'agreementVersion', label: '条款版本' },
] as const

export type MyApplicationColumnKey = (typeof MY_APPLICATION_COLUMNS)[number]['key']

/** 表格下方那行小字。文案来自设计稿，逐字保留。 */
export const APPLICATIONS_FOOTNOTE =
  '审核前可以撤回；已通过的选手可在组队截止前退出赛季，退出不删除作品、积分与 Track Record（待定 15）。报名用的拉群联系方式只有主办方和平台管理员可见。'

/** 审核说明：没写就是「—」，不留空单元格。 */
export function reviewNoteText(reason: string | null | undefined): string {
  const value = reason?.trim()
  return value ? value : EMPTY_CELL
}

/**
 * 微信群一列：只有真选手（存在选手行）才有微信群状态，
 * 非选手显示「—」——不能让人误以为「没进群」等于「没报名」。
 */
export function wechatCellLabel(item: MySeasonApplication): string {
  return item.wechatStatus ? wechatStatusLabel(item.wechatStatus) : EMPTY_CELL
}

/** 审核出结果前可撤回的状态集合。 */
export const WITHDRAWABLE_APPLICATION_STATUSES: readonly string[] = [
  SeasonApplicationStatus.Submitted,
  SeasonApplicationStatus.Pending,
  SeasonApplicationStatus.Waitlisted,
]

export function canWithdrawApplication(status: string): boolean {
  return WITHDRAWABLE_APPLICATION_STATUSES.includes(status)
}

/** 表格一行：已经拆成 7 列需要的展示值。 */
export type MyApplicationRow = {
  applicationId: number
  seasonId: number
  seasonName: string
  seasonCode: string
  /** 赛季详情页地址（`/seasons?season=` 是现有赛季页的定位方式）。 */
  seasonHref: string
  submittedAt: string
  status: string
  statusLabel: string
  statusTone: ChipTone
  reviewNote: string
  wechat: string
  wechatStatus: WechatStatus | null
  agreementVersion: string
  canWithdraw: boolean
}

export function myApplicationRow(item: MySeasonApplication): MyApplicationRow {
  const { application, season } = item
  const status = applicationStatusMeta(application.status)
  return {
    applicationId: application.id,
    seasonId: season.id,
    seasonName: season.name,
    seasonCode: season.code,
    seasonHref: `/seasons?season=${season.id}`,
    submittedAt: formatDateTime(application.createdAt),
    status: application.status,
    statusLabel: status.label,
    statusTone: status.tone,
    reviewNote: reviewNoteText(application.reviewReason),
    wechat: wechatCellLabel(item),
    wechatStatus: item.wechatStatus,
    agreementVersion: application.agreementVersion?.trim() || EMPTY_CELL,
    canWithdraw: canWithdrawApplication(application.status),
  }
}

export function myApplicationRows(
  items: readonly MySeasonApplication[],
): MyApplicationRow[] {
  return items.map(myApplicationRow)
}

// ---------------------------------------------------------------------------
// 日期文案：复用现有 formatter，不另写 Intl
// ---------------------------------------------------------------------------

/**
 * `10月12日 10:00`。
 *
 * 直接复用 `formatDateTime`（已按 Asia/Shanghai 格式化并补零），
 * 只把它的输出 `2026.10.12 10:00` 重排成设计稿要的中文写法 ——
 * 这样时区、非法值、缺省值三套边界都只有一份实现。
 */
export function monthDayTimeLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const stamp = formatDateTime(value)
  const [datePart, timePart] = stamp.split(' ')
  const segments = datePart?.split('.') ?? []
  if (segments.length !== 3 || !timePart) return null
  const [, month, day] = segments
  const monthNumber = Number(month)
  const dayNumber = Number(day)
  if (!Number.isFinite(monthNumber) || !Number.isFinite(dayNumber)) return null
  return `${monthNumber}月${dayNumber}日 ${timePart}`
}

/**
 * `报名 10月12日 10:00 — 10月26日 23:59（北京时间）`。
 *
 * 赛程未排期时只说「报名时间待公布」，不拼半截区间。
 */
export function applicationWindowLabel(season: SeasonSummary): string {
  const opens = monthDayTimeLabel(season.schedule?.applyOpen)
  const closes = monthDayTimeLabel(season.schedule?.applyClose)
  if (!opens && !closes) return '报名时间待公布'
  return `报名 ${opens ?? '待定'} — ${closes ?? '待定'}（北京时间）`
}

// ---------------------------------------------------------------------------
// 报名窗口状态
// ---------------------------------------------------------------------------

export type ApplicationWindowState =
  | 'open'
  | 'not-open-yet'
  | 'closed'
  | 'unpublished'
  | 'suspended'
  | 'cancelled'

/**
 * 卡片上「报名状态」的那枚胶囊。
 *
 * 赛季被暂停 / 取消时优先说赛季状态：这两种情况下报名窗口的日期已经没有意义。
 */
export function applicationWindowState(
  season: SeasonSummary,
  now: Date = new Date(),
): ApplicationWindowState {
  if (season.status === SeasonStatus.Cancelled) return 'cancelled'
  if (season.status === SeasonStatus.Suspended) return 'suspended'

  const opensAt = season.schedule?.applyOpen
    ? new Date(season.schedule.applyOpen).getTime()
    : null
  const closesAt = season.schedule?.applyClose
    ? new Date(season.schedule.applyClose).getTime()
    : null

  if (closesAt === null || Number.isNaN(closesAt)) return 'unpublished'
  if (closesAt <= now.getTime()) return 'closed'
  if (opensAt !== null && !Number.isNaN(opensAt) && opensAt > now.getTime()) {
    return 'not-open-yet'
  }
  return 'open'
}

const WINDOW_STATE_META: Record<
  ApplicationWindowState,
  { label: string; tone: ChipTone }
> = {
  open: { label: '报名中', tone: 'success' },
  'not-open-yet': { label: '报名未开始', tone: 'sky' },
  closed: { label: '报名已截止', tone: 'neutral' },
  unpublished: { label: '报名时间待公布', tone: 'neutral' },
  suspended: { label: '赛季已暂停', tone: 'warning' },
  cancelled: { label: '赛季已取消', tone: 'danger' },
}

export function applicationWindowMeta(state: ApplicationWindowState): {
  label: string
  tone: ChipTone
} {
  return WINDOW_STATE_META[state]
}

/** 卡片底部那行截止提示。 */
export type DeadlineHint = {
  /** 是否已经不能再报名 —— 决定要不要挂 🔒。 */
  closed: boolean
  text: string
}

export function applyDeadlineHint(
  season: SeasonSummary,
  now: Date = new Date(),
): DeadlineHint {
  const state = applicationWindowState(season, now)
  const opens = monthDayTimeLabel(season.schedule?.applyOpen)
  const closes = monthDayTimeLabel(season.schedule?.applyClose)

  switch (state) {
    case 'cancelled':
      return { closed: true, text: '赛季已取消，报名不再开放' }
    case 'suspended':
      return { closed: true, text: '赛季已暂停，报名暂时关闭' }
    case 'unpublished':
      return { closed: false, text: '报名时间待公布' }
    case 'closed':
      return { closed: true, text: `报名已于 ${closes ?? '截止时间'} 截止` }
    case 'not-open-yet':
      return { closed: false, text: `报名将于 ${opens ?? '待定'} 开放` }
    default:
      return { closed: false, text: `报名截止 ${closes ?? '待定'}` }
  }
}

// ---------------------------------------------------------------------------
// 公开赛季卡片
// ---------------------------------------------------------------------------

/**
 * `已通过 19 / 名额 20`。
 *
 * 语义与 `participantLabel()` 完全一致（`participantCapacity === null` 即不限），
 * 只是设计稿把这两个数分别标成「已通过」与「名额」，所以在这里派生一版文案；
 * 数字来源仍是 `participantCount` / `participantCapacity`。
 */
export function participantProgressLabel(
  season: Pick<SeasonSummary, 'participantCount' | 'participantCapacity'>,
): string {
  if (season.participantCapacity === null) {
    return `已通过 ${season.participantCount} 人 · 名额不限`
  }
  return `已通过 ${season.participantCount} / 名额 ${season.participantCapacity}`
}

export type PublicSeasonCard = {
  id: number
  code: string
  name: string
  typeLabel: string
  href: string
  seasonStatus: string
  seasonStatusLabel: string
  seasonStatusTone: ChipTone
  windowState: ApplicationWindowState
  windowLabel: string
  windowTone: ChipTone
  /** `报名 10月12日 10:00 — 10月26日 23:59（北京时间）` */
  applyWindow: string
  /** `已通过 19 / 名额 20` */
  participants: string
  pinned: boolean
  deadline: DeadlineHint
}

/**
 * 公开赛季卡片的展示数据。
 *
 * 置顶排在最前：后端已经这样排序，这里再做一次稳定排序 ——
 * 卡片顺序因此不依赖接口实现，单测也能直接断言。
 */
export function publicSeasonCards(
  seasons: readonly SeasonSummary[],
  now: Date = new Date(),
): PublicSeasonCard[] {
  return [...seasons]
    .sort((left, right) => Number(right.pinned) - Number(left.pinned))
    .map((season) => {
      const status = seasonStatusMeta(season.status)
      const windowState = applicationWindowState(season, now)
      const windowMeta = applicationWindowMeta(windowState)
      return {
        id: season.id,
        code: season.code,
        name: season.name,
        typeLabel: seasonTypeLabel(season.type),
        href: `/seasons?season=${season.id}`,
        seasonStatus: season.status,
        seasonStatusLabel: status.label,
        seasonStatusTone: status.tone,
        windowState,
        windowLabel: windowMeta.label,
        windowTone: windowMeta.tone,
        applyWindow: applicationWindowLabel(season),
        participants: participantProgressLabel(season),
        pinned: season.pinned,
        deadline: applyDeadlineHint(season, now),
      }
    })
}

// ---------------------------------------------------------------------------
// 分页参数
// ---------------------------------------------------------------------------

/** `?page=` → 从 1 开始的整数；非法值一律回落到第 1 页。 */
export function parseApplicationsPage(searchParams: SearchParams): number {
  const raw = searchParams.page
  const value = Array.isArray(raw) ? raw[0] : raw
  const parsed = Number(value ?? '1')
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1
}
