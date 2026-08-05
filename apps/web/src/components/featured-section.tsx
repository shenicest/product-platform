import type { Project } from '@/server/projects'
import { ProjectCard } from '@/components/project-card'

export function FeaturedSection({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">精选项目</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            平台希望你优先关注的优质项目
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  )
}
