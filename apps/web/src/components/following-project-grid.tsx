'use client'

import { FollowButton } from '@/components/follow-button'
import { ProjectCard } from '@/components/project-card'
import { useUserInteraction } from '@/components/user-interaction-provider'
import type { Project } from '@/server/projects'
import Link from 'next/link'

export function FollowingProjectGrid({ projects }: { projects: Project[] }) {
  const { following } = useUserInteraction()
  const followedProjects = projects.filter((project) => following.has(project.userId))

  if (followedProjects.length === 0) {
    return (
      <div className="border border-dashed border-border py-24 text-center">
        <h2 className="text-xl font-bold">你还没有关注任何 Founder</h2>
        <p className="mt-3 text-sm text-muted-foreground">关注 Founder 后，他们发布的所有 Live 项目都会汇集在这里。</p>
        <Link href="/" className="btn-hard btn-primary mt-6">去发现 <span aria-hidden>→</span></Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {followedProjects.map((project) => (
        <div key={project.id} className="relative">
          <ProjectCard project={project} />
          <div className="absolute right-4 top-4">
            <FollowButton founderUserId={project.userId} />
          </div>
        </div>
      ))}
    </div>
  )
}
