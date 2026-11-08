import type { AnnouncementCategory, SeasonRules, SeasonSchedule } from '@shenicest/shared'
import { request } from './client-api'
import type { SeasonAnnouncement, RuleCardItem } from './boomland'
import type { SeasonManageDetail } from './organizer'

/**
 * 赛季设置 tab 的**写**客户端。
 *
 * 全部复用 `client-api` 的 `request`：同源 `/api/*`、浏览器自动带 httpOnly cookie、
 * 统一返回 `{ data, error }`。错误体形状是 `{ error: { code, message, field } }`，
 * 由调用方（视图 / 弹窗）负责展示 `message`。
 *
 * 读操作不在这里：Server 端走 `@/server/organizer`，客户端弹窗按需读时走
 * `@/lib/organizer-api`。
 */

/** 公告随写操作一起提交时的可选入参（后端会自动生成一条公告）。 */
export type AnnouncementInput = { title?: string; content?: string }

/** `PATCH /seasons/:id` —— 只允许草稿；`code` 不在可改字段里。 */
export type UpdateSeasonCoreBody = {
  name?: string
  type?: 'season' | 'hackathon'
  city?: string | null
  intro?: string | null
  themes?: string[]
  agreementVersion?: string
  awardingEntity?: string | null
  participantCapacity?: number | null
}

export type UpdateSeasonScheduleBody = {
  schedule: SeasonSchedule
  announcement?: AnnouncementInput
}

export type UpdateSeasonRulesBody = {
  rules: SeasonRules
  announcement?: AnnouncementInput
}

export type UpdateSeasonRuleCardBody = {
  items: Array<{ key: string; label: string; value: string; visible?: boolean }>
  announcement?: AnnouncementInput
}

export type UpdateSeasonOrganizersBody = { organizerOrgIds: number[] }

/** `PUT /seasons/:id/themes` —— 整表替换赛季主题，返回归一化后的结果。 */
export type UpdateSeasonThemesBody = { themes: string[] }

export function updateSeasonCore(seasonId: number, body: UpdateSeasonCoreBody) {
  return request<SeasonManageDetail>('PATCH', `/seasons/${seasonId}`, body)
}

export function updateSeasonSchedule(seasonId: number, body: UpdateSeasonScheduleBody) {
  return request<SeasonManageDetail>('PUT', `/seasons/${seasonId}/schedule`, body)
}

export function updateSeasonRules(seasonId: number, body: UpdateSeasonRulesBody) {
  return request<SeasonManageDetail>('PUT', `/seasons/${seasonId}/rules`, body)
}

export function updateSeasonRuleCard(seasonId: number, body: UpdateSeasonRuleCardBody) {
  return request<{ items: RuleCardItem[] }>('PUT', `/seasons/${seasonId}/rule-card`, body)
}

export function updateSeasonOrganizers(seasonId: number, body: UpdateSeasonOrganizersBody) {
  return request<{ organizerOrgs: Array<{ id: number; name: string }> }>(
    'PUT',
    `/seasons/${seasonId}/organizers`,
    body,
  )
}

/**
 * 赛季主题整表替换。
 *
 * 后端会 `trim` / 去空 / 去重后再落库，所以返回的 `themes` 可能比请求体短：
 * 调用方保存成功后应 `router.refresh()`，用服务端结果覆盖本地草稿，
 * 而不是拿请求体当「已保存版本」（否则 dirty 判断会一直为真）。
 */
export function updateSeasonThemes(seasonId: number, body: UpdateSeasonThemesBody) {
  return request<{ themes: string[] }>('PUT', `/seasons/${seasonId}/themes`, body)
}

/** 提交待批；平台管理员提交会直接批准（`approvedAt` 立即非空）。 */
export function submitSeason(seasonId: number) {
  return request<SeasonManageDetail>('POST', `/seasons/${seasonId}/submit`)
}

export function approveSeason(seasonId: number) {
  return request<SeasonManageDetail>('POST', `/seasons/${seasonId}/approve`)
}

export function rejectSeason(seasonId: number, reason: string) {
  return request<SeasonManageDetail>('POST', `/seasons/${seasonId}/reject`, { reason })
}

export function startSeason(seasonId: number) {
  return request<SeasonManageDetail>('POST', `/seasons/${seasonId}/start`)
}

export function suspendSeason(seasonId: number) {
  return request<SeasonManageDetail>('POST', `/seasons/${seasonId}/suspend`)
}

export function resumeSeason(seasonId: number) {
  return request<SeasonManageDetail>('POST', `/seasons/${seasonId}/resume`)
}

export function cancelSeason(seasonId: number, reason: string) {
  return request<SeasonManageDetail>('POST', `/seasons/${seasonId}/cancel`, { reason })
}

export function createSeasonAnnouncement(
  seasonId: number,
  body: { title: string; content: string; category?: AnnouncementCategory },
) {
  return request<SeasonAnnouncement>('POST', `/seasons/${seasonId}/announcements`, body)
}
