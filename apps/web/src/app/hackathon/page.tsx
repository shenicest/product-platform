import { getHackathonProjects } from '@/server/projects'
import { HackathonShowcase } from '@/components/hackathon-showcase'
import { PublicInteractionBoundary } from '@/components/public-interaction-boundary'
import { Pagination } from '@/components/pagination'
import { PAGE_SIZE, parseListParams, type SearchParams } from '@/lib/project-filters'

export const metadata = { title: '黑客松专区' }
export const dynamic = 'force-dynamic'

export default async function HackathonPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams
  const { page, q } = parseListParams(searchParams)
  const trackValue = Array.isArray(searchParams.track) ? searchParams.track[0] : searchParams.track
  const track = trackValue === 'software' || trackValue === 'hardware' || trackValue === 'game' || trackValue === 'aigc' ? trackValue : undefined
  const { data, total } = await getHackathonProjects({
    offset: (page - 1) * PAGE_SIZE,
    limit: PAGE_SIZE,
    track,
    q,
  })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return <PublicInteractionBoundary><HackathonShowcase projects={data} total={total} selectedTrack={track ?? 'all'} query={q ?? ''} /><Pagination page={page} totalPages={totalPages} searchParams={searchParams} basePath="/hackathon" /></PublicInteractionBoundary>
}
