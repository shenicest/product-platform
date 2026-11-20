import type { Metadata } from 'next'
import { RulesArchiveView } from '@/components/organizer/rules/rules-archive-view'
import { redirectToDemoSeason } from '@/server/organizer-demo'

export const metadata: Metadata = { title: '规则归档 · 主办方后台' }

export const dynamic = 'force-dynamic'

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await redirectToDemoSeason(props.searchParams, '/organizer/rules')
  return <RulesArchiveView />
}
