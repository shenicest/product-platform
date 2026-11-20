import { getFeaturedProjects, getLiveProjects } from '@/server/projects'
import { getCurrentSeasonSpotlight } from '@/server/boomland'
import type { Metadata } from 'next'
import { ProjectCard } from '@/components/project-card'
import { FilterBar } from '@/components/filter-bar'
import { Pagination } from '@/components/pagination'
import { HeroSection } from '@/components/hero-section'
import { FeaturedSection } from '@/components/featured-section'
import { CurrentSeasonGate } from '@/components/current-season-gate'
import { SeasonActivityTicker } from '@/components/season-activity-ticker'
import { HomeDiscovery } from '@/components/home-discovery'
import { SeasonLeaderboard } from '@/components/season-leaderboard'
import { EmptyState } from '@/components/ui/surface'
import { ButtonLink } from '@/components/ui/button'
import { SectionHead } from '@/components/ui/typography'
import {
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
} from '@/lib/project-filters'
import { PublicInteractionBoundary } from '@/components/public-interaction-boundary'

export const dynamic = 'force-dynamic'

/**
 * 首页的标题、描述、OG 图都由根布局给出，这里只补 `canonical`。
 * 列表的筛选参数（category / sort / q）不参与 canonical —— 同一批内容不重复收录。
 */
export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

export default async function HomePage(props: PageProps<'/'>) {
  const searchParams = await props.searchParams
  const { category, stage, q, sort, page } = parseListParams(searchParams)

  // The BoomLand cover hero is a full-bleed brand statement with no project
  // slot; curated projects are surfaced by FeaturedSection instead.
  const [{ data: projects, total }, { data: featuredProjects }, currentSeason] =
    await Promise.all([
      getLiveProjects({
        category,
        stage,
        q,
        sort,
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
      getFeaturedProjects(),
      getCurrentSeasonSpotlight(),
    ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = hasActiveFilters({ category, stage, q, sort })

  return (
    <PublicInteractionBoundary>
      <HeroSection />

      {/* 赛季动态长条：放在票根上方，先给「正在发生什么」，再进入当前赛季。 */}
      <div className="shell pt-6">
        <SeasonActivityTicker />
      </div>

      {/* 当前赛季有时效性，排在精选项目之前；没有赛季时也保留入口。 */}
      <CurrentSeasonGate season={currentSeason} />

      {/* 赛季贡献积分榜 + 最近评分/进化/活跃。 */}
      <SeasonLeaderboard />

      {/* 赛季之外的三块长期展示：孵化产品 / 培养人 / 线下作品。 */}
      <HomeDiscovery />

      <FeaturedSection projects={featuredProjects} />

      <section id="all-projects" className="section section--flush scroll-mt-24">
        <div className="shell">
          <SectionHead
            eyebrow="INDEX / 02"
            title="全部项目"
            aside={
              <p className="section-head__aside">
                TOTAL:
                <b className="font-digits text-lg font-normal text-brand-text">
                  {total}
                </b>
                PROJECTS LIVE
              </p>
            }
          />

          <FilterBar />

          {projects.length === 0 ? (
            <EmptyState
              title="NO SIGNAL"
              description={
                filtered
                  ? '没有符合筛选条件的项目，试试调整筛选条件'
                  : '暂无正在展示的项目'
              }
              action={
                filtered ? (
                  <ButtonLink href="/" variant="secondary">
                    清除筛选 <span className="ui-btn__arrow" aria-hidden>→</span>
                  </ButtonLink>
                ) : null
              }
            />
          ) : (
            <>
              <div className="card-grid">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
              <Pagination page={page} totalPages={totalPages} searchParams={searchParams} />
            </>
          )}
        </div>
      </section>
    </PublicInteractionBoundary>
  )
}
