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

export function getBathSlots(date: string, gender?: 'male' | 'female') {
  const params = new URLSearchParams({ date })
  if (gender) params.set('gender', gender)
  return request<{ date: string; gender: 'male' | 'female'; eventStart: string; eventEnd: string; dailyStart: string; dailyEnd: string; canSelectGender: boolean; myBooking: { id: number; timeSlot: string; durationSlots: 1 | 2; checkedOutAt: string | null } | null; slots: Array<{ timeSlot: string; booked: boolean; name?: string; bookingId?: number; isMine?: boolean }> }>('GET', `/bath/slots?${params}`)
}

export function getBathConfig() {
  return request<{ eventStart: string; eventEnd: string; dailyStart: string; dailyEnd: string }>('GET', '/bath/config')
}

export function updateBathConfig(body: { eventStart: string; eventEnd: string; dailyStart: string; dailyEnd: string }) {
  return request<{ eventStart: string; eventEnd: string; dailyStart: string; dailyEnd: string }>('PUT', '/bath/config', body)
}

export function bookBathSlot(date: string, timeSlot: string, durationSlots: 1 | 2, gender?: 'male' | 'female') {
  return request<{ id: number; date: string; timeSlot: string; durationSlots: 1 | 2; gender: string }>('POST', '/bath/bookings', { date, timeSlot, durationSlots, ...(gender ? { gender } : {}) })
}

export function cancelBathSlot(bookingId: number) {
  return request<{ success: boolean }>('DELETE', `/bath/bookings/${bookingId}`)
}

export function checkoutBathSlot(bookingId: number) {
  return request<{ success: boolean; checkedOutAt: string }>('POST', `/bath/bookings/${bookingId}/checkout`)
}

import type { TalentBody, TalentConnection, TalentManagement, TalentProfile } from '@/lib/talent'
export function listTalents(query: Record<string, string | number | undefined>) { return request<{ data: TalentProfile[]; total: number }>('GET', `/talents?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))}`) }
export function getTalent(userId: string) { return request<TalentProfile>('GET', `/talents/${encodeURIComponent(userId)}`) }
export function getMyTalent() { return request<TalentManagement>('GET', '/talents/me') }
export function saveTalent(body: TalentBody, mode: 'publish' | 'update' | 'resume' = 'publish') { return request<TalentManagement>(mode === 'update' ? 'PUT' : 'POST', mode === 'resume' ? '/talents/me/resume' : '/talents/me', body) }
export function pauseTalent() { return request<TalentManagement>('POST', '/talents/me/pause') }
export function getConnections() { return request<{ data: TalentConnection[]; total: number; pendingReceived: number }>('GET', '/talents/connections') }
export function sendTalentConnection(body: { receiverUserId: string; projectId?: number; purpose: string; message: string; wechat?: string; email?: string }) { return request<TalentConnection>('POST', '/talents/connections', body) }
export function acceptTalentConnection(id: number, body: { wechat?: string; email?: string }) { return request<TalentConnection>('POST', `/talents/connections/${id}/accept`, body) }
export function ignoreTalentConnection(id: number) { return request<TalentConnection>('POST', `/talents/connections/${id}/ignore`) }
export function getTalentContacts(id: number) { return request<TalentConnection['contacts']>('GET', `/talents/connections/${id}/contacts`) }
export function listOperatorTalents(query: Record<string, string | number | undefined>) { return request<TalentManagement[]>('GET', `/operator/talents?${new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]))}`) }
export function getOperatorTalent(userId: string) { return request<TalentManagement>('GET', `/operator/talents/${encodeURIComponent(userId)}`) }
export function getTalentAudit(userId: string) { return request<Array<Record<string, unknown>>>('GET', `/operator/talents/${encodeURIComponent(userId)}/suspension-audit`) }
export function suspendTalent(userId: string, reason: string) { return request<TalentManagement>('POST', `/operator/talents/${encodeURIComponent(userId)}/suspend`, { reason }) }
