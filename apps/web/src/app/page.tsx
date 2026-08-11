import { getLiveProjects } from "@/server/projects";
import { ProjectCard } from "@/components/project-card";
import { FilterBar } from "@/components/filter-bar";
import { Pagination } from "@/components/pagination";
import { HeroSection } from "@/components/hero-section";
import { FeaturedSection } from "@/components/featured-section";
import {
  PAGE_SIZE,
  hasActiveFilters,
  parseListParams,
} from "@/lib/project-filters";
import { PublicInteractionBoundary } from '@/components/public-interaction-boundary'
import Link from 'next/link'

export const dynamic = "force-dynamic";

const FEATURED_POOL_SIZE = 5;

export default async function HomePage(props: PageProps<"/">) {
  const searchParams = await props.searchParams;
  const { category, stage, q, sort, page } = parseListParams(searchParams);

  const [{ data: projects, total }, { data: featuredPool }] =
    await Promise.all([
      getLiveProjects({
        category,
        stage,
        q,
        sort,
        offset: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      }),
      getLiveProjects({ limit: FEATURED_POOL_SIZE }),
    ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = hasActiveFilters({ category, stage, q, sort });

  return (
    <PublicInteractionBoundary>
      <div className="w-full">
      <HeroSection project={featuredPool[0]} />

      <FeaturedSection projects={featuredPool.slice(1)} />

      <section
        id="all-projects"
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
      >
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">INDEX / 02</p>
            <h2 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold leading-[1.15]">
              全部项目
            </h2>
          </div>
          <p className="pb-1 font-mono text-xs text-muted-foreground">
            TOTAL: <b className="font-digits font-normal text-primary">{total}</b>{" "}
            PROJECTS LIVE
          </p>
        </header>

        <FilterBar />

        {projects.length === 0 ? (
          <div className="border border-dashed border-border py-24 text-center">
            <p className="font-mono text-xs tracking-[0.12em] text-primary">
              NO SIGNAL
            </p>
            <p className="mt-3 text-base text-muted-foreground">
              {filtered
                ? "没有符合筛选条件的项目，试试调整筛选条件"
                : "暂无正在展示的项目"}
            </p>
            {filtered ? (
              <Link href="/" className="btn-hard btn-secondary mt-6">
                清除筛选 <span aria-hidden>→</span>
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} searchParams={searchParams} />
          </>
        )}
      </section>
      </div>
    </PublicInteractionBoundary>
  );
}
