import { cache } from 'react'
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
