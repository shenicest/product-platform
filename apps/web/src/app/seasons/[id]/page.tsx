import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { SeasonDetailPage } from '@/components/boomland/season-detail'
import {
  getMySeasonApplication,
  getSeason,
  getSeasonAnnouncements,
  getSeasonChallenges,
} from '@/server/boomland'

export const dynamic = 'force-dynamic'

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
