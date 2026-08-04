import Link from 'next/link'
import type { Project } from '@/server/projects'
import { ProjectBadges } from '@/components/project-badges'

export function ProjectCard({ project }: { project: Project }) {
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

        <ProjectBadges
          stage={project.stage}
          categories={project.categories}
          className="mt-auto pt-2"
        />
      </div>
    </Link>
  )
}
