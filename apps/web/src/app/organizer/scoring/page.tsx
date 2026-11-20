import type { Metadata } from 'next'
import { ScoringConsole } from '@/components/organizer/scoring/scoring-console'
import { redirectToDemoSeason } from '@/server/organizer-demo'

export const metadata: Metadata = { title: '评委与积分池 · 主办方后台' }

export const dynamic = 'force-dynamic'

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await redirectToDemoSeason(props.searchParams, '/organizer/scoring')
  return <ScoringConsole />
}
