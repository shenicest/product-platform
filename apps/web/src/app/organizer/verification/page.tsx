import type { Metadata } from 'next'
import { VerificationConsole } from '@/components/organizer/verification/verification-console'
import { redirectToDemoSeason } from '@/server/organizer-demo'

export const metadata: Metadata = { title: '核验与异议 · 主办方后台' }

export const dynamic = 'force-dynamic'

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await redirectToDemoSeason(props.searchParams, '/organizer/verification')
  return <VerificationConsole />
}
