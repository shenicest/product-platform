import { cache } from 'react'
import { api } from '@/lib/api'

export const getLiveProjects = cache(async () => {
  const { data, error } = await api.projects.get()
  if (error || !data) {
    throw new Error('Failed to load live projects')
  }
  return data
})

export type ProjectListResponse = Awaited<ReturnType<typeof getLiveProjects>>
export type Project = ProjectListResponse['data'][number]
