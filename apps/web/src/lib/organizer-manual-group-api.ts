import { request } from './client-api'
import type { SeasonParticipant } from './organizer-manual-group'

/**
 * 人工拉群 tab 的**写**客户端。
 *
 * 复用 `client-api` 的 `request`：同源 `/api/*`，浏览器自动带 httpOnly cookie，
 * 统一返回 `{ data, error }`。错误体形状是 `{ error: { code, message, field } }`，
 * 由调用方（视图）负责展示 `message` —— 状态机冲突（409 `WECHAT_STATUS_INVALID`）
 * 和「选手已退出」（409 `PARTICIPANT_WITHDRAW_LOCKED`）都在这里原样透出。
 *
 * 读操作不在这里：Server 端走 `@/server/organizer`。
 */

/**
 * `PATCH /seasons/:id/participants/:userId/wechat` —— 记录微信群状态。
 *
 * 状态机由后端判定；相同状态幂等返回 200，非法跳转返回 409。
 * 响应是更新后的整行，调用方可以直接用它替换本地那一行，不必重取整页。
 */
export function updateParticipantWechat(
  seasonId: number,
  userId: string,
  status: string,
) {
  return request<SeasonParticipant>(
    'PATCH',
    `/seasons/${seasonId}/participants/${encodeURIComponent(userId)}/wechat`,
    { status },
  )
}
