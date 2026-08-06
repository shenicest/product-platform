import type { Project } from '@/server/projects'
import { ProjectCard } from '@/components/project-card'

export function FeaturedSection({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">FEATURED / 01</p>
          <h2 className="mt-2 text-[clamp(28px,3vw,40px)] font-bold leading-[1.15]">
            精选项目
          </h2>
        </div>
        <p className="max-w-[520px] pb-1 text-base text-muted-foreground">
          平台希望你优先关注的优质项目
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
}
