import type { Metadata } from 'next'
import { ProjectsReviewView } from '@/components/organizer/projects/projects-review-view'
import { redirectToDemoSeason } from '@/server/organizer-demo'

export const metadata: Metadata = { title: '项目与进度 · 主办方后台' }

export const dynamic = 'force-dynamic'

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await redirectToDemoSeason(props.searchParams, '/organizer/projects')
  return <ProjectsReviewView />
}
