import { ANNOUNCEMENT_TYPE_LABELS, ANNOUNCEMENT_UNREAD_CAP, type AnnouncementType } from '@shenicest/shared'

/**
 * 角标数字文案：`0` 不展示（返回空串），超过上限展示 `99+`。
 *
 * 上限来自 shared 的 `ANNOUNCEMENT_UNREAD_CAP`，和个人中心 tab 角标同一口径；
 * 金额/数量类文案统一走这里，避免铃铛和 tab 各写一份 99 的魔法数字。
 */
export function announcementBadgeLabel(count: number): string {
  if (count <= 0) return ''
  return count > ANNOUNCEMENT_UNREAD_CAP ? `${ANNOUNCEMENT_UNREAD_CAP}+` : String(count)
}

/** 公告类型的中文标签；未知类型（服务端先上线了新类型）降级成「公告」。 */
export function announcementTypeLabel(type: string): string {
  return ANNOUNCEMENT_TYPE_LABELS[type as AnnouncementType] ?? '公告'
}

/** 数字变化时通知铃铛刷新角标的 window 事件名（与 connections-refresh 同款）。 */
export const ANNOUNCEMENT_REFRESH_EVENT = 'announcements-refresh'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * 面板里的时间：近期用相对时间，超过 7 天退回 `MM.DD`。
 *
 * 全部按 `Asia/Shanghai` 展示，和 `lib/boomland.ts` 的 `formatDateTime` 一致 ——
 * 公告是给人看的「刚刚 / 2 小时前」，不是审计时间戳，所以不走完整日期格式。
 * `now` 可注入，便于单测固定时间。
 */
const PANEL_DATE = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: '2-digit',
  day: '2-digit',
})

export function formatAnnouncementTime(value: string, now: Date = new Date()): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const elapsed = now.getTime() - date.getTime()
  if (elapsed < MINUTE) return '刚刚'
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} 分钟前`
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} 小时前`
  if (elapsed < 7 * DAY) return `${Math.floor(elapsed / DAY)} 天前`
  return PANEL_DATE.format(date).replace(/\//g, '.')
}
