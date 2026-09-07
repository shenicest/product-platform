import { cache } from 'react'
import { cookies } from 'next/headers'
import { API_URL } from '@/lib/api-url'
import type { MyHackathonConnectionStatus } from '@/lib/client-api'

// Status summary for the detail-page connect button. A logged-out visitor (or
// any error) degrades to null — "gating unknown" — so the page still renders
// the button and the visitor can reach login; the server re-evaluates after
// login. The public project detail stays non-personalized either way.
async function statusRequest(projectId: number): Promise<MyHackathonConnectionStatus | null> {
  try {
    const token = (await cookies()).get('shenicest_token')?.value
    const response = await fetch(`${API_URL}/hackathon/projects/${projectId}/connections/me`, {
      headers: token ? { cookie: `shenicest_token=${token}` } : {},
      cache: 'no-store',
    })
    if (!response.ok) return null
    return (await response.json()) as MyHackathonConnectionStatus
  } catch {
    return null
  }
}

export const getMyHackathonConnectionStatus = cache(statusRequest)
