import {
  SeasonApplicationStatus,
  SeasonParticipantStatus,
  SeasonStatus,
  type WechatStatus,
} from '@shenicest/shared'
import type { ChipTone } from '@/components/ui/chip'
import {
  applicationStatusMeta,
  formatDateTime,
  myApplicationState,
  seasonStatusMeta,
  seasonTypeLabel,
  wechatStatusLabel,
  type MySeasonApplication,
  type SeasonSummary,
} from '@/lib/boomland'
import type { SearchParams } from '@/lib/project-filters'
import {
  seasonApplicationCta,
  seasonRegistration,
  type SeasonRegistrationState,
} from '@/lib/season-registration'

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
 * 表头：赛季 / 提交时间 / 审核状态 / 审核说明 / 微信群 / 赛季标识 / 条款版本 / 操作。
 *
 * 报名者能做的动作（撤回报名 / 退出赛季 / 重新报名）**单独占一列**（而不是
 * 挂在「审核状态」格里）：挂进状态格时，状态胶囊 + 按钮在同一格里上下堆叠，
 * 窄屏下按钮会被挤到下一行，看起来像「这条报名多了一行」。单独一列还能让
 * 操作区按内容收缩（`w-px`），不参与表格的等分拉伸。
 */
export const MY_APPLICATION_COLUMNS = [
  { key: 'season', label: '赛季' },
  { key: 'submittedAt', label: '提交时间' },
  { key: 'reviewStatus', label: '审核状态' },
  { key: 'reviewNote', label: '审核说明' },
  { key: 'wechat', label: '微信群' },
  { key: 'seasonCode', label: '赛季标识' },
  { key: 'agreementVersion', label: '条款版本' },
  { key: 'actions', label: '操作' },
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

/**
 * 「已退赛」：报名记录仍是 `accepted`，选手行被置为 `withdrawn`。
 *
 * 与「已撤回」严格区分：撤回是审核前反悔，窗口内可以重新报名；退赛是已通过
 * 报名后在组队截止前离开赛季，名额会按顺序递补给候补的人。
 */
export const EXITED_SEASON_STATUS: { label: string; tone: ChipTone } = {
  label: '已退赛',
  tone: 'neutral',
}

/**
 * 审核状态格。
 *
 * 退赛优先于报名审核结果 —— 一条 `accepted` 的报名在选手退出后必须显示
 * 「已退赛」，否则用户会以为自己还在赛季里。
 */
export function applicationStatusCell(item: MySeasonApplication) {
  if (item.participantStatus === SeasonParticipantStatus.Withdrawn) {
    return EXITED_SEASON_STATUS
  }
  return applicationStatusMeta(item.application.status)
}

/** 组队截止后不能自己退赛，只能找主办方 —— 与后端 409 同一句话。 */
export const SEASON_EXIT_CLOSED_HINT = '组队已截止，退出请联系主办方'

export type SeasonExitEntry = {
  /** 报名已通过、选手仍是 active、且组队截止前 → 可以退出赛季。 */
  canExitSeason: boolean
  /** 曾经可以退、但组队已截止时给一句原因；其余情况为 null。 */
  exitBlockedReason: string | null
}

/**
 * 能不能退出赛季。
 *
 * 三个条件缺一不可：报名已 `accepted`、选手行仍是 `active`、组队截止时间
 * 未过。组队截止后只能由主办方处理（后端 `withdrawParticipant` 同样返回
 * `409 PARTICIPANT_WITHDRAW_LOCKED`）。
 *
 * 赛程没有排组队截止时间时按「还能退」处理：后端也只在**有截止时间且已过**
 * 时拒绝，两边必须同一套判断。
 */
export function seasonExitEntry(
  item: MySeasonApplication,
  now: Date = new Date(),
): SeasonExitEntry {
  const isActiveParticipant = item.participantStatus === SeasonParticipantStatus.Active
  const accepted = item.application.status === SeasonApplicationStatus.Accepted
  if (!isActiveParticipant || !accepted) {
    return { canExitSeason: false, exitBlockedReason: null }
  }

  const deadline = item.season.schedule?.teamDeadline
  const deadlineTime = deadline ? new Date(deadline).getTime() : null
  if (deadlineTime !== null && !Number.isNaN(deadlineTime) && deadlineTime <= now.getTime()) {
    return { canExitSeason: false, exitBlockedReason: SEASON_EXIT_CLOSED_HINT }
  }
  return { canExitSeason: true, exitBlockedReason: null }
}

/**
 * 「已撤回」之后还能不能再报名。
 *
 * 复用赛季卡片 / 海报那套 CTA 推导（`seasonApplicationCta`）：
 *   · 窗口开放 → 回报名表单的地址，重新提交会复用同一条记录（后端行为）；
 *   · 窗口没开 / 赛季暂停或取消 → 不给入口，只给一句原因
 *     （报名已截止 / 报名 X 开放 / 报名已暂停 / 赛季已取消）。
 *
 * 为什么不做成「永远可点」：点了也只会落到报名页的「暂不可报名」面板，
 * 和赛季卡片上那颗禁用 CTA 是同一个坑，两边必须说同一句话。
 */
export function reapplyEntry(
  item: MySeasonApplication,
  now: Date = new Date(),
): Pick<MyApplicationRow, 'reapplyHref' | 'reapplyBlockedReason'> {
  // 已有选手行（「报名已撤回但仍是选手」的边界）也没有重新报名：
  // 报名接口会用 ALREADY_PARTICIPANT 拒绝，入口给了也是死路。
  const withdrawn = myApplicationState(item.application.status) === 'withdrawn'
  if (!withdrawn || item.participantStatus !== null) {
    return { reapplyHref: null, reapplyBlockedReason: null }
  }

  const cta = seasonApplicationCta({
    seasonId: item.season.id,
    seasonStatus: item.season.status,
    // 个人中心只有登录用户能进（外壳已重定向），所以这里恒为已登录。
    isLoggedIn: true,
    registration: seasonRegistration(item.season, now),
    applicationStatus: item.application.status,
  })

  return cta.href
    ? { reapplyHref: cta.href, reapplyBlockedReason: null }
    : { reapplyHref: null, reapplyBlockedReason: cta.label }
}

/** 表格一行：已经拆成各列需要的展示值。 */
export type MyApplicationRow = {
  applicationId: number
  seasonId: number
  /** 报名人（个人中心里恒为当前登录用户）—— 退出赛季接口需要它。 */
  userId: string
  seasonName: string
  seasonCode: string
  /** 赛季详情页地址（V2.6 起赛季详情是独立路由 `/seasons/:id`）。 */
  seasonHref: string
  submittedAt: string
  status: string
  statusLabel: string
  statusTone: ChipTone
  reviewNote: string
  wechat: string
  wechatStatus: WechatStatus | null
  participantStatus: SeasonParticipantStatus | null
  agreementVersion: string
  canWithdraw: boolean
  /** 组队截止前、已通过报名的 active 选手可以退出赛季。 */
  canExitSeason: boolean
  /** 组队已截止时的退赛说明；其余情况为 null。 */
  exitBlockedReason: string | null
  /** 已撤回且报名窗口开放时的「重新报名」入口；其余情况为 null。 */
  reapplyHref: string | null
  /** 已撤回但暂时报不上名时，操作列给的原因；其余情况为 null。 */
  reapplyBlockedReason: string | null
}

export function myApplicationRow(
  item: MySeasonApplication,
  now: Date = new Date(),
): MyApplicationRow {
  const { application, season } = item
  const status = applicationStatusCell(item)
  return {
    applicationId: application.id,
    seasonId: season.id,
    userId: application.userId,
    seasonName: season.name,
    seasonCode: season.code,
    seasonHref: `/seasons/${season.id}`,
    submittedAt: formatDateTime(application.createdAt),
    status: application.status,
    statusLabel: status.label,
    statusTone: status.tone,
    reviewNote: reviewNoteText(application.reviewReason),
    wechat: wechatCellLabel(item),
    wechatStatus: item.wechatStatus,
    participantStatus: item.participantStatus,
    agreementVersion: application.agreementVersion?.trim() || EMPTY_CELL,
    canWithdraw: canWithdrawApplication(application.status),
    ...seasonExitEntry(item, now),
    ...reapplyEntry(item, now),
  }
}

export function myApplicationRows(
  items: readonly MySeasonApplication[],
  now: Date = new Date(),
): MyApplicationRow[] {
  return items.map((item) => myApplicationRow(item, now))
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

/**
 * 卡片底部那行截止提示。
 *
 * 「报名状态」本身（未开放 / 报名中 / 报名已截止）由
 * `lib/season-registration.ts` 统一推导；这里只补一句人话解释为什么不是
 * 「报名中」：赛季暂停 / 取消要说赛季，还没排期要说等公布。
 */
export type DeadlineHint = {
  /** 是否已经不能再报名 —— 决定要不要挂 🔒。 */
  closed: boolean
  text: string
}

export function applyDeadlineHint(
  season: SeasonSummary,
  now: Date = new Date(),
): DeadlineHint {
  const registration = seasonRegistration(season, now)
  const opens = monthDayTimeLabel(season.schedule?.applyOpen)
  const closes = monthDayTimeLabel(season.schedule?.applyClose)

  if (season.status === SeasonStatus.Cancelled) {
    return { closed: true, text: '赛季已取消，报名不再开放' }
  }
  if (season.status === SeasonStatus.Suspended) {
    return { closed: true, text: '赛季已暂停，报名暂时关闭' }
  }

  switch (registration.state) {
    case 'closed':
      return { closed: true, text: `报名已于 ${closes ?? '截止时间'} 截止` }
    case 'not-open':
      return opens
        ? { closed: false, text: `报名将于 ${opens} 开放` }
        : { closed: false, text: '报名时间待公布' }
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
  /** 报名状态：未开放 / 报名中 / 报名已截止（与落地页票券同一套推导）。 */
  registrationState: SeasonRegistrationState
  registrationLabel: string
  registrationTone: ChipTone
  /** 只有报名中才画报名进度条。 */
  registrationOpen: boolean
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
      const registration = seasonRegistration(season, now)
      return {
        id: season.id,
        code: season.code,
        name: season.name,
        typeLabel: seasonTypeLabel(season.type),
        href: `/seasons/${season.id}`,
        seasonStatus: season.status,
        seasonStatusLabel: status.label,
        seasonStatusTone: status.tone,
        registrationState: registration.state,
        registrationLabel: registration.label,
        registrationTone: registration.tone,
        registrationOpen: registration.state === 'open',
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
