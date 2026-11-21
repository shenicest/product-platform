import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'
import { DEMO_MODE, DEMO_SEASONS, demoSeasonDetail } from '@/lib/demo-mode'
import type {
  MySeasonApplication,
  SeasonAnnouncement,
  SeasonChallenge,
  SeasonDetail,
  SeasonListResponse,
  SeasonSummary,
} from '@/lib/boomland'
import {
  pickCurrentSeason,
  toSeasonSpotlight,
  type SeasonSpotlight,
} from '@/lib/season-spotlight'

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
  if (DEMO_MODE) {
    const statuses = query.status?.split(',') ?? []
    const items = DEMO_SEASONS.filter((season) => {
      if (query.type && season.type !== query.type) return false
      if (statuses.length > 0 && !statuses.includes(String(season.status))) return false
      return true
    })
    return {
      items: [...items],
      total: items.length,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    }
  }

  const { data, error } = await api.seasons.get({
    query,
    headers: await authHeaders(),
  })
  if (error || !data) throw new Error('Failed to load seasons')
  return data as SeasonListResponse
})

export const getSeason = cache(async (id: number): Promise<SeasonDetail | null> => {
  if (DEMO_MODE) return demoSeasonDetail(id)

  const { data, error } = await api.seasons({ id }).get({
    headers: await authHeaders(),
  })
  if ((error as { status?: number } | null)?.status === 404) return null
  if (error || !data) throw new Error('Failed to load season')
  return data as SeasonDetail
})

export const getSeasonAnnouncements = cache(
  async (id: number): Promise<SeasonAnnouncement[]> => {
    if (DEMO_MODE) return []

    const { data, error } = await api.seasons({ id }).announcements.get({
      headers: await authHeaders(),
    })
    if (error || !data) throw new Error('Failed to load season announcements')
    return (data as { items: SeasonAnnouncement[] }).items
  },
)

export const getSeasonChallenges = cache(
  async (id: number): Promise<SeasonChallenge[]> => {
    if (DEMO_MODE) return []

    const { data, error } = await api.seasons({ id }).challenges.get({
      headers: await authHeaders(),
    })
    if (error || !data) throw new Error('Failed to load season challenges')
    return (data as { items: SeasonChallenge[] }).items
  },
)

/**
 * 首页「当前赛季」入口。
 *
 * 列表按「置顶 → 进行中 → 即将开始」挑选，再补一次详情拿简介与报名窗口；
 * 详情失败时退回列表字段，不把首页打成错误页。整个接口不可用时返回 null，
 * 首页会渲染空态入口（仍然链到 `/seasons`）。
 */
export const getCurrentSeasonSpotlight = cache(
  async (): Promise<SeasonSpotlight | null> => {
    const list = await getSeasons({ status: 'upcoming,active', pageSize: 20 }).catch(
      () => null,
    )
    const summary = pickCurrentSeason(list?.items ?? [])
    if (!summary) return null

    const detail = await getSeason(summary.id).catch(() => null)
    return toSeasonSpotlight(summary, detail, {
      // 列表接口已经过滤掉草稿 / 取消，这里只排除当前这一季，
      // 首页就能直接给出「并行 N 个赛季」的入口。
      parallelSeasons: (list?.items ?? []).filter((item) => item.id !== summary.id),
      now: new Date(),
    })
  },
)

export const getHackathonSeasons = cache(async (): Promise<SeasonSummary[]> => {
  if (DEMO_MODE) return DEMO_SEASONS.filter((season) => season.type === 'hackathon')

  const { data, error } = await api.seasons.get({
    query: { type: 'hackathon', pageSize: 6 },
    headers: await authHeaders(),
  })
  if (error || !data) return []
  return (data as SeasonListResponse).items
})

export const getMySeasonApplication = cache(
  async (seasonId: number): Promise<MySeasonApplication | null> => {
    if (DEMO_MODE) return null

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
    if (DEMO_MODE) {
      return { items: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 20 }
    }
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
