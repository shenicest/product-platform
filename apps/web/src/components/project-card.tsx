import Link from 'next/link'
import { ProjectStage } from '@shenicest/shared'
import type { Project } from '@/server/projects'

const STAGE_LABELS: Record<number, string> = {
  [ProjectStage.MVP]: 'MVP 阶段',
  [ProjectStage.Growth]: '成长阶段',
}

export function ProjectCard({ project }: { project: Project }) {
  const stageLabel =
    project.stage !== null ? STAGE_LABELS[project.stage] : undefined

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-3 transition-colors hover:border-foreground/20"
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
        {project.coverUrl ? (
          // User-provided cover URLs are arbitrary, so next/image remote
          // patterns can't be enumerated; a plain <img> is the safe choice.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt={project.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            暂无封面
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-1.5 px-1 pb-1">
        <h3 className="font-medium leading-snug group-hover:underline">
          {project.name}
        </h3>
        {project.tagline ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {project.tagline}
          </p>
        ) : null}

        {stageLabel || project.categories?.length ? (
          <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
            {stageLabel ? (
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                {stageLabel}
              </span>
            ) : null}
            {project.categories?.map((category) => (
              <span
                key={category}
                className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {category}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  )
}
