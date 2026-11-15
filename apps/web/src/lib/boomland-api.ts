import { request } from './client-api'
import type {
  CreateSeasonApplicationBody,
  MySeasonApplication,
  SeasonApplication,
} from './boomland'

export function createSeasonApplication(
  seasonId: number,
  body: CreateSeasonApplicationBody,
) {
  return request<SeasonApplication>('POST', `/seasons/${seasonId}/applications`, body)
}

export function listMyApplications(query: { seasonId?: number; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams()
  if (query.seasonId) params.set('seasonId', String(query.seasonId))
  if (query.page) params.set('page', String(query.page))
  if (query.pageSize) params.set('pageSize', String(query.pageSize))
  const suffix = params.size ? `?${params.toString()}` : ''
  return request<{ items: MySeasonApplication[]; total: number; page: number; pageSize: number }>(
    'GET',
    `/me/applications${suffix}`,
  )
}

export function withdrawSeasonApplication(applicationId: number) {
  return request<SeasonApplication>('POST', `/applications/${applicationId}/withdraw`)
}

/**
 * `POST /seasons/:id/participants/:userId/withdraw` —— 退出赛季。
 *
 * 报名页的「退出赛季」用它：`confirm` 必须为 true，后端凭这个字段区分误触与
 * 真的要走，缺了会 400 `VALIDATION_ERROR`。组队截止后本人不能再退（409
 * `PARTICIPANT_WITHDRAW_LOCKED`），只能由主办方处理。
 */
export function withdrawSeasonParticipant(seasonId: number, userId: string) {
  return request<unknown>(
    'POST',
    `/seasons/${seasonId}/participants/${encodeURIComponent(userId)}/withdraw`,
    { confirm: true },
  )
}
