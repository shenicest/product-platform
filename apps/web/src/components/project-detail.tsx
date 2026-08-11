import Link from 'next/link'
import type { ProjectDetail } from '@/server/projects'
import { ProjectBadges } from '@/components/project-badges'
import { resolveDemoVideo } from '@/lib/demo-media'
import { projectIdLabel } from '@/lib/utils'
import { LikeButton } from '@/components/like-button'
import { FounderCard } from '@/components/founder-card'

// Public display deliberately excludes all contact fields
// (contactName / contactPhone / contactEmail / contactWechat).

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function DetailSection({
  index,
  title,
  content,
}: {
  index: number
  title: string
  content: string
}) {
  return (
    <section>
      <h2 className="flex items-baseline gap-3 text-lg font-bold">
        <span className="font-mono text-[11px] tracking-[0.08em] text-primary">
          {String(index).padStart(2, '0')}
        </span>
        {title}
      </h2>
      <p className="mt-3 max-w-[65ch] text-base leading-[1.7] text-muted-foreground whitespace-pre-line">
        {content}
      </p>
    </section>
  )
}

function DemoAssets({ project }: { project: ProjectDetail }) {
  const demoLink = nonEmpty(project.demoLink)
  const demoVideoUrl = nonEmpty(project.demoVideoUrl)
  const demoImages = (project.demoImages ?? []).filter(
    (src) => typeof src === 'string' && src.trim(),
  )
  if (!demoLink && !demoVideoUrl && demoImages.length === 0) return null

  const video = demoVideoUrl ? resolveDemoVideo(demoVideoUrl) : null

  return (
    <section className="mt-12 border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-mono text-xs tracking-[0.12em] text-primary">
          DEMO / SIGNAL
        </h2>
        {demoLink ? (
          <a
            href={demoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-hard btn-primary px-4 py-2 text-xs"
          >
            试用产品 <span aria-hidden>→</span>
          </a>
        ) : null}
      </div>
      <div className="space-y-4 p-5">
        {video?.kind === 'iframe' ? (
          <div className="aspect-video w-full overflow-hidden border border-border bg-muted">
            <iframe
              src={video.src}
              title={`${project.name} 演示视频`}
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        ) : null}
        {video?.kind === 'video' ? (
          <video
            src={video.src}
            controls
            preload="metadata"
            className="aspect-video w-full border border-border bg-muted"
          />
        ) : null}
        {video?.kind === 'link' && demoVideoUrl ? (
          <a
            href={demoVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-hard btn-secondary w-fit"
          >
            观看演示视频 <span aria-hidden>→</span>
          </a>
        ) : null}

        {demoImages.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {demoImages.map((src, index) => (
              // Demo image URLs are arbitrary user input, so next/image
              // remote patterns can't be enumerated.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${src}-${index}`}
                src={src}
                alt={`${project.name} 演示图 ${index + 1}`}
                loading="lazy"
                className="aspect-video w-full border border-border bg-muted object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function ProjectDetail({ project, backHref = '/', showLike = true }: { project: ProjectDetail; backHref?: string; showLike?: boolean }) {
  const coverUrl = nonEmpty(project.coverUrl)
  const tagline = nonEmpty(project.tagline)
  const description = nonEmpty(project.description)
  const teamName = nonEmpty(project.teamName)

  const sections = [
    { title: '产品介绍', content: description },
    { title: '目标用户', content: nonEmpty(project.targetUsers) },
    { title: '解决的问题', content: nonEmpty(project.userProblem) },
    { title: '当前进展', content: nonEmpty(project.progress) },
    { title: '下一步计划', content: nonEmpty(project.nextSteps) },
    { title: '想对用户说的话', content: nonEmpty(project.messageToUsers) },
  ].filter((section): section is { title: string; content: string } =>
    Boolean(section.content),
  )

  const betaDescription = nonEmpty(project.betaDescription)

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <Link
        href={backHref}
        className="font-mono text-xs tracking-[0.08em] text-muted-foreground transition-colors hover:text-primary"
      >
        ← BACK / {backHref === '/' ? 'INDEX' : 'DASHBOARD'}
      </Link>

      <header className="mt-8">
        {coverUrl ? (
          <div className="scan-frame border border-foreground/40 bg-card p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={project.name}
              className="aspect-video w-full border border-border bg-muted object-cover"
            />
          </div>
        ) : null}

        <div className="mt-8">
          <p className="eyebrow">OBJECT / {projectIdLabel(project.id)}</p>
          <h1 className="mt-3 text-[clamp(30px,4vw,44px)] font-bold leading-[1.1]">
            {project.name}
          </h1>
          {tagline ? (
            <p className="mt-3 text-lg leading-[1.7] text-muted-foreground">
              {tagline}
            </p>
          ) : null}
          {showLike ? <div className="mt-5"><LikeButton projectId={project.id} likeCount={project.likeCount} /></div> : null}

          {project.founder ? <FounderCard founder={project.founder} projectName={project.name} /> : null}

          {project.stage !== null ||
          project.categories?.length ||
          teamName ? (
            <div className="mt-5 flex flex-wrap items-center gap-1.5">
              <ProjectBadges
                stage={project.stage}
                categories={project.categories}
                className="contents"
              />
              {teamName ? (
                <span className="chip-hard">{teamName}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <DemoAssets project={project} />

      {sections.length ? (
        <div className="mt-12 space-y-10">
          {sections.map((section, index) => (
            <DetailSection
              key={section.title}
              index={index + 1}
              title={section.title}
              content={section.content}
            />
          ))}
        </div>
      ) : null}

      {project.isOpenForBeta ? (
        <section className="mt-12 border-2 border-primary p-6">
          <h2 className="flex items-center gap-2.5 text-lg font-bold">
            <i
              aria-hidden
              className="size-2.5 bg-primary shadow-[0_0_12px_var(--primary)]"
            />
            正在招募 Beta 用户
          </h2>
          {betaDescription ? (
            <p className="mt-3 max-w-[65ch] text-base leading-[1.7] text-muted-foreground whitespace-pre-line">
              {betaDescription}
            </p>
          ) : null}
        </section>
      ) : null}
    </article>
  )
}
