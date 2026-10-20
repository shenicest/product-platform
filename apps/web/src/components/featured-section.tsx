import type { Project } from '@/server/projects'
import { ProjectCard } from '@/components/project-card'
import { SectionHead } from '@/components/ui/typography'

export function FeaturedSection({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null

  return (
    <section className="section section--flush">
      <div className="shell">
        <SectionHead
          eyebrow="FEATURED / 01"
          title="精选项目"
          lead="平台希望你优先关注的优质项目 —— 它们正在被真实地建造。"
        />
        <div className="card-grid">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </section>
  )
}
