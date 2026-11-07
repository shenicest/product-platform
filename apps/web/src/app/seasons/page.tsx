import { cookies } from 'next/headers'
import { SeasonCarousel } from '@/components/boomland/season-carousel'
import { SeasonDetailPage } from '@/components/boomland/season-detail'
import { EmptyState } from '@/components/ui/surface'
import { SectionHead } from '@/components/ui/typography'
import {
  getMySeasonApplication,
  getSeason,
  getSeasonChallenges,
  getSeasons,
} from '@/server/boomland'
import type {
  MySeasonApplication,
  SeasonChallenge,
  SeasonDetail,
  SeasonListResponse,
} from '@/lib/boomland'

export const metadata = { title: '火热赛季' }
export const dynamic = 'force-dynamic'

type SeasonSearchParams = Record<string, string | string[] | undefined>

function pick(searchParams: SeasonSearchParams, key: string): string {
  const value = searchParams[key]
  const single = Array.isArray(value) ? value[0] : value
  return (single ?? '').trim()
}

type SeasonEntry = {
  season: SeasonDetail
  challenges: SeasonChallenge[]
  myApplication: MySeasonApplication | null
}

function EmptySeasons() {
  return (
    <div className="season-page">
      <div className="shell shell--narrow py-20 sm:py-28">
        <SectionHead
          eyebrow="BOOMLAND / SEASONS"
          title="火热赛季"
          lead="现在没有进行中的赛季。新赛季开赛后会自动出现在这里。"
        />
        <EmptyState
          title="NO ACTIVE SEASON"
          description="可以先去看看产品共生，或稍后再来。"
        />
      </div>
    </div>
  )
}

export default async function SeasonsPage(props: {
  searchParams: Promise<SeasonSearchParams>
}) {
  const searchParams = await props.searchParams
  const isLoggedIn = Boolean((await cookies()).get('shenicest_token')?.value)

  const list = await getSeasons({ status: 'active', pageSize: 100 }).catch(
    () => ({ items: [], total: 0, page: 1, pageSize: 100 }) as SeasonListResponse,
  )
  if (list.items.length === 0) return <EmptySeasons />

  const entries = (
    await Promise.all(
      list.items.map(async (summary): Promise<SeasonEntry | null> => {
        const season = await getSeason(summary.id).catch(() => null)
        if (!season) return null
        const [challenges, myApplication] = await Promise.all([
          getSeasonChallenges(summary.id).catch(() => []),
          isLoggedIn
            ? getMySeasonApplication(summary.id).catch(() => null)
            : Promise.resolve(null),
        ])
        return { season, challenges, myApplication }
      }),
    )
  ).filter((entry): entry is SeasonEntry => entry !== null)

  if (entries.length === 0) return <EmptySeasons />

  const requestedId = Number(pick(searchParams, 'season'))
  const requestedIndex = entries.findIndex((entry) => entry.season.id === requestedId)
  const initialIndex = requestedIndex >= 0 ? requestedIndex : 0

  return (
    <SeasonCarousel
      initialIndex={initialIndex}
      slides={entries.map((entry) => ({
        id: entry.season.id,
        name: entry.season.name,
        content: (
          <SeasonDetailPage
            season={entry.season}
            challenges={entry.challenges}
            myApplication={entry.myApplication}
            isLoggedIn={isLoggedIn}
          />
        ),
      }))}
    />
  )
}
