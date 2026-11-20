import type { Metadata } from 'next'
import { AuditConsole } from '@/components/organizer/audit/audit-console'
import { redirectToDemoSeason } from '@/server/organizer-demo'

export const metadata: Metadata = { title: '审计 · 主办方后台' }

export const dynamic = 'force-dynamic'

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await redirectToDemoSeason(props.searchParams, '/organizer/audit')
  return <AuditConsole />
}
