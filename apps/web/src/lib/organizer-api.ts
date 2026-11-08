import { request } from './client-api'
import type {
  ApplicationAuditEntry,
  ApplicationDetail,
  ApplicationReviewTarget,
} from './organizer-applications'
import type { CreateSeasonPayload, SeasonManageDetail } from './organizer'

/**
 * 主办方后台的读写客户端。
 *
 * 复用 `client-api` 的 `request`：同源 `/api/*`，浏览器自动带 httpOnly cookie，
 * 统一返回 `{ data, error }` 由表单处理。
 */

/** `POST /seasons` —— 新建一个赛季草稿（后端固定落 draft，不会直接发布）。 */
export function createSeasonDraft(body: CreateSeasonPayload) {
  return request<SeasonManageDetail>('POST', '/seasons', body)
}

/**
 * `GET /seasons/:id/manage` —— 某个赛季的完整字段。
 *
 * “复制上季”在弹窗里现取源赛季：Header 是客户端组件，读不到 Server 端的
 * `cookies()`，所以这条读请求也走同源 `fetch`。
 */
export function getSeasonManageDetail(seasonId: number) {
  return request<SeasonManageDetail>('GET', `/seasons/${seasonId}/manage`)
}

/**
 * `PATCH /applications/:id/status` —— 报名审核。
 *
 * `reason` 只有拒绝时必填（后端强制），其余动作可选：填了就写进审计，
 * 不填就不留痕。返回管理视图（含解密后的联系方式），调用方据此局部更新。
 */
export function updateApplicationStatus(
  applicationId: number,
  body: { status: ApplicationReviewTarget; reason?: string },
) {
  return request<ApplicationDetail>('PATCH', `/applications/${applicationId}/status`, body)
}

/**
 * `GET /applications/:id` —— 单条报名详情（含解密后的联系方式）。
 *
 * 列表只给掩码，点开详情才取明文：这条分界在后端，前端不缓存也不落盘。
 */
export function getApplicationDetail(applicationId: number) {
  return request<ApplicationDetail>('GET', `/applications/${applicationId}`)
}

/** `GET /seasons/:id/audit-logs` —— 某条报名的审核历史（按 target 过滤）。 */
export function getApplicationAuditTrail(seasonId: number, applicationId: number) {
  const params = new URLSearchParams({
    targetType: 'season_application',
    targetId: String(applicationId),
    pageSize: '50',
  })
  return request<{ items: ApplicationAuditEntry[]; total: number }>(
    'GET',
    `/seasons/${seasonId}/audit-logs?${params.toString()}`,
  )
}
