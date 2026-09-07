import { cache } from 'react'
import { cookies } from 'next/headers'
import { API_URL } from '@/lib/api-url'
import type { HackathonConnectionStatus } from '@/lib/client-api'

// Status summary for the detail-page button. A logged-out visitor (or any
// error) degrades to null — the public project detail stays non-personalized.
async function statusRequest(projectId: number): Promise<HackathonConnectionStatus | null> {
  try {
    const token = (await cookies()).get('shenicest_token')?.value
    const response = await fetch(`${API_URL}/hackathon/projects/${projectId}/connections/me`, {
      headers: token ? { cookie: `shenicest_token=${token}` } : {},
      cache: 'no-store',
    })
    if (!response.ok) return null
    const payload = (await response.json()) as { data: HackathonConnectionStatus | null }
    return payload.data
  } catch {
    return null
  }
}

export const getMyHackathonConnectionStatus = cache(statusRequest)
