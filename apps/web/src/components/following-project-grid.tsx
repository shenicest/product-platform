'use client'

import { ProjectCard } from '@/components/project-card'
import { useUserInteraction } from '@/components/user-interaction-provider'
import type { Project } from '@/server/projects'
import { ButtonLink } from '@/components/ui/button'

export function FollowingProjectGrid({ projects }: { projects: Project[] }) {
  const { following } = useUserInteraction()
  const followedProjects = projects.filter((project) => following.has(project.userId))

  if (followedProjects.length === 0) {
    return (
      <div className="ui-empty">
        <h2 className="text-h3 font-bold text-foreground">你还没有关注任何 Founder</h2>
        <p className="mt-3 text-body-sm text-muted-foreground">
          关注 Founder 后，他们发布的所有 Live 项目都会汇集在这里。
        </p>
        <div className="mt-6 flex justify-center">
          <ButtonLink href="/" variant="primary">
            去发现 <span className="ui-btn__arrow" aria-hidden>→</span>
          </ButtonLink>
        </div>
      </div>
    )
  }

  return (
    <div className="card-grid">
      {followedProjects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  )
}
