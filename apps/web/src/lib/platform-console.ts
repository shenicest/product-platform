import { SeasonStatus, type SeasonSchedule } from '@shenicest/shared'
import type { ChipTone } from '@/components/ui/chip'
import { seasonStatusMeta, type RuleCardItem } from '@/lib/boomland'
import type { ManagedSeason, OrganizerOrg, SeasonManageDetail } from '@/lib/organizer'

/**
 * 平台后台（`/operator/boomland`）的领域类型与纯函数。
 *
 * 平台后台是 BoomLand 的**平台级**治理入口：平台管理员在这里审批主办方提交的
 * 赛季、维护主办方组织与成员；主办方组织成员可以进来**看**，但看不到任何写操作
 * （批准 / 驳回、建组织、加减成员都只有 `Role.Operator` 能做，后端也是这么判的）。
 *
 * 为什么准入要单开一套规则，而不是复用 `organizer-access.ts`？
 * 两者恰好方向相反：主办方后台「谁属于组织谁能进」，平台后台「谁管平台谁能写」。
 * 一个账号可以既不是管理员、又只属于某个组织 —— 这时他能进平台后台看自己赛季
 * 的审批进度，但改不了任何东西。把两件事塞进一个函数只会让后来的人猜。
 *
 * 本文件只放纯函数（没有 React、没有 fetch），便于直接单测。
 */

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export type PlatformTab = {
  /** 路由末段，同时作为稳定标识。 */
  slug: string
  label: string
  /**
   * 这个 tab 负责什么。占位 tab 也写清楚，让「开发中」本身成为交接说明，
   * 而不是一句干巴巴的空话（与主办方后台 `WorkInProgress` 同一做法）。
   */
  scope: string
  /** 是否已经接入真实数据。false 的 tab 渲染占位卡片。 */
  implemented: boolean
}

/**
 * 平台后台的 tab。
 *
 * 顺序沿用设计稿：治理相关的先放（赛季 → 积分池 → 评委 → 评分流水），
 * 组织与权限居中，异议与审计收尾。
 */
export const PLATFORM_TABS: readonly PlatformTab[] = [
  {
    slug: 'seasons',
    label: '赛季治理',
    scope: '待批准队列与全部赛季：预览公开页、批准公开、驳回退回草稿。',
    implemented: true,
  },
  {
    slug: 'points',
    label: '积分池总览',
    scope: '全平台赛季积分池的充值、分配、已用与回收口径总览。',
    implemented: false,
  },
  {
    slug: 'judges',
    label: '评委授权',
    scope: '跨赛季的评委授权一览：作用范围、分配余额、暂停与撤销。',
    implemented: false,
  },
  {
    slug: 'ledger',
    label: '评分流水与冲正',
    scope: '逐条评分流水与冲正记录：谁给谁评了多少分、冲正原因与操作人。',
    implemented: false,
  },
  {
    slug: 'orgs',
    label: '主办方组织与成员',
    scope: '新建主办方组织、增减成员；成员只在被指定的赛季内拥有主办方权限。',
    implemented: true,
  },
  {
    slug: 'permissions',
    label: '全局权限',
    scope: '平台身份与赛季角色的授权矩阵，以及敏感权限的临时授予记录。',
    implemented: false,
  },
  {
    slug: 'disputes',
    label: '异议',
    scope: '选手与主办方提交的异议队列：受理、答复与转冲正。',
    implemented: false,
  },
  {
    slug: 'audit',
    label: '审计',
    scope: '平台级审计日志：赛季审批、组织与成员变更、权限调整的完整留痕。',
    implemented: false,
  },
]

export const DEFAULT_PLATFORM_TAB = PLATFORM_TABS[0]

const TAB_BY_SLUG = new Map(PLATFORM_TABS.map((tab) => [tab.slug, tab]))

export function platformTab(slug: string): PlatformTab | null {
  return TAB_BY_SLUG.get(slug) ?? null
}

/** tab 的站内地址（tab 是真实路由，刷新 / 分享都能落回同一屏）。 */
export function platformTabHref(slug: string): string {
  return `/operator/boomland/${slug}`
}

/**
 * 从路径里解析当前 tab。
 *
 * 预览页 `/operator/boomland/seasons/12` 的末段是赛季 id，不是 tab slug，
 * 所以取「平台后台之后的第一个路径段」；找不到时回落到默认 tab。
 */
export function platformTabFromPathname(pathname: string): PlatformTab {
  const segments = pathname.split('/').filter(Boolean)
  const index = segments.indexOf('boomland')
  const slug = index >= 0 ? segments[index + 1] : undefined
  return (slug ? platformTab(slug) : null) ?? DEFAULT_PLATFORM_TAB
}

// ---------------------------------------------------------------------------
// 准入
// ---------------------------------------------------------------------------

/**
 * 是否把平台后台的入口展示给这个用户。
 *
 * 平台管理员与主办方组织成员都能看到：成员需要能查自己赛季的审批进度，
 * 但待批准赛季的公开页对他们之外的人不可见这件事，也只有在入口里才说得清。
 */
export function shouldShowPlatformEntry(input: {
  isLoggedIn: boolean
  isOperator: boolean
  /** 是否属于至少一个主办方组织；未知（还没查）时传 null。 */
  isOrganizerMember: boolean | null
}): boolean {
  if (!input.isLoggedIn) return false
  return input.isOperator || input.isOrganizerMember === true
}

/** 是否允许真正进入平台后台（服务端守卫与菜单用同一套规则）。 */
export function canAccessPlatformConsole(input: {
  isLoggedIn: boolean
  isOperator: boolean
  isOrganizerMember: boolean
}): boolean {
  if (!input.isLoggedIn) return false
  return input.isOperator || input.isOrganizerMember
}

/**
 * 能不能执行写操作（批准 / 驳回 / 建组织 / 加减成员）。
 *
 * 主办方组织成员进得来但只能看：批准本来就不在他们权限里（见 PRD §3.2）。
 * 前端据此禁用按钮并给出原因，后端仍会再判一次。
 */
export function canWritePlatformConsole(isOperator: boolean): boolean {
  return isOperator
}

export const READ_ONLY_SCOPE_NOTE =
  '你以主办方成员身份查看平台后台：只能看到自己所属组织的赛季与成员，任何写操作（批准 / 驳回、建组织、加减成员）都只有平台管理员可以执行。'

// ---------------------------------------------------------------------------
// 状态与门槛
// ---------------------------------------------------------------------------

export type PlatformSeasonRow = ManagedSeason

/**
 * 预览页用的赛季数据：管理视图的全量字段 + 规则卡。
 *
 * `GET /seasons/:id/manage` 本来就会返回 `ruleCard`，但主办方后台的类型
 * 里没声明它（那边只用公开页读规则卡）。平台后台要拿同一份数据渲染公开页
 * 的样子，所以在这里把缺的那个字段补上，而不是重新请求一遍公开接口 ——
 * 待批赛季的公开接口本来就会 404。
 */
export type PlatformSeasonPreview = SeasonManageDetail & { ruleCard: RuleCardItem[] }

/**
 * 待批 = `upcoming` 且还没写 `approvedAt`。
 *
 * 后端没有单独的「待批」status（见 docs/boomland/CONTEXT.md 的 Pending Approval），
 * 前端不另造一个：所有判断都走这个函数，避免两处口径漂移。
 */
export function isPendingApproval(season: {
  status: string
  approvedAt: string | null
}): boolean {
  return season.status === SeasonStatus.Upcoming && !season.approvedAt
}

/** 赛季在治理表里的状态胶囊；待批单独一种说法，其余沿用公开页的色板。 */
export function platformSeasonStatusMeta(season: {
  status: string
  approvedAt: string | null
}): { label: string; tone: ChipTone } {
  if (isPendingApproval(season)) return { label: '待批准', tone: 'warning' }
  return seasonStatusMeta(season.status)
}

export type ReadinessRatio = {
  passed: number
  total: number
  ready: boolean
  /** 表格里的展示文案，如 `9 / 9`。 */
  label: string
}

/**
 * 发布门槛计数。
 *
 * 后端的 9 项门槛是动态的（不计分赛季会免除预算 / 积分池 / 评委分配三项，
 * detail 里写明原因），所以这里不写死 9：总数跟随后端返回的 `readinessTotal`。
 */
export function readinessRatio(season: {
  readinessPassed: number
  readinessTotal: number
  readinessReady: boolean
}): ReadinessRatio {
  const total = season.readinessTotal
  const passed = Math.min(season.readinessPassed, total)
  return {
    passed,
    total,
    ready: season.readinessReady,
    label: `${passed} / ${total}`,
  }
}

/** 待批队列：按提交时间倒序（后端按 updatedAt 排，这里只筛不改顺序）。 */
export function pendingApprovalRows(rows: readonly PlatformSeasonRow[]): PlatformSeasonRow[] {
  return rows.filter(isPendingApproval)
}

/**
 * 从就绪度检查项算门槛计数。
 *
 * 列表行直接带 `readinessPassed` / `readinessTotal`（后端逐行算好），而预览页读的是
 * `GET /seasons/:id/readiness` 的完整检查项 —— 两个数据源，一种展示口径，
 * 所以计数逻辑收在这里，不在组件里各写一遍。
 */
export function readinessRatioFromChecks(
  checks: ReadonlyArray<{ passed: boolean }> | null | undefined,
  ready?: boolean,
): ReadinessRatio {
  const list = checks ?? []
  const passed = list.filter((check) => check.passed).length
  return {
    passed,
    total: list.length,
    ready: ready ?? (list.length > 0 && passed === list.length),
    label: `${passed} / ${list.length}`,
  }
}

/** 预览 / 批准按钮是否可用：管理员 + 待批 + 门槛全过。 */
export function canApproveSeason(
  season: { status: string; approvedAt: string | null; readinessReady: boolean },
  isOperator: boolean,
): boolean {
  return isOperator && isPendingApproval(season) && season.readinessReady
}

/**
 * 不能批准的原因；可以批准时返回 null。
 *
 * 按钮禁用时必须说清为什么 —— 「灰着但不能点」和「后端报 409」之间差一次
 * 无用的往返，而且用户还是不知道差哪一项。
 */
export function approveBlocker(
  season: { status: string; approvedAt: string | null; readinessReady: boolean },
  isOperator: boolean,
): string | null {
  if (!isOperator) return '只有平台管理员可以批准赛季。'
  if (!isPendingApproval(season)) return '该赛季不是待批准状态。'
  if (!season.readinessReady) return '发布门槛还没全部通过，先在赛季设置里补齐。'
  return null
}

// ---------------------------------------------------------------------------
// 赛程展示
// ---------------------------------------------------------------------------

const BEIJING_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})

type DateParts = { year: number; month: number; day: number }

function beijingParts(value: string): DateParts | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = BEIJING_PARTS.formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const year = pick('year')
  const month = pick('month')
  const day = pick('day')
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return { year, month, day }
}

function formatDay(parts: DateParts, withYear: boolean): string {
  const head = withYear ? `${parts.year}年` : ''
  return `${head}${parts.month}月${parts.day}日`
}

/**
 * 赛季赛程区间：`11月1日 — 11月5日`。
 *
 * 年份的省略规则按「和当前年份比」而不是「两端互相比」：
 *   · 开始日期不在今年 → 带上年份（往季档案里的 2025 年赛季要能一眼认出来）；
 *   · 结束日期不在今年、或跨年到下一年 → 也带上年份（`12月20日 — 2027年1月20日`）。
 * 这样今年内的赛季永远是最短的那一版，往季与跨年赛季也不会被读错成今年。
 */
export function formatScheduleRange(
  schedule: Pick<SeasonSchedule, 'startAt' | 'settleDate'> | null | undefined,
  now: Date = new Date(),
): string {
  if (!schedule) return '待定'
  const start = beijingParts(schedule.startAt)
  const end = beijingParts(schedule.settleDate)
  if (!start && !end) return '待定'
  const nowParts = beijingParts(now.toISOString())
  const nowYear = nowParts?.year ?? now.getFullYear()

  if (start && end) {
    const startWithYear = start.year !== nowYear
    const endWithYear = end.year !== nowYear || end.year !== start.year
    return `${formatDay(start, startWithYear)} — ${formatDay(end, endWithYear)}`
  }
  const single = start ?? end!
  return formatDay(single, single.year !== nowYear)
}

// ---------------------------------------------------------------------------
// 主办方组织
// ---------------------------------------------------------------------------

export type PlatformOrgMember = {
  userId: string
  name: string | null
  avatarUrl: string | null
  joinedAt: string
}

/** 组织卡片：组织本身 + 成员 + 该组织主办的赛季（三者一起展示才有意义）。 */
export type PlatformOrgCard = {
  org: OrganizerOrg
  members: PlatformOrgMember[]
  seasons: PlatformSeasonRow[]
  /** 当前账号能不能改这个组织的成员（只有平台管理员能）。 */
  canManageMembers: boolean
}

/** 某个组织主办的赛季；按 `season.organizerOrgs` 里的 id 匹配。 */
export function seasonsOfOrg(
  orgId: number,
  seasons: readonly PlatformSeasonRow[],
): PlatformSeasonRow[] {
  return seasons.filter((season) => season.organizerOrgs.some((org) => org.id === orgId))
}

/** 组织成员在页头展示的人数文案（0 人要明确说「还没有成员」）。 */
export function memberCountLabel(count: number): string {
  return count > 0 ? `${count} 名成员` : '还没有成员'
}

/**
 * 组织名称的合法性：与后端 `CreateOrgBody` 一致（trim 后 2—100 字）。
 *
 * 前端提前挡一道只是为了少一次往返；后端仍是最终裁判。
 */
export function validateOrgName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return '填写组织名称'
  if (trimmed.length < 2) return '组织名称至少 2 个字'
  if (trimmed.length > 100) return '组织名称最多 100 个字'
  return null
}

/** 成员 userId 的基本形态；空串单独给一句提示（交给后端报 404 太绕）。 */
export function validateMemberUserId(userId: string): string | null {
  const trimmed = userId.trim()
  if (!trimmed) return '填写用户 ID'
  if (trimmed.length > 255) return '用户 ID 过长'
  return null
}
