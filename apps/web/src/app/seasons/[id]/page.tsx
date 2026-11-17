import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import type { Metadata } from 'next'
import { SeasonDetailPage } from '@/components/boomland/season-detail'
import { NO_INDEX_ROBOTS, pageMetadata } from '@/lib/site-metadata'
import {
  getMySeasonApplication,
  getSeason,
  getSeasonAnnouncements,
  getSeasonChallenges,
} from '@/server/boomland'

export const dynamic = 'force-dynamic'

/**
 * 分享卡片：赛季名 + 简介 + 站内 canonical。
 * `getSeason` 内部有 `cache()`，metadata 与页面各取一次不会重复请求。
 */
export async function generateMetadata(
  props: PageProps<'/seasons/[id]'>,
): Promise<Metadata> {
  const rawId = (await props.params).id
  if (!/^\d+$/.test(rawId)) return { title: '赛季不可用', robots: NO_INDEX_ROBOTS }
  const season = await getSeason(Number(rawId)).catch(() => null)
  if (!season) return { title: '赛季不可用', robots: NO_INDEX_ROBOTS }

  return pageMetadata({
    title: season.name,
    description: season.intro,
    path: `/seasons/${season.id}`,
    type: 'article',
  })
}

/**
 * 单场赛季详情页。
 *
 * 落地页 `/seasons` 的票券整卡链到这里。公告是详情页左栏的内容，
 * 单独走 `GET /seasons/:id/announcements`；读取失败时降级为空列表，
 * 不让一条公告把整页打成错误页。
 */
export default async function SeasonPage(props: PageProps<'/seasons/[id]'>) {
  const rawId = (await props.params).id
  if (!/^\d+$/.test(rawId)) notFound()
  const seasonId = Number(rawId)

  const season = await getSeason(seasonId).catch(() => null)
  if (!season) notFound()

  const isLoggedIn = Boolean((await cookies()).get('shenicest_token')?.value)

  const [challenges, announcements, myApplication] = await Promise.all([
    getSeasonChallenges(seasonId).catch(() => []),
    getSeasonAnnouncements(seasonId).catch(() => []),
    isLoggedIn ? getMySeasonApplication(seasonId).catch(() => null) : Promise.resolve(null),
  ])

  return (
    <SeasonDetailPage
      season={season}
      challenges={challenges}
      announcements={announcements}
      myApplication={myApplication}
      isLoggedIn={isLoggedIn}
    />
  )
}
