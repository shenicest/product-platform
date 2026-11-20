import Link from 'next/link'
import type { Project } from '@/server/projects'
import { ProjectBadges } from '@/components/project-badges'
import { projectIdLabel } from '@/lib/utils'
import { LikeButton } from '@/components/like-button'
import { Card } from '@/components/ui/surface'

export function ProjectCard({
  project,
  featured = false,
}: {
  project: Project
  featured?: boolean
}) {
  return (
    <Card className="group relative h-full">
      {/*
        整卡可点：用一个绝对定位的兄弟链接盖住卡片，而不是把正文包进 <a>。
        这样点赞按钮（以及以后可能加的任何交互）不在链接内部，不会出现
        <a> 里嵌 <button> 的非法结构，也不会让读屏把整张卡当成一个链接。
      */}
      <Link
        href={`/projects/${project.id}`}
        aria-label={project.name}
        className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-none"
      />

      <div
        className={
          featured ? 'card-cover card-cover--wide' : 'card-cover card-cover--tall'
        }
      >
        {project.coverUrl ? (
          // 用户提供的封面 URL 是任意的，next/image 的 remotePatterns
          // 无法穷举，因此用原生 img。
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.coverUrl} alt={project.name} loading="lazy" />
        ) : (
          <span className="card-cover--placeholder">NO COVER</span>
        )}
      </div>

      {/* `pointer-events-none` 让正文的点击穿透到下面的整卡链接；
          点赞按钮单独打开 `pointer-events-auto`，保持可点。 */}
      <div
        className={
          featured
            ? 'card-body card-body--roomy pointer-events-none relative z-20'
            : 'card-body pointer-events-none relative z-20'
        }
      >
        <span className="card-id">{projectIdLabel(project.id)}</span>

        <div className="card-heading">
          <h3 className="card-title transition-colors group-hover:text-brand-text">
            {project.name}
          </h3>
          <span className="pointer-events-auto">
            <LikeButton projectId={project.id} likeCount={project.likeCount} />
          </span>
        </div>

        {project.tagline ? <p className="card-text line-clamp-2">{project.tagline}</p> : null}

        <ProjectBadges
          stage={project.stage}
          categories={project.categories}
          source={project.sourceName}
          className="mt-auto pt-2"
        />
      </div>

      <div className="card-footer">
        <p className="card-meta min-w-0">
          创建者
          <span className="card-meta__name">
            {project.founder?.nickname ?? project.teamName ?? '匿名创始人'}
          </span>
        </p>
      </div>
    </Card>
  )
}
