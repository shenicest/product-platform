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
    <Card className="group h-full">
      <Link
        href={`/projects/${project.id}`}
        className="flex flex-1 flex-col focus-visible:outline-none"
      >
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

        <div className={featured ? 'card-body card-body--roomy' : 'card-body'}>
          <span className="card-id">{projectIdLabel(project.id)}</span>

          {/* 设计稿 .product-heading：标题与点赞按钮同一行，按钮贴右。
              按钮在 <Link> 内部，所以它自己 preventDefault/stopPropagation
              （见 like-button.tsx），点它不会跳详情页。 */}
          <div className="card-heading">
            <h3 className="card-title transition-colors group-hover:text-brand-text">
              {project.name}
            </h3>
            <LikeButton projectId={project.id} likeCount={project.likeCount} />
          </div>

          {project.tagline ? <p className="card-text line-clamp-2">{project.tagline}</p> : null}

          <ProjectBadges
            stage={project.stage}
            categories={project.categories}
            className="mt-auto pt-2"
          />
        </div>
      </Link>

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
