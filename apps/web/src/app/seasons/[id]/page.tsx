import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { SeasonDetailPage } from '@/components/boomland/season-detail'
import {
  getMySeasonApplication,
  getSeason,
  getSeasonChallenges,
} from '@/server/boomland'

export const dynamic = 'force-dynamic'

export default async function SeasonPage(props: PageProps<'/seasons/[id]'>) {
  const rawId = (await props.params).id
  if (!/^\d+$/.test(rawId)) notFound()
  const seasonId = Number(rawId)

  const season = await getSeason(seasonId).catch(() => null)
  if (!season) notFound()

  const isLoggedIn = Boolean((await cookies()).get('shenicest_token')?.value)

  const [challenges, myApplication] = await Promise.all([
    getSeasonChallenges(seasonId).catch(() => []),
    isLoggedIn ? getMySeasonApplication(seasonId).catch(() => null) : Promise.resolve(null),
  ])

  return (
    <SeasonDetailPage
      season={season}
      challenges={challenges}
      myApplication={myApplication}
      isLoggedIn={isLoggedIn}
    />
  )
}
