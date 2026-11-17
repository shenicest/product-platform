import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ConnectionsPanel } from '@/components/connections/connections-panel'
import { NO_INDEX_ROBOTS } from '@/lib/site-metadata'
import { getSessionUser } from '@/server/auth'
import { getConnections } from '@/server/connections'

export const metadata: Metadata = {
  title: '连接记录',
  robots: NO_INDEX_ROBOTS,
}

export const dynamic = 'force-dynamic'
export default async function ConnectionsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?returnTo=/connections')
  const result = await getConnections()
  if (!result) throw new Error('Failed to load connections')
  return <ConnectionsPanel initial={result} userId={user.userId} />
}
