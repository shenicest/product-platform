interface ApiError {
  status: number
  body: { error: { code: string; message: string; field?: string } }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ data: T | null; error: ApiError | null }> {
  const headers: Record<string, string> = {}
  if (body) headers['content-type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
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

export interface ProjectData {
  id: number
  userId: string
  status: number
  likeCount: number
  name: string
  tagline: string | null
  description: string | null
  coverUrl: string | null
  demoImages: string[] | null
  demoVideoUrl: string | null
  demoLink: string | null
  stage: number | null
  categories: string[] | null
  targetUsers: string | null
  userProblem: string | null
  progress: string | null
  nextSteps: string | null
  messageToUsers: string | null
  isOpenForBeta: boolean | null
  betaDescription: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  contactWechat: string | null
  teamName: string | null
  createdAt: string
  updatedAt: string
}

export interface ProposalData {
  id: number
  projectId: number
  changes: Record<string, unknown>
  status: number
  reason: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export function sendLoginCode(identifier: string) {
  return request<{ success: boolean; error?: string }>('POST', '/auth/send-code', {
    identifier,
  })
}

export function verifyLoginCode(identifier: string, code: string) {
  return request<{ success: boolean; error?: string }>(
    'POST',
    '/auth/verify-code',
    { identifier, code },
  )
}

export function loginLogout() {
  return request<{ success: boolean }>('POST', '/auth/logout')
}

export function createProject(body: Record<string, unknown>) {
  return request<ProjectData>('POST', '/projects', body)
}

export function saveDraft(projectId: number, body: Record<string, unknown>) {
  return request<ProjectData>('PUT', `/projects/${projectId}/draft`, body)
}

export function submitForReview(projectId: number) {
  return request<ProjectData>('PUT', `/projects/${projectId}/submit`)
}

export function createProjectProposal(projectId: number, changes: Record<string, unknown>) {
  return request<ProposalData>('POST', `/projects/${projectId}/proposals`, { changes })
}

export function updateProjectProposal(projectId: number, proposalId: number, changes: Record<string, unknown>) {
  return request<ProposalData>('PUT', `/projects/${projectId}/proposals/${proposalId}`, { changes })
}

export function getProject(projectId: number) {
  return request<ProjectData>('GET', `/projects/${projectId}`)
}

export function likeProject(projectId: number) {
  return request<{ liked: boolean; likeCount: number }>('POST', `/projects/${projectId}/like`)
}

export function unlikeProject(projectId: number) {
  return request<{ liked: boolean; likeCount: number }>('DELETE', `/projects/${projectId}/like`)
}

export function followFounder(userId: string) {
  return request<{ followed: boolean; followerCount: number }>('POST', `/founders/${userId}/follow`)
}

export function unfollowFounder(userId: string) {
  return request<{ followed: boolean; followerCount: number }>('DELETE', `/founders/${userId}/follow`)
}
