import { redirect } from 'next/navigation'
import { SeasonLanding } from '@/components/boomland/v26/season-landing'
import { EmptyState } from '@/components/ui/surface'
import { SectionHead } from '@/components/ui/typography'
import { getSeason, getSeasons } from '@/server/boomland'
import { toSeasonCard } from '@/lib/season-landing'
import type { SeasonListResponse } from '@/lib/boomland'

export const metadata = { title: '火热赛季' }
export const dynamic = 'force-dynamic'

/** 只公开「即将开始 / 进行中」的赛季；草稿与已结束的赛季不进入落地页。 */
const PUBLIC_SEASON_STATUS = 'upcoming,active'

/**
 * 火热赛季落地页（设计稿 BoomLand V2.6）。
 *
 * 与旧实现的差别：旧版把「赛季详情」直接塞进 `/seasons` 的轮播里，
 * 于是列表页和详情页是同一屏；新结构按设计稿拆成两层：
 *
 *   `/seasons`        推荐首屏 + 筛选 + 赛季票券墙（本文件）
 *   `/seasons/:id`    单场赛季详情（海报 / 赛程 / 命题 / 规则）
 *
 * 取数只多做一件事：列表项需要 `applicationWindow` 判「报名中 / 未开放」，
 * 所以对每个赛季再取一次详情。`getSeason` 有 `cache()`，开销可控。
 * 接口与字段没有改动。
 */
export default async function SeasonsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // 兼容旧链接：`/seasons?season=12` 是改造前「同页轮播」的定位方式，
  // 现在统一 302 到独立详情页 `/seasons/12`。
  const searchParams = await props.searchParams
  const rawSeason = Array.isArray(searchParams.season)
    ? searchParams.season[0]
    : searchParams.season
  if (rawSeason && /^\d+$/.test(rawSeason)) redirect(`/seasons/${rawSeason}`)

  const list = await getSeasons({ status: PUBLIC_SEASON_STATUS, pageSize: 100 }).catch(
    () => ({ items: [], total: 0, page: 1, pageSize: 100 }) as SeasonListResponse,
  )

  const details = await Promise.all(
    list.items.map((summary) => getSeason(summary.id).catch(() => null)),
  )

  const cards = details
    .filter((season) => season !== null)
    .map((season) => toSeasonCard(season))

  if (cards.length === 0) {
    return (
      <div className="v26">
        <div className="v26-shell v26-shell--narrow py-20 sm:py-28">
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

  return <SeasonLanding cards={cards} />
}
