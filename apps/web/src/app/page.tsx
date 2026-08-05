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
    <div className="w-full">
      <HeroSection project={featuredPool[0]} />

      <FeaturedSection projects={featuredPool.slice(1)} />

      <section
        id="all-projects"
        className="mx-auto w-full max-w-6xl scroll-mt-14 px-4 py-10 sm:px-6"
      >
        <header className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">全部项目</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            共 {total} 个正在展示的项目
          </p>
        </header>

        <FilterBar />

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-24 text-center text-muted-foreground">
            {filtered ? "没有符合筛选条件的项目，试试调整筛选条件" : "暂无正在展示的项目"}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} searchParams={searchParams} />
          </>
        )}
      </section>
    </div>
  );
}
