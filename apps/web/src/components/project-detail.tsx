import Link from 'next/link'
import type { ProjectDetail } from '@/server/projects'
import { ProjectBadges } from '@/components/project-badges'
import { resolveDemoVideo } from '@/lib/demo-media'

// Public display deliberately excludes all contact fields
// (contactName / contactPhone / contactEmail / contactWechat).

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function DetailSection({
  title,
  content,
}: {
  title: string
  content: string
}) {
  return (
    <section>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
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
    <section className="mt-10">
      <h2 className="text-base font-semibold tracking-tight">演示</h2>
      <div className="mt-3 space-y-4">
        {demoLink ? (
          <a
            href={demoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            试用产品
          </a>
        ) : null}

        {video?.kind === 'iframe' ? (
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
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
            className="aspect-video w-full rounded-xl border border-border bg-muted"
          />
        ) : null}
        {video?.kind === 'link' && demoVideoUrl ? (
          <a
            href={demoVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            观看演示视频
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
                className="aspect-video w-full rounded-xl border border-border bg-muted object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function ProjectDetail({ project }: { project: ProjectDetail }) {
  const coverUrl = nonEmpty(project.coverUrl)
  const tagline = nonEmpty(project.tagline)
  const description = nonEmpty(project.description)
  const teamName = nonEmpty(project.teamName)
  const founderNickname = nonEmpty(project.founder?.nickname)
  const founderAvatarUrl = nonEmpty(project.founder?.avatarUrl)

  const longFormSections = [
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
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 返回项目列表
      </Link>

      <header className="mt-6">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={project.name}
            className="aspect-video w-full rounded-xl border border-border bg-muted object-cover"
          />
        ) : null}

        <div className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight">
            {project.name}
          </h1>
          {tagline ? (
            <p className="mt-2 text-lg text-muted-foreground">{tagline}</p>
          ) : null}

          {founderNickname || founderAvatarUrl ? (
            <div className="mt-4 flex items-center gap-2">
              {founderAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={founderAvatarUrl}
                  alt={founderNickname ?? `${project.name} 创始人`}
                  className="size-8 rounded-full border border-border bg-muted object-cover"
                />
              ) : null}
              {founderNickname ? (
                <span className="text-sm font-medium">{founderNickname}</span>
              ) : null}
            </div>
          ) : null}

          {project.stage !== null ||
          project.categories?.length ||
          teamName ? (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <ProjectBadges
                stage={project.stage}
                categories={project.categories}
                className="contents"
              />
              {teamName ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  {teamName}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <DemoAssets project={project} />

      {description ? (
        <div className="mt-10">
          <DetailSection title="产品介绍" content={description} />
        </div>
      ) : null}

      {longFormSections.length ? (
        <div className="mt-10 space-y-8">
          {longFormSections.map((section) => (
            <DetailSection
              key={section.title}
              title={section.title}
              content={section.content}
            />
          ))}
        </div>
      ) : null}

      {project.isOpenForBeta ? (
        <section className="mt-10 rounded-xl border border-primary/30 bg-primary/5 p-6">
          <h2 className="text-base font-semibold tracking-tight">
            正在招募 Beta 用户
          </h2>
          {betaDescription ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {betaDescription}
            </p>
          ) : null}
        </section>
      ) : null}
    </article>
  )
}
