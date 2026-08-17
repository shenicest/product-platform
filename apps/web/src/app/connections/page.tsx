import { redirect } from 'next/navigation'
import { ConnectionsPanel } from '@/components/talent/talent-ui'
import { getSessionUser } from '@/server/auth'
import { getConnections } from '@/server/talent'

export const dynamic = 'force-dynamic'
export default async function ConnectionsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login?returnTo=/connections')
  const result = await getConnections()
  if (!result.data) throw new Error('Failed to load connections')
  return <ConnectionsPanel initial={result.data} userId={user.userId} />
}
