import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'
import type { ProjectFilters } from '@/lib/project-filters'

export interface ProjectListQuery extends ProjectFilters {
  offset?: number
  limit?: number
}

export const getLiveProjects = cache(async (query: ProjectListQuery = {}) => {
  const { data, error } = await api.projects.get({ query })
  if (error || !data) {
    throw new Error('Failed to load live projects')
  }
  return data
})

export const getFollowingProjects = cache(async (query: ProjectListQuery = {}) => {
  const token = (await cookies()).get('shenicest_token')?.value
  if (!token) throw new Error('Failed to load following projects')

  const { data, error } = await api.me.following.projects.get({
    query,
    headers: { cookie: `shenicest_token=${token}` },
  })
  if (error || !data) throw new Error('Failed to load following projects')
  return data
})

export type ProjectListResponse = Awaited<ReturnType<typeof getLiveProjects>>
export type Project = ProjectListResponse['data'][number]

// Returns null only when the API answers 404 — which covers both nonexistent
// projects and projects not visible to anonymous visitors (non-Live). Any other
// failure (network, 5xx) throws, matching getLiveProjects.
export const getProject = cache(async (id: number) => {
  const { data, error } = await api.projects({ id }).get()
  if (error?.status === 404) return null
  if (error || !data) throw new Error('Failed to load project')
  return data
})

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>

export const getHackathonProjects = cache(async (query: Pick<ProjectListQuery, 'offset' | 'limit' | 'q'> & { track?: 'software' | 'hardware' | 'game' | 'aigc' } = {}) => {
  const { data, error } = await api.hackathon.projects.get({ query })
  if (error || !data) throw new Error('Failed to load hackathon projects')
  return data
})

export const getHackathonProject = cache(async (id: number) => {
  const token = (await cookies()).get('shenicest_token')?.value
  const headers = token ? { cookie: `shenicest_token=${token}` } : undefined
  const { data, error } = await api.hackathon.projects({ id }).get({ headers })
  if (error?.status === 404) return null
  if (error || !data) throw new Error('Failed to load hackathon project')
  return data
})

export const getProjectWithAuth = cache(async (id: number) => {
  const jar = await cookies()
  const token = jar.get('shenicest_token')?.value
  const headers = token ? { cookie: `shenicest_token=${token}` } : undefined
  const { data, error } = await api.projects({ id }).get({ headers })
  if (error?.status === 404) return null
  if (error || !data) throw new Error('Failed to load project')
  return data
})
