import Link from 'next/link'
import type { Project } from '@/server/projects'
import { ProjectBadges } from '@/components/project-badges'
import { projectIdLabel } from '@/lib/utils'
import { LikeButton } from '@/components/like-button'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex flex-col border border-border bg-card transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="aspect-[4/3] w-full overflow-hidden border-b border-border bg-muted">
        {project.coverUrl ? (
          // User-provided cover URLs are arbitrary, so next/image remote
          // patterns can't be enumerated; a plain <img> is the safe choice.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt={project.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted-foreground">
            NO COVER
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="font-mono text-[10px] tracking-[0.08em] text-primary">
          {projectIdLabel(project.id)}
        </span>
        <h3 className="text-base font-bold leading-snug transition-colors group-hover:text-primary">
          {project.name}
        </h3>
        {project.tagline ? (
          <p className="line-clamp-2 text-sm leading-normal text-muted-foreground">
            {project.tagline}
          </p>
        ) : null}

        <ProjectBadges
          stage={project.stage}
          categories={project.categories}
          className="mt-auto pt-2"
        />
        <div className="mt-2 flex justify-end">
          <LikeButton projectId={project.id} likeCount={project.likeCount} />
        </div>
      </div>
    </Link>
  )
}
