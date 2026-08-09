interface ApiError {
  status: number
  body: { error: { code: string; message: string } }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: T | null; error: ApiError | null }> {
  const headers: Record<string, string> = {}
  if (body) headers['content-type'] = 'application/json'

  const res = await fetch(`/api/operator${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({
      error: { code: 'UNKNOWN', message: res.statusText },
    }))
    return { data: null, error: { status: res.status, body: errorBody } }
  }

  const data = (await res.json()) as T
  return { data, error: null }
}

export interface ProjectReviewResult {
  id: number
  status: number
}

export interface ProposalReviewResult {
  id: number
  status: number
}

export function approveProject(projectId: number) {
  return request<ProjectReviewResult>('POST', `/projects/${projectId}/approve`)
}

export function requireProjectRevision(projectId: number, reason: string) {
  return request<ProjectReviewResult>('POST', `/projects/${projectId}/require-revision`, { reason })
}

export function rejectProject(projectId: number, reason: string) {
  return request<ProjectReviewResult>('POST', `/projects/${projectId}/reject`, { reason })
}

export function delistProject(projectId: number, reason: string) {
  return request<ProjectReviewResult>('POST', `/projects/${projectId}/delist`, { reason })
}

export function restoreProject(projectId: number) {
  return request<ProjectReviewResult>('POST', `/projects/${projectId}/restore`)
}

export function approveProposal(proposalId: number) {
  return request<ProposalReviewResult>('POST', `/proposals/${proposalId}/approve`)
}

export function rejectProposal(proposalId: number, reason: string) {
  return request<ProposalReviewResult>('POST', `/proposals/${proposalId}/reject`, { reason })
}

export function requireProposalRevision(proposalId: number, reason: string) {
  return request<ProposalReviewResult>('POST', `/proposals/${proposalId}/require-revision`, { reason })
}
