import { TalentList } from '@/components/talent/talent-ui'
import { parseTalentParams, TALENT_PAGE_SIZE } from '@/lib/talent'
import { getTalents } from '@/server/talent'

export const dynamic = 'force-dynamic'
export default async function TalentsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await props.searchParams
  const params = parseTalentParams(search)
  const query = new URLSearchParams({ sort: params.sort, offset: String((params.page - 1) * TALENT_PAGE_SIZE), limit: String(TALENT_PAGE_SIZE) })
  if (params.q) query.set('q', params.q)
  if (params.role) query.set('role', params.role)
  if (params.skills) query.set('skills', params.skills)
  if (params.duration) query.set('duration', params.duration)
  const result = await getTalents(query.toString())
  return <TalentList profiles={result.data?.data ?? []} total={result.data?.total ?? 0} params={params} />
}
