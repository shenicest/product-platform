import Link from 'next/link'
import type { Project } from '@/server/projects'
import { ProjectBadges } from '@/components/project-badges'
import { projectIdLabel } from '@/lib/utils'

function RecommendedProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="scan-frame group flex flex-col border border-foreground/40 bg-card p-5 transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span className="eyebrow">FEATURED / {projectIdLabel(project.id)}</span>

      <div className="mt-4 aspect-video w-full overflow-hidden border border-border bg-muted">
        {project.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt={project.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted-foreground">
            NO COVER
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-2">
        <h3 className="text-xl font-bold leading-snug transition-colors group-hover:text-primary">
          {project.name}
        </h3>
        {project.tagline ? (
          <p className="line-clamp-2 text-base leading-normal text-muted-foreground">
            {project.tagline}
          </p>
        ) : null}

        <ProjectBadges stage={project.stage} categories={project.categories} />

        <span className="btn-hard btn-primary mt-4 w-fit">
          项目详情 <span aria-hidden>→</span>
        </span>
        <span className="mt-3 font-mono text-[11px] text-muted-foreground">
          TRACKING: FEATURED PROJECT
        </span>
      </div>
    </Link>
  )
}

export function HeroSection({ project }: { project?: Project }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.25fr_0.75fr] lg:py-24">
        <div className="overflow-hidden">
          <p className="eyebrow">PRODUCT DISCOVERY / 00</p>
          <h1 className="mt-7">
            <span className="display-compressed text-[clamp(42px,7vw,92px)]">
              <em className="not-italic text-primary">发现</em>
              正在成长的新产品
            </span>
            <span className="mt-6 block text-[clamp(22px,2.6vw,34px)] font-bold leading-none tracking-[0.01em] text-primary">
              EARLY PRODUCTS · LIVE
            </span>
          </h1>
          <p className="mt-7 max-w-[620px] text-[clamp(16px,1.5vw,20px)] leading-[1.7] text-muted-foreground">
            浏览早期产品，投出人气票，提交真实反馈，也可以支持你看好的项目。
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3.5">
            <a href="#all-projects" className="btn-hard btn-primary">
              浏览项目 <span aria-hidden>→</span>
            </a>
            <Link href="/submit" className="btn-hard btn-ghost">
              提交项目 <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        {project ? <RecommendedProjectCard project={project} /> : null}
      </div>
    </section>
  )
}
