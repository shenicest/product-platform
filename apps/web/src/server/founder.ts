import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'
import type { ProjectStage } from '@shenicest/shared'

export interface FounderProjectQuery {
  status?: number
  stage?: ProjectStage
  q?: string
  offset?: number
  limit?: number
}

export type FounderProject = Awaited<ReturnType<typeof getFounderProjects>>['data'][number]

export class FounderApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export const getAuthToken = cache(async () => {
  const jar = await cookies()
  return jar.get('shenicest_token')?.value ?? null
})

export const getFounderProjects = cache(async (query: FounderProjectQuery = {}) => {
  const token = await getAuthToken()
  const headers = token ? { cookie: `shenicest_token=${token}` } : undefined
  const { data, error } = await api.founder.projects.get({ query, headers })
  if (error) {
    throw new FounderApiError('Failed to load founder projects', typeof error.status === 'number' ? error.status : 500)
  }
  if (!data) {
    throw new FounderApiError('Failed to load founder projects', 500)
  }
  return data
})

export const getFounderStats = cache(async () => {
  const token = await getAuthToken()
  const headers = token ? { cookie: `shenicest_token=${token}` } : undefined
  const { data, error } = await api.founder.stats.get({ headers })
  if (error) {
    throw new FounderApiError('Failed to load founder stats', typeof error.status === 'number' ? error.status : 500)
  }
  if (!data) {
    throw new FounderApiError('Failed to load founder stats', 500)
  }
  return data
})

export const getFounderProjectProposals = cache(async (projectId: number): Promise<ProposalList | null> => {
  const token = await getAuthToken()
  const headers = token ? { cookie: `shenicest_token=${token}` } : undefined
  const { data, error } = await api.founder.projects({ id: projectId }).proposals.get({ headers })
  if (error?.status === 404) return null
  if (error) {
    throw new FounderApiError('Failed to load project proposals', typeof error.status === 'number' ? error.status : 500)
  }
  if (!data) {
    throw new FounderApiError('Failed to load project proposals', 500)
  }
  return data as ProposalList
})

export interface AuditReason {
  action: string
  reason: string | null
  createdAt: Date
}

export interface Proposal {
  id: number
  projectId: number
  changes: Record<string, unknown>
  status: number
  reason: string | null
  reviewedBy: string | null
  reviewedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface ProposalList {
  data: Proposal[]
  total: number
}

export const getFounderProjectAuditReason = cache(async (projectId: number) => {
  const token = await getAuthToken()
  const headers = token ? { cookie: `shenicest_token=${token}` } : undefined
  const client = api.founder.projects({ id: projectId }) as unknown as Record<string, { get: (opts: { headers?: Record<string, string> }) => Promise<{ data: AuditReason | null; error: { status: number } | null }> }>
  const { data, error } = await client['audit-reason'].get({ headers })
  if (error?.status === 404) return null
  if (error) {
    throw new FounderApiError('Failed to load audit reason', typeof error.status === 'number' ? error.status : 500)
  }
  if (!data) {
    throw new FounderApiError('Failed to load audit reason', 500)
  }
  return data
})
