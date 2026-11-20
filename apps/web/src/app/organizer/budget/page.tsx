import type { Metadata } from 'next'
import { BudgetConsole } from '@/components/organizer/budget/budget-console'
import { redirectToDemoSeason } from '@/server/organizer-demo'

export const metadata: Metadata = { title: '预算与结算 · 主办方后台' }

export const dynamic = 'force-dynamic'

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await redirectToDemoSeason(props.searchParams, '/organizer/budget')
  return <BudgetConsole />
}
