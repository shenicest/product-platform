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
