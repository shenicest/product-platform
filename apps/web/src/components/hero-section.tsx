import Link from 'next/link'
import type { Project } from '@/server/projects'
import { ProjectBadges } from '@/components/project-badges'

function RecommendedProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/20"
    >
      <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
        {project.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt={project.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            暂无封面
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-2 px-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold leading-snug group-hover:underline">
            {project.name}
          </h3>
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            推荐项目
          </span>
        </div>
        {project.tagline ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {project.tagline}
          </p>
        ) : null}

        <ProjectBadges stage={project.stage} categories={project.categories} />

        <span className="mt-2 inline-flex w-fit items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          项目详情
        </span>
      </div>
    </Link>
  )
}

export function HeroSection({ project }: { project?: Project }) {
  return (
    <section className="border-b border-border bg-secondary/30">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
        <div className="flex flex-col items-start gap-5">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            发现正在成长的新产品
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground">
            浏览早期产品，投出人气票，提交真实反馈，也可以支持你看好的项目。
          </p>
          <div className="mt-1 flex items-center gap-3">
            <a
              href="#all-projects"
              className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              浏览项目
            </a>
            <button
              type="button"
              disabled
              title="即将上线"
              className="inline-flex cursor-not-allowed items-center rounded-md border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground"
            >
              提交项目
            </button>
          </div>
        </div>

        {project ? <RecommendedProjectCard project={project} /> : null}
      </div>
    </section>
  )
}
