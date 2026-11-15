import type { Metadata } from 'next'
import { TalentList } from '@/components/talent/talent-ui'
import { parseTalentParams, TALENT_PAGE_SIZE } from '@/lib/talent'
import { pageMetadata } from '@/lib/site-metadata'
import { getTalents } from '@/server/talent'

export const metadata: Metadata = pageMetadata({
  title: '人才广场',
  description:
    '看看社区里正在做产品的人，了解他们能做什么、想参与什么，再决定是否开始一次沟通。',
  path: '/talents',
})

export const dynamic = 'force-dynamic'
export default async function TalentsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await props.searchParams
  const params = parseTalentParams(search)
  const query = new URLSearchParams({ sort: params.sort, offset: String((params.page - 1) * TALENT_PAGE_SIZE), limit: String(TALENT_PAGE_SIZE) })
  if (params.q) query.set('q', params.q)
  if (params.skills) query.set('skills', params.skills)
  if (params.duration) query.set('duration', params.duration)
  const result = await getTalents(query.toString())
  return <TalentList profiles={result.data?.data ?? []} total={result.data?.total ?? 0} params={params} />
}
