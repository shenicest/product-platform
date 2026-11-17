import { request } from './client-api'
import type { SeasonManageDetail } from './organizer'
import type { PlatformOrgMember } from './platform-console'
import type { OrganizerOrg } from './organizer'

/**
 * 平台后台的写操作客户端。
 *
 * 读请求全部在 `src/server/platform-console.ts`（Server Component 直接取数）；
 * 这里只放按钮会触发的写操作，复用 `client-api` 的 `request`：同源 `/api/*`，
 * 浏览器自动带 httpOnly cookie，统一返回 `{ data, error }` 由弹窗处理。
 *
 * 这些接口在后端都要求 `Role.Operator`（`operatorOnly`）。主办方组织成员进得来
 * 平台后台，但按钮是禁用的 —— 前端不发送注定 403 的请求。
 */

/** `POST /seasons/:id/approve` —— 批准待批赛季（管理员）。 */
export function approveSeason(seasonId: number) {
  return request<SeasonManageDetail>('POST', `/seasons/${seasonId}/approve`)
}

/**
 * `POST /seasons/:id/reject` —— 驳回待批赛季并退回草稿（管理员）。
 *
 * 原因必填（后端要求 ≥2 字）：驳回会清空 `approvedAt` 并把写作 `draft`，
 * 主办方要能从这里读到自己该改什么。
 */
export function rejectSeason(seasonId: number, reason: string) {
  return request<SeasonManageDetail>('POST', `/seasons/${seasonId}/reject`, { reason })
}

/** `POST /admin/organizer-orgs` —— 新建主办方组织（管理员）。 */
export function createOrganizerOrg(name: string) {
  return request<OrganizerOrg>('POST', '/admin/organizer-orgs', { name })
}

/** `PATCH /admin/organizer-orgs/:id` —— 重命名组织（管理员）。 */
export function renameOrganizerOrg(orgId: number, name: string) {
  return request<{ id: number; name: string }>('PATCH', `/admin/organizer-orgs/${orgId}`, { name })
}

/** `POST /admin/organizer-orgs/:id/members` —— 把用户加入组织（管理员）。 */
export function addOrganizerMember(orgId: number, userId: string) {
  return request<PlatformOrgMember>('POST', `/admin/organizer-orgs/${orgId}/members`, {
    userId: userId.trim(),
  })
}

/**
 * `DELETE /admin/organizer-orgs/:id/members/:userId` —— 移除组织成员（管理员）。
 *
 * 后端返回 204（无响应体）。`request` 对 204 直接给 `{ data: null, error: null }`。
 * 组织仍有赛季关联时后端会拒绝移除最后一名成员（409），文案原样展示。
 */
export function removeOrganizerMember(orgId: number, userId: string) {
  return request<null>(
    'DELETE',
    `/admin/organizer-orgs/${orgId}/members/${encodeURIComponent(userId)}`,
  )
}
