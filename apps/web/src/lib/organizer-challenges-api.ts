import { request } from './client-api'
import type {
  ChallengeDraftPayload,
  ChallengeDto,
  ChallengeResourceDto,
  ChallengeResourcePayload,
  CooperationPayload,
  EnterpriseCooperationDto,
} from './organizer-challenges'

/**
 * 命题与资源 tab 的**写**客户端。
 *
 * 全部复用 `client-api` 的 `request`：同源 `/api/*`、浏览器自动带 httpOnly cookie、
 * 统一返回 `{ data, error }`。错误体形状是 `{ error: { code, message, field } }`，
 * 由调用方（视图 / 弹窗）负责展示 `message`。
 *
 * 读操作不在这里：Server 端走 `@/server/organizer`（页面首屏），
 * 写成功之后一律 `router.refresh()` 让服务端重新取 —— 不在客户端维护一份副本，
 * 否则「表格里的数据」和「服务端的数据」迟早会分叉。
 */

/** `POST /seasons/:id/challenges` —— 新建命题草稿（后端固定落 `draft`）。 */
export function createChallenge(seasonId: number, body: ChallengeDraftPayload) {
  return request<ChallengeDto>('POST', `/seasons/${seasonId}/challenges`, body)
}

/** `PATCH /challenges/:id` —— 改命题内容；已发布的命题会让 `version` +1。 */
export function updateChallenge(challengeId: number, body: ChallengeDraftPayload) {
  return request<ChallengeDto>('PATCH', `/challenges/${challengeId}`, body)
}

/**
 * 命题状态流转。
 *
 * 四个动作各自一条接口，语义写在路径里（publish / reference / close / archive），
 * 所以这里不做通用的 `updateStatus`：合并成一个函数会让人以为状态可以随便设。
 */
export function publishChallenge(challengeId: number) {
  return request<ChallengeDto>('POST', `/challenges/${challengeId}/publish`)
}

export function markChallengeReference(challengeId: number) {
  return request<ChallengeDto>('POST', `/challenges/${challengeId}/reference`)
}

export function closeChallenge(challengeId: number) {
  return request<ChallengeDto>('POST', `/challenges/${challengeId}/close`)
}

export function archiveChallenge(challengeId: number) {
  return request<ChallengeDto>('POST', `/challenges/${challengeId}/archive`)
}

/** `PUT /challenges/:id/resources` —— 整表替换资源清单（语义同规则卡）。 */
export function replaceChallengeResources(challengeId: number, body: ChallengeResourcePayload) {
  return request<{ items: ChallengeResourceDto[] }>(
    'PUT',
    `/challenges/${challengeId}/resources`,
    body,
  )
}

/** `PATCH /challenges/resources/:id` —— 单条资源的局部更新（主要用来改状态）。 */
export function updateChallengeResource(
  resourceId: number,
  body: Partial<{
    kind: string
    title: string
    quantity: string | null
    conditions: string | null
    owner: string | null
    status: string
  }>,
) {
  return request<ChallengeResourceDto>('PATCH', `/challenges/resources/${resourceId}`, body)
}

/** `PUT /seasons/:id/cooperations` —— 整表替换企业合作配置。 */
export function replaceCooperations(seasonId: number, body: CooperationPayload) {
  return request<{ items: EnterpriseCooperationDto[] }>(
    'PUT',
    `/seasons/${seasonId}/cooperations`,
    body,
  )
}
