import { request } from './client-api'
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
