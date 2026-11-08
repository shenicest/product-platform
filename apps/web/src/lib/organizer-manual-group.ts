import { SeasonParticipantStatus, WechatStatus } from '@shenicest/shared'
import type { ChipTone } from '@/components/ui/chip'
import type { ButtonVariant } from '@/components/ui/button'

/**
 * 人工拉群 tab 的纯函数与常量。
 *
 * 这里**只有计算**：没有 React、没有 fetch，方便直接单测。页面（Server Component）
 * 只负责取数，客户端视图只负责把这里的结果摆进 DOM。
 *
 * 口径来自后端状态机（见 docs/boomland/pre-start-season-api.md §3.3）：
 *
 *   not_invited ──invite──▶ invited ──join──▶ joined（终态）
 *                              └──fail──▶ failed ──invite──▶ invited
 *
 * 前端只负责把「当前状态能做什么」翻译成按钮，**合法性仍由后端判定**：
 * 非法跳转返回 409 `WECHAT_STATUS_INVALID`，视图把 message 原样摆出来。
 */

// ---------------------------------------------------------------------------
// 后端响应形状
// ---------------------------------------------------------------------------

/** 选手的公开资料（来自共享 users 表；缺行时 name / avatarUrl 为 null）。 */
export type ParticipantApplicant = {
  userId: string
  name: string | null
  avatarUrl: string | null
}

/**
 * `GET /seasons/:id/participants` 的一行。
 *
 * `contact` / `reviewedAt` / `wechatInvitedByUser` 是拉群页专用的补字段：
 * 主办方要拿着微信去加人，也要看到「谁在什么时候记的这笔」，光有 userId 不够。
 */
export type SeasonParticipant = {
  id: number
  seasonId: number
  userId: string
  applicationId: number
  wechatStatus: WechatStatus | string
  wechatInvitedBy: string | null
  wechatInvitedAt: string | null
  joinedAt: string | null
  status: SeasonParticipantStatus | string
  withdrawnAt: string | null
  withdrawnBy: string | null
  withdrawReason: string | null
  applicant: ParticipantApplicant
  /** 报名时填的联系方式；后端解密失败或报名缺失时为 null。 */
  contact: { wechat?: string; phone?: string } | null
  /** 报名审核通过的时间；未审核过为 null。 */
  reviewedAt: string | null
  /** 记录「邀请」这个动作的人；没邀请过为 null。 */
  wechatInvitedByUser: ParticipantApplicant | null
  createdAt: string
  updatedAt: string
}

export type SeasonParticipantsPage = {
  items: SeasonParticipant[]
  total: number
  page: number
  pageSize: number
}

// ---------------------------------------------------------------------------
// 状态 → 展示
// ---------------------------------------------------------------------------

/**
 * 微信群状态的中文文案与色板。
 *
 * 与截图一致：已邀请用蓝、已加入用绿、邀请失败用红、未邀请用中性灰。
 * 色板取 `ChipTone`，不引入裸色值。
 */
const WECHAT_STATUS_META: Record<string, { label: string; tone: ChipTone }> = {
  [WechatStatus.NotInvited]: { label: '未邀请', tone: 'neutral' },
  [WechatStatus.Invited]: { label: '已邀请', tone: 'sky' },
  [WechatStatus.Joined]: { label: '已加入', tone: 'success' },
  [WechatStatus.Failed]: { label: '邀请失败', tone: 'danger' },
}

export function wechatStatusMeta(status: string | null | undefined): {
  label: string
  tone: ChipTone
} {
  if (!status) return { label: '—', tone: 'neutral' }
  return WECHAT_STATUS_META[status] ?? { label: status, tone: 'neutral' }
}

// ---------------------------------------------------------------------------
// 状态 → 可用动作
// ---------------------------------------------------------------------------

export type WechatAction = {
  /** 点击后要写入的目标状态。 */
  target: WechatStatus
  label: string
  variant: ButtonVariant
  /** 成功后给用户看的一句话；失败一律用后端的 message。 */
  successMessage: string
}

/**
 * 当前状态能做的动作。
 *
 * 已加入是终态 → 没有动作（截图里该行的操作列没有按钮）；
 * 已退出赛季的选手 → 没有动作，后端也会返回 409 `PARTICIPANT_WITHDRAW_LOCKED`，
 * 这里提前拦住，省一次必然失败的请求。
 *
 * 顺序按「主操作在前」排：已邀请时先给「标记已入群」（正向结果），
 * 「标记邀请失败」是次要操作。
 */
export function wechatActionsFor(participant: {
  wechatStatus: string
  status: string
}): WechatAction[] {
  if (participant.status !== SeasonParticipantStatus.Active) return []

  switch (participant.wechatStatus) {
    case WechatStatus.NotInvited:
      return [
        {
          target: WechatStatus.Invited,
          label: '邀请',
          variant: 'primary',
          successMessage: '已记录为已邀请',
        },
      ]
    case WechatStatus.Invited:
      return [
        {
          target: WechatStatus.Joined,
          label: '标记已入群',
          variant: 'primary',
          successMessage: '已记录为已加入',
        },
        {
          target: WechatStatus.Failed,
          label: '标记邀请失败',
          variant: 'ghost',
          successMessage: '已记录为邀请失败',
        },
      ]
    case WechatStatus.Failed:
      return [
        {
          target: WechatStatus.Invited,
          label: '重新邀请',
          variant: 'primary',
          successMessage: '已重新记录为已邀请',
        },
      ]
    default:
      // joined（终态）或后端将来新增的状态：不猜，交给后端。
      return []
  }
}

/**
 * 该行是否只读（终态 / 已退出）。
 *
 * 已加入是终态、已退出不能再拉群 —— 这两种行的操作列没有按钮，只剩一句短说明。
 * 视图用它填操作列，纯函数放这里方便单测。
 */
export function participantLockReason(participant: {
  wechatStatus: string
  status: string
}): string | null {
  if (participant.status !== SeasonParticipantStatus.Active) return '选手已退出赛季'
  if (participant.wechatStatus === WechatStatus.Joined) return '已加入为终态'
  return null
}

// ---------------------------------------------------------------------------
// 联系方式 / 记录人 / 时间
// ---------------------------------------------------------------------------

/**
 * 联系方式的一行摘要。
 *
 * 微信带 `wx:` 前缀（与截图一致），手机直接给号码；两个都有时微信优先
 * ——拉群的入口是微信，手机号是备选。
 */
export function contactSummary(
  contact: { wechat?: string; phone?: string } | null | undefined,
): string {
  if (!contact) return '—'
  const wechat = contact.wechat?.trim()
  if (wechat) return `wx: ${wechat}`
  const phone = contact.phone?.trim()
  if (phone) return phone
  return '—'
}

/** 记录人：昵称优先，没有资料时退回 userId；没记录过返回 null。 */
export function recorderOf(participant: SeasonParticipant): {
  name: string
  avatarUrl: string | null
  at: string | null
} | null {
  const user = participant.wechatInvitedByUser
  const userId = participant.wechatInvitedBy
  if (!user && !userId) return null
  return {
    name: user?.name ?? userId ?? '—',
    avatarUrl: user?.avatarUrl ?? null,
    at: participant.wechatInvitedAt,
  }
}

/** 头像里的占位字符：取昵称首字，没有昵称时取 userId 首字。 */
export function participantInitial(applicant: {
  name: string | null
  userId: string
}): string {
  const source = applicant.name?.trim() || applicant.userId.trim()
  return source.slice(0, 1).toUpperCase()
}

/**
 * `11月3日 15:00` —— 表格里的紧凑时间。
 *
 * 为什么不用 `formatDateTime`（`2026.11.03 15:00`）：拉群表的每行已经有「赛季标识」
 * 说明上下文，年份是噪音；而记录人那一格要放两行（人名 + 时间），更短的时间戳
 * 才不会把行撑高。
 *
 * 时区固定 Asia/Shanghai，与 `lib/boomland.ts` 的口径一致 —— 同一份数据在
 * 不同浏览器时区下必须显示成同一时刻。
 */
const MONTH_DAY_TIME = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatMonthDayTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const parts = MONTH_DAY_TIME.formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const month = pick('month')
  const day = pick('day')
  const hour = pick('hour')
  const minute = pick('minute')
  if (!month || !day || !hour || !minute) return '—'
  return `${month}月${day}日 ${hour}:${minute}`
}

// ---------------------------------------------------------------------------
// 计数摘要
// ---------------------------------------------------------------------------

export type WechatCounts = {
  total: number
  notInvited: number
  invited: number
  joined: number
  failed: number
}

/** 顶部四个计数：一眼看出这一季还剩多少人没进群。 */
export function countWechatStatuses(
  participants: ReadonlyArray<{ wechatStatus: string }>,
): WechatCounts {
  const counts: WechatCounts = {
    total: participants.length,
    notInvited: 0,
    invited: 0,
    joined: 0,
    failed: 0,
  }
  for (const participant of participants) {
    switch (participant.wechatStatus) {
      case WechatStatus.NotInvited:
        counts.notInvited += 1
        break
      case WechatStatus.Invited:
        counts.invited += 1
        break
      case WechatStatus.Joined:
        counts.joined += 1
        break
      case WechatStatus.Failed:
        counts.failed += 1
        break
      default:
        break
    }
  }
  return counts
}
