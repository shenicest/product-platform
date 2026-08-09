import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'

export class OperatorApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

function authHeaders(token: string | null | undefined) {
  return token ? { cookie: `shenicest_token=${token}` } : undefined
}

export const getOperatorToken = cache(async () => {
  const jar = await cookies()
  return jar.get('shenicest_token')?.value ?? null
})

export interface OperatorProjectQuery {
  status?: number
  stage?: number
  category?: string
  q?: string
  sort?: 'created_at' | 'updated_at'
  order?: 'asc' | 'desc'
  offset?: number
  limit?: number
}

export const getOperatorStats = cache(async () => {
  const token = await getOperatorToken()
  const { data, error } = await api.operator.stats.get({ headers: authHeaders(token) })
  if (error) {
    throw new OperatorApiError('Failed to load operator stats', typeof error.status === 'number' ? error.status : 500)
  }
  if (!data) {
    throw new OperatorApiError('Failed to load operator stats', 500)
  }
  return data
})

export const getOperatorProjects = cache(async (query: OperatorProjectQuery = {}) => {
  const token = await getOperatorToken()
  const { data, error } = await api.operator.projects.get({ query, headers: authHeaders(token) })
  if (error) {
    throw new OperatorApiError('Failed to load operator projects', typeof error.status === 'number' ? error.status : 500)
  }
  if (!data) {
    throw new OperatorApiError('Failed to load operator projects', 500)
  }
  return data
})

export type OperatorProject = Awaited<ReturnType<typeof getOperatorProjects>>['data'][number]

export interface OperatorProposalQuery {
  projectId?: number
  stage?: number
  category?: string
  offset?: number
  limit?: number
}

export const getOperatorProposals = cache(async (query: OperatorProposalQuery = {}) => {
  const token = await getOperatorToken()
  const { data, error } = await api.operator.proposals.get({ query, headers: authHeaders(token) })
  if (error) {
    throw new OperatorApiError('Failed to load operator proposals', typeof error.status === 'number' ? error.status : 500)
  }
  if (!data) {
    throw new OperatorApiError('Failed to load operator proposals', 500)
  }
  return data
})

export type OperatorProposal = Awaited<ReturnType<typeof getOperatorProposals>>['data'][number]

export const getOperatorProjectProposals = cache(async (projectId: number) => {
  const token = await getOperatorToken()
  const { data, error } = await api.operator.projects({ id: projectId }).proposals.get({ headers: authHeaders(token) })
  if (error) {
    throw new OperatorApiError('Failed to load project proposals', typeof error.status === 'number' ? error.status : 500)
  }
  if (!data) {
    throw new OperatorApiError('Failed to load project proposals', 500)
  }
  return data
})

export interface OperatorAuditRecordQuery {
  projectId?: number
  from?: string
  to?: string
  offset?: number
  limit?: number
}

interface AuditRecordRow {
  id: number
  projectId: number
  operatorId: string
  action: string
  proposalId: number | null
  reason: string | null
  createdAt: Date
}

interface AuditRecordResponse {
  data: AuditRecordRow[]
  total: number
}

export const getOperatorAuditRecords = cache(async (query: OperatorAuditRecordQuery = {}) => {
  const token = await getOperatorToken()
  const client = api.operator['audit-records'] as unknown as {
    get: (opts: { query?: OperatorAuditRecordQuery; headers?: Record<string, string> }) => Promise<{
      data: AuditRecordResponse | null
      error: { status: number } | null
    }>
  }
  const { data, error } = await client.get({ query, headers: authHeaders(token) })
  if (error) {
    throw new OperatorApiError('Failed to load audit records', typeof error.status === 'number' ? error.status : 500)
  }
  if (!data) {
    throw new OperatorApiError('Failed to load audit records', 500)
  }
  return data
})

export type AuditRecord = AuditRecordRow

export const getOperatorProject = cache(async (id: number) => {
  const token = await getOperatorToken()
  const headers = authHeaders(token)
  const { data, error } = await api.projects({ id }).get({ headers })
  if (error?.status === 404) return null
  if (error || !data) {
    throw new OperatorApiError('Failed to load project', typeof error.status === 'number' ? error.status : 500)
  }
  return data
})

export const getOperatorProposal = cache(async (proposalId: number) => {
  const token = await getOperatorToken()
  const headers = authHeaders(token)
  const { data, error } = await api.operator.proposals.get({
    query: { limit: 1000 },
    headers,
  })
  if (error || !data) {
    throw new OperatorApiError('Failed to load proposals', typeof error.status === 'number' ? error.status : 500)
  }
  const proposal = data.data.find((p) => p.id === proposalId) ?? null
  return proposal
})
