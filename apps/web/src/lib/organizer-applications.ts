import { SeasonApplicationStatus, SeasonStatus } from '@shenicest/shared'
import type { ChipTone } from '@/components/ui/chip'
import { formatMilestoneDate } from '@/lib/boomland'

/**
 * 报名审核 tab 的纯函数与常量。
 *
 * 与 `lib/organizer-settings.ts` 同一定位：只有计算，没有 React、没有 fetch，
 * 页面与客户端组件都从这里取口径，测试也直接打这里。
 *
 * 三块内容：
 *   1. 列表/详情的数据形状（与 `GET /seasons/:id/applications` 对齐）；
 *   2. 审核动作矩阵 —— 哪个状态能点哪些按钮（后端 `PATCH /applications/:id/status`
 *      的规则在前端提前表达一遍，避免把必然 409 的按钮摆出来）；
 *   3. 展示派生值：状态文案、提交时间拆分、报名窗口与名额汇总。
 */

// ---------------------------------------------------------------------------
// 后端响应形状
// ---------------------------------------------------------------------------

/** 报名者公开资料（后端 `applicant` 字段）。 */
export type ApplicationApplicant = {
  userId: string
  name: string | null
  avatarUrl: string | null
}

/** `GET /seasons/:id/applications` 的一行：不含完整联系方式，只有掩码。 */
export type ApplicationListItem = {
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
  status: string
  reviewedBy: string | null
  reviewReason: string | null
  reviewedAt: string | null
  withdrawnAt: string | null
  contactMasked: string | null
  applicant: ApplicationApplicant
  createdAt: string
  updatedAt: string
}

/** `GET /applications/:id`：管理视图，带解密后的联系方式。 */
export type ApplicationDetail = Omit<ApplicationListItem, 'contactMasked'> & {
  contact: { wechat?: string; phone?: string } | null
  applicant: ApplicationApplicant
}

/** `GET /seasons/:id/audit-logs` 的一行（只取报名审核相关的字段）。 */
export type ApplicationAuditEntry = {
  id: number
  actorUserId: string
  actorName: string | null
  action: string
  targetType: string
  targetId: string | null
  detail: unknown
  createdAt: string
}

export type ApplicationListPage = {
  items: ApplicationListItem[]
  total: number
  page: number
  pageSize: number
}

export type ApplicationListQuery = {
  /** 与后端 `SeasonApplicationsQuery` 的枚举一一对应（Eden 靠字面量收窄类型）。 */
  status?:
    | 'submitted'
    | 'accepted'
    | 'pending'
    | 'waitlisted'
    | 'rejected'
    | 'withdrawn'
  visibility?: 'public' | 'organizer_only'
  q?: string
  page?: number
  pageSize?: number
}

// ---------------------------------------------------------------------------
// 审核状态
// ---------------------------------------------------------------------------

/**
 * 审核动作的目标状态。
 *
 * `withdrawn` 不在其中：撤回是报名者自己的动作，主办方只能让已撤回的报名
 * 由本人重新提交（后端 `APPLICATION_WITHDRAW_LOCKED`）。
 */
export type ApplicationReviewTarget = 'accepted' | 'pending' | 'waitlisted' | 'rejected'

export type ReviewStatusMeta = { label: string; tone: ChipTone }

/**
 * 审核队列里的状态文案。
 *
 * 与「我的报名」不同：报名者看到 `submitted` 是「已提交」，主办方在审核队列里
 * 看到的是「审核中」—— 同一个状态，两侧关心的事情不一样。
 */
const REVIEW_STATUS_META: Record<string, ReviewStatusMeta> = {
  [SeasonApplicationStatus.Submitted]: { label: '审核中', tone: 'sky' },
  [SeasonApplicationStatus.Pending]: { label: '待定', tone: 'warning' },
  [SeasonApplicationStatus.Waitlisted]: { label: '候补', tone: 'warning' },
  [SeasonApplicationStatus.Accepted]: { label: '已通过', tone: 'success' },
  [SeasonApplicationStatus.Rejected]: { label: '未通过', tone: 'danger' },
  [SeasonApplicationStatus.Withdrawn]: { label: '已撤回', tone: 'neutral' },
}

export function reviewStatusMeta(status: string): ReviewStatusMeta {
  return REVIEW_STATUS_META[status] ?? { label: status, tone: 'neutral' }
}

const REVIEW_STATUSES = new Set<string>([
  SeasonApplicationStatus.Submitted,
  SeasonApplicationStatus.Pending,
  SeasonApplicationStatus.Waitlisted,
  SeasonApplicationStatus.Accepted,
  SeasonApplicationStatus.Rejected,
  SeasonApplicationStatus.Withdrawn,
])

/** 是否是可作为筛选值的审核状态（含 `withdrawn`，只是它不能被审核）。 */
export function isReviewStatus(value: string): value is NonNullable<ApplicationListQuery['status']> {
  return REVIEW_STATUSES.has(value)
}

/** `accepted` 是终态，`withdrawn` 只能由本人重新报名 —— 两者都不可再审核。 */
export function isReviewable(status: string): boolean {
  return status !== SeasonApplicationStatus.Accepted && status !== SeasonApplicationStatus.Withdrawn
}

// ---------------------------------------------------------------------------
// 动作矩阵
// ---------------------------------------------------------------------------

export type ReviewAction = {
  target: ApplicationReviewTarget
  label: string
  /**
   * 图标按钮的语义色（对应 `components.css` 的 `.ui-icon-btn--*`）。
   *
   * 行内操作是图标，静止态就得能分辨主次与危险：通过是实心品牌粉，
   * 待定/候补是琥珀淡底，不通过是红色淡底。文字按钮没有这个需求
   * （文字本身已经说明了一切），所以这是图标化才需要的字段。
   */
  tone: 'brand-solid' | 'warning' | 'danger'
  /** 需要填原因（拒绝必填，其余可选）。 */
  requiresReason?: boolean
}

/**
 * 每个动作的展示配置。
 *
 * 顺序即按钮顺序：通过 / 待定 / 候补 / 不通过 —— 与审核队列的阅读习惯一致，
 * 主操作永远在最左边。
 */
const REVIEW_ACTIONS: Record<ApplicationReviewTarget, Omit<ReviewAction, 'target'>> = {
  accepted: { label: '通过', tone: 'brand-solid' },
  pending: { label: '待定', tone: 'warning' },
  waitlisted: { label: '候补', tone: 'warning' },
  rejected: { label: '不通过', tone: 'danger', requiresReason: true },
}

const REVIEW_TARGET_ORDER: ApplicationReviewTarget[] = ['accepted', 'pending', 'waitlisted', 'rejected']

/**
 * 某条报名此刻可执行的动作。
 *
 * 口径与后端一致：非 `accepted` 状态之间可自由流转，所以除了「当前状态」本身，
 * 其余三个目标都能点；`accepted` / `withdrawn` 没有动作。
 */
export function applicationReviewActions(status: string): ReviewAction[] {
  if (!isReviewable(status)) return []
  return REVIEW_TARGET_ORDER
    .filter((target) => target !== status)
    .map((target) => ({ target, ...REVIEW_ACTIONS[target] }))
}

/**
 * 审核成功后的反馈文案。
 *
 * 唯一需要额外解释的情形是「点通过、实际进候补」：名额满了但还没到组队截止，
 * 后端会把 `accepted` 降级成 `waitlisted`。不把这件事说出来，主办方会以为
 * 自己点错了。
 */
export function reviewOutcomeMessage(requested: ApplicationReviewTarget, effective: string): string {
  if (requested === 'accepted' && effective === SeasonApplicationStatus.Waitlisted) {
    return '名额已满，该报名已进入候补队列。'
  }
  return `已标记为「${reviewStatusMeta(effective).label}」。`
}

// ---------------------------------------------------------------------------
// 筛选
// ---------------------------------------------------------------------------

export const APPLICATION_REVIEW_PAGE_SIZE = 20

/** 「显示」下拉的选项。`all` 是 UI 概念，不会传给后端。 */
export const REVIEW_STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: SeasonApplicationStatus.Submitted, label: '待处理' },
  { value: 'all', label: '全部报名' },
  { value: SeasonApplicationStatus.Pending, label: '待定' },
  { value: SeasonApplicationStatus.Waitlisted, label: '候补' },
  { value: SeasonApplicationStatus.Accepted, label: '已通过' },
  { value: SeasonApplicationStatus.Rejected, label: '未通过' },
  { value: SeasonApplicationStatus.Withdrawn, label: '已撤回' },
]

export const DEFAULT_REVIEW_STATUS_FILTER = SeasonApplicationStatus.Submitted

export const ALL_REVIEW_STATUS_FILTER = 'all'

export type ApplicationReviewParams = {
  /** 后端 query 用的状态；`undefined` = 全部。 */
  status?: ApplicationListQuery['status']
  visibility?: ApplicationListQuery['visibility']
  q?: string
  page: number
  /** 原始筛选值，回显下拉框用（`all` 表示全部）。 */
  statusFilter: string
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * 解析 URL 上的筛选。
 *
 * 默认是「待处理」（`submitted`）：审核队列打开就该看到还没处理完的报名，
 * 而不是把已通过/未通过的历史记录也铺一屏。
 */
export function parseApplicationReviewParams(
  searchParams: Record<string, string | string[] | undefined>,
): ApplicationReviewParams {
  const params: ApplicationReviewParams = {
    status: DEFAULT_REVIEW_STATUS_FILTER,
    statusFilter: DEFAULT_REVIEW_STATUS_FILTER,
    page: 1,
  }

  const status = first(searchParams.status)?.trim()
  if (status === ALL_REVIEW_STATUS_FILTER) {
    delete params.status
    params.statusFilter = ALL_REVIEW_STATUS_FILTER
  } else if (status && isReviewStatus(status)) {
    params.status = status
    params.statusFilter = status
  }

  const visibility = first(searchParams.visibility)?.trim()
  if (visibility === 'public' || visibility === 'organizer_only') {
    params.visibility = visibility
  }

  const q = first(searchParams.q)?.trim()
  if (q) params.q = q

  const page = Number(first(searchParams.page))
  if (Number.isInteger(page) && page > 0) params.page = page

  return params
}

/** 审核队列的 URL：只保留有意义的参数，`全部` 用 `status=all` 表达。 */
export function applicationReviewHref(input: {
  statusFilter: string
  page?: number
  seasonId?: number | null
}): string {
  const params = new URLSearchParams()
  if (input.seasonId !== null && input.seasonId !== undefined) {
    params.set('season', String(input.seasonId))
  }
  if (input.statusFilter && input.statusFilter !== DEFAULT_REVIEW_STATUS_FILTER) {
    params.set('status', input.statusFilter)
  }
  if (input.page && input.page > 1) params.set('page', String(input.page))
  const qs = params.toString()
  return qs ? `/organizer/applications?${qs}` : '/organizer/applications'
}

// ---------------------------------------------------------------------------
// 展示派生值
// ---------------------------------------------------------------------------

const TIME_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** 提交时间拆成「日期 / 时刻」两行，列表列窄，堆叠比横排好读。 */
export function submissionStamp(
  value: string | null | undefined,
  now = new Date(),
): { date: string; time: string } {
  if (!value) return { date: '—', time: '' }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: '—', time: '' }
  return { date: formatMilestoneDate(value, now), time: TIME_FORMAT.format(date) }
}

/** 组队意向的一行摘要：先给「能不能单人」，再给原话。 */
export function teamIntentLabel(acceptsSolo: boolean): string {
  return acceptsSolo ? '可单人开始' : '需要组队'
}

export type ApplicationWindowSummary = {
  /** 报名窗口的当前状态，如「报名已截止」。 */
  label: string
  /** 报名起止，如「10月12日 — 10月26日」；未排期时为 null。 */
  range: string | null
  /** 窗口是否还开着（决定「审核中」的报名还能不能再进来）。 */
  open: boolean
}

/**
 * 报名窗口摘要。
 *
 * `applicationWindow.isOpen` 已经是后端按时间 + 状态推导的结论，这里只在
 * 关闭时补充**为什么**关（暂停 / 取消 / 未开始 / 已截止），避免让主办方
 * 自己去对赛程表。
 */
export function summarizeApplicationWindow(
  window: { opensAt: string | null; closesAt: string | null; isOpen: boolean },
  seasonStatus: string,
  now = new Date(),
): ApplicationWindowSummary {
  const range = window.opensAt && window.closesAt
    ? `${formatMilestoneDate(window.opensAt, now)} — ${formatMilestoneDate(window.closesAt, now)}`
    : window.closesAt
      ? `截止 ${formatMilestoneDate(window.closesAt, now)}`
      : null

  if (seasonStatus === SeasonStatus.Cancelled) {
    return { label: '赛季已取消', range, open: false }
  }
  if (seasonStatus === SeasonStatus.Suspended) {
    return { label: '赛季已暂停', range, open: false }
  }
  if (window.isOpen) return { label: '报名中', range, open: true }
  if (!window.opensAt && !window.closesAt) return { label: '报名时间待公布', range: null, open: false }
  if (window.opensAt && now.getTime() < new Date(window.opensAt).getTime()) {
    return { label: '报名未开始', range, open: false }
  }
  return { label: '报名已截止', range, open: false }
}

export type ApplicationReviewStats = {
  /** 大数字：`19 / 20`；名额不限时是 `19 / 不限`。 */
  approved: string
  approvedLabel: string
  /** 候补人数。 */
  waitlisted: number
  window: ApplicationWindowSummary
}

/**
 * 顶部的三块统计。
 *
 * 「已通过选手」取赛季选手数（`participantCount`，只算 `active`），而不是
 * `accepted` 报名数：被录取后又退出的选手会同时让两个数字分叉，而主办方
 * 关心的「还剩几个位置」只跟在场选手有关。
 */
export function summarizeApplicationReview(input: {
  participantCapacity: number | null
  participantCount: number
  waitlistedCount: number
  applicationWindow: { opensAt: string | null; closesAt: string | null; isOpen: boolean }
  seasonStatus: string
  now?: Date
}): ApplicationReviewStats {
  const now = input.now ?? new Date()
  const capacity = input.participantCapacity === null ? '不限' : String(input.participantCapacity)
  return {
    approved: `${input.participantCount} / ${capacity}`,
    approvedLabel: '已通过选手 · 名额',
    waitlisted: input.waitlistedCount,
    window: summarizeApplicationWindow(input.applicationWindow, input.seasonStatus, now),
  }
}

/** 审核队列的筛选说明：给空状态和表头下方的一句话用。 */
export function reviewFilterDescription(statusFilter: string): string {
  const option = REVIEW_STATUS_FILTER_OPTIONS.find((item) => item.value === statusFilter)
  return option ? option.label : '全部报名'
}
