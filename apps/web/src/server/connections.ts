import { cache } from 'react'
import { cookies } from 'next/headers'
import { API_URL } from '@/lib/api-url'
import type { ConnectionsResult } from '@/lib/connections'

// Unified connections aggregate for the /connections page (ticket 07);
// fetch failures degrade to null data just like the other server data fns.
async function connectionsRequest(): Promise<ConnectionsResult | null> {
  try {
    const token = (await cookies()).get('shenicest_token')?.value
    const response = await fetch(`${API_URL}/connections`, {
      headers: token ? { cookie: `shenicest_token=${token}` } : {},
      cache: 'no-store',
    })
    if (!response.ok) return null
    return (await response.json()) as ConnectionsResult
  } catch {
    return null
  }
}

export const getConnections = cache(connectionsRequest)
