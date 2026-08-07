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

export const getProjectWithAuth = cache(async (id: number) => {
  const jar = await cookies()
  const token = jar.get('shenicest_token')?.value
  const headers = token ? { cookie: `shenicest_token=${token}` } : undefined
  const { data, error } = await api.projects({ id }).get({ headers })
  if (error?.status === 404) return null
  if (error || !data) throw new Error('Failed to load project')
  return data
})
