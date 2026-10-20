import { getFeaturedProjects, getLiveProjects } from '@/server/projects'
import { ProjectCard } from '@/components/project-card'
import { FilterBar } from '@/components/filter-bar'
import { Pagination } from '@/components/pagination'
import { HeroSection } from '@/components/hero-section'
import { FeaturedSection } from '@/components/featured-section'
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

export default async function HomePage(props: PageProps<'/'>) {
  const searchParams = await props.searchParams
  const { category, stage, q, sort, page } = parseListParams(searchParams)

  // The BoomLand cover hero is a full-bleed brand statement with no project
  // slot; curated projects are surfaced by FeaturedSection instead.
  const [{ data: projects, total }, { data: featuredProjects }] = await Promise.all([
    getLiveProjects({
      category,
      stage,
      q,
      sort,
      offset: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }),
    getFeaturedProjects(),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = hasActiveFilters({ category, stage, q, sort })

  return (
    <PublicInteractionBoundary>
      <HeroSection />

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
