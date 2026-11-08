import { request } from './client-api'
import type { ChallengeDetailDto } from './challenge-detail'

/**
 * 命题详情页的**写**客户端（关注 / 取关）。
 *
 * 读操作不在这里：Server 端走 `@/server/challenge-detail`（页面首屏）。
 * 关注成功后由调用方就地更新计数，不需要 `router.refresh()` —— 关注不改变
 * 命题内容，刷新整页只会让用户丢掉当前 tab。
 */

export function followChallenge(challengeId: number) {
  return request<{ followed: boolean; followCount: number }>(
    'POST',
    `/challenges/${challengeId}/follow`,
  )
}

export function unfollowChallenge(challengeId: number) {
  return request<{ followed: boolean; followCount: number }>(
    'DELETE',
    `/challenges/${challengeId}/follow`,
  )
}

export type { ChallengeDetailDto }
