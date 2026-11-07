import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'
import type {
  MySeasonApplication,
  SeasonAnnouncement,
  SeasonChallenge,
  SeasonDetail,
  SeasonListResponse,
  SeasonSummary,
} from '@/lib/boomland'

async function authHeaders() {
  const token = (await cookies()).get('shenicest_token')?.value
  return token ? { cookie: `shenicest_token=${token}` } : undefined
}

export type ListSeasonsQuery = {
  status?: string
  type?: 'season' | 'hackathon'
  city?: string
  theme?: string
  q?: string
  page?: number
  pageSize?: number
}

export const getSeasons = cache(async (query: ListSeasonsQuery = {}): Promise<SeasonListResponse> => {
  const { data, error } = await api.seasons.get({
    query,
    headers: await authHeaders(),
  })
  if (error || !data) throw new Error('Failed to load seasons')
  return data as SeasonListResponse
})

export const getSeason = cache(async (id: number): Promise<SeasonDetail | null> => {
  const { data, error } = await api.seasons({ id }).get({
    headers: await authHeaders(),
  })
  if ((error as { status?: number } | null)?.status === 404) return null
  if (error || !data) throw new Error('Failed to load season')
  return data as SeasonDetail
})

export const getSeasonAnnouncements = cache(
  async (id: number): Promise<SeasonAnnouncement[]> => {
    const { data, error } = await api.seasons({ id }).announcements.get({
      headers: await authHeaders(),
    })
    if (error || !data) throw new Error('Failed to load season announcements')
    return (data as { items: SeasonAnnouncement[] }).items
  },
)

export const getSeasonChallenges = cache(
  async (id: number): Promise<SeasonChallenge[]> => {
    const { data, error } = await api.seasons({ id }).challenges.get({
      headers: await authHeaders(),
    })
    if (error || !data) throw new Error('Failed to load season challenges')
    return (data as { items: SeasonChallenge[] }).items
  },
)

export const getHackathonSeasons = cache(async (): Promise<SeasonSummary[]> => {
  const { data, error } = await api.seasons.get({
    query: { type: 'hackathon', pageSize: 6 },
    headers: await authHeaders(),
  })
  if (error || !data) return []
  return (data as SeasonListResponse).items
})

export const getMySeasonApplication = cache(
  async (seasonId: number): Promise<MySeasonApplication | null> => {
    const headers = await authHeaders()
    if (!headers) return null
    const { data, error } = await api.me.applications.get({
      query: { seasonId },
      headers,
    })
    if (error || !data) return null
    const item = (data as { items: MySeasonApplication[] }).items[0]
    return item ?? null
  },
)

export const getMyApplications = cache(
  async (query: { page?: number; pageSize?: number } = {}): Promise<{
    items: MySeasonApplication[]
    total: number
    page: number
    pageSize: number
  }> => {
    const headers = await authHeaders()
    if (!headers) return { items: [], total: 0, page: 1, pageSize: 20 }
    const { data, error } = await api.me.applications.get({ query, headers })
    if (error || !data) throw new Error('Failed to load applications')
    return data as {
      items: MySeasonApplication[]
      total: number
      page: number
      pageSize: number
    }
  },
)
