import Link from 'next/link'
import { skillLabel } from '@shenicest/shared'
import type { ProjectDetail } from '@/server/projects'
import { ProjectBadges } from '@/components/project-badges'
import { resolveDemoVideo } from '@/lib/demo-media'
import { tractionMetrics } from '@/lib/traction'
import { projectIdLabel } from '@/lib/utils'
import { LikeButton } from '@/components/like-button'
import { FounderCard } from '@/components/founder-card'
import { DemoEmbed } from '@/components/demo-embed'
import { Chip } from '@/components/ui/chip'
import { ButtonAnchor } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'
import { ProjectConnectButton } from '@/components/project-connection-dialog'
import type { MyProjectConnectionStatus } from '@/lib/client-api'

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
    <section className="detail-section">
      <h2 className="detail-section__title">
        <span className="detail-section__index">{String(index).padStart(2, '0')}</span>
        {title}
      </h2>
      <p className="detail-copy">{content}</p>
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
    <section className="ui-panel">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Eyebrow tone="accent">DEMO / SIGNAL</Eyebrow>
        {demoLink ? (
          <ButtonAnchor
            href={demoLink}
            target="_blank"
            rel="noopener noreferrer"
            variant="primary"
            size="sm"
          >
            试用产品 <span className="ui-btn__arrow" aria-hidden>→</span>
          </ButtonAnchor>
        ) : null}
      </div>

      <div className="flex flex-col gap-4">
        {video?.kind === 'iframe' ? (
          <div className="demo-shell">
            <div className="demo-shell__bar">
              <i className="demo-shell__dot" aria-hidden />
              <i className="demo-shell__dot" aria-hidden />
              <i className="demo-shell__dot" aria-hidden />
              <span className="demo-shell__url">VIDEO / EMBED</span>
            </div>
            <iframe
              src={video.src}
              title={`${project.name} 演示视频`}
              className="demo-shell__frame aspect-video"
              allowFullScreen
            />
          </div>
        ) : null}
        {video?.kind === 'video' ? (
          <video
            src={video.src}
            controls
            preload="metadata"
            className="aspect-video w-full rounded-md border border-border bg-muted"
          />
        ) : null}
        {video?.kind === 'link' && demoVideoUrl ? (
          <ButtonAnchor
            href={demoVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            className="w-fit"
          >
            观看演示视频 <span className="ui-btn__arrow" aria-hidden>→</span>
          </ButtonAnchor>
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
                className="aspect-video w-full rounded-md border border-border bg-muted object-cover"
              />
            ))}
          </div>
        ) : null}

        {demoLink ? (
          <div className="demo-shell">
            <div className="demo-shell__bar">
              <i className="demo-shell__dot" aria-hidden />
              <i className="demo-shell__dot" aria-hidden />
              <i className="demo-shell__dot" aria-hidden />
              <span className="demo-shell__url">
                {demoLink.replace(/^https?:\/\//, '')}
              </span>
            </div>
            <DemoEmbed
              src={demoLink}
              title={`${project.name} 产品 Demo`}
              className="demo-shell__frame h-[560px]"
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function ProjectDetail({ project, backHref = '/', showLike = true, connectGate }: { project: ProjectDetail; backHref?: string; showLike?: boolean; connectGate?: MyProjectConnectionStatus | null }) {
  const coverUrl = nonEmpty(project.coverUrl)
  const tagline = nonEmpty(project.tagline)
  const teamName = nonEmpty(project.teamName)

  // Contact fields survive the API strip only for the owner and Operators;
  // the section renders purely on their presence (ADR-0012).
  const contacts = [
    { label: '联系人', value: nonEmpty(project.contactName) },
    { label: '邮箱', value: nonEmpty(project.contactEmail) },
    { label: '电话', value: nonEmpty(project.contactPhone) },
    { label: '微信', value: nonEmpty(project.contactWechat) },
  ].filter((contact): contact is { label: string; value: string } => contact.value !== null)

  const sections = [
    { title: '项目背景与问题', content: nonEmpty(project.problemStatement) },
    { title: '当前进展', content: nonEmpty(project.progress) },
    { title: '下一步计划', content: nonEmpty(project.nextSteps) },
    { title: '差异化优势', content: nonEmpty(project.differentiation) },
    { title: '商业模式', content: nonEmpty(project.businessModel) },
  ].filter((section): section is { title: string; content: string } =>
    Boolean(section.content),
  )

  const betaDescription = nonEmpty(project.betaDescription)
  const traction = tractionMetrics(project)

  return (
    <article className="shell py-8">
      <Link
        href={backHref}
        className="font-mono text-meta tracking-[0.08em] text-muted-foreground transition-colors hover:text-brand-text"
      >
        ← BACK / {backHref === '/' ? 'INDEX' : 'DASHBOARD'}
      </Link>

      <p className="detail-crumb mt-6 mb-8">PROJECTS / PROJECT {project.id}</p>

      <div className="detail-layout">
        <div>
          <header>
            {coverUrl ? (
              <div className="rounded-lg border border-border bg-card p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt={project.name}
                  className="aspect-video w-full rounded-sm bg-muted object-cover"
                />
              </div>
            ) : null}

            <div className="mt-8">
              <Eyebrow>FEATURED PROJECT / {projectIdLabel(project.id)}</Eyebrow>
              <h1 className="detail-title">{project.name}</h1>
              {tagline ? <p className="detail-tagline">{tagline}</p> : null}

              {showLike ? (
                <div className="mt-5">
                  <LikeButton projectId={project.id} likeCount={project.likeCount} />
                </div>
              ) : null}

              {connectGate !== undefined ? (
                <ProjectConnectButton projectId={project.id} initialStatus={connectGate} />
              ) : null}

              {project.founder ? (
                <FounderCard founder={project.founder} projectName={project.name} />
              ) : null}

              {project.stage !== null || project.categories?.length || teamName ? (
                <div className="detail-badges mt-5">
                  <ProjectBadges
                    stage={project.stage}
                    categories={project.categories}
                    className="contents"
                  />
                  {teamName ? <Chip>{teamName}</Chip> : null}
                </div>
              ) : null}
            </div>
          </header>

          {sections.length ? (
            <div>
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

          {traction.length ? (
            <section className="detail-metrics mt-12">
              {traction.map((item) => (
                <div key={item.label}>
                  <div className="detail-metric__label">{item.label}</div>
                  <div className="detail-metric__value">{item.value}</div>
                </div>
              ))}
            </section>
          ) : null}

          {project.seekingSkills?.length ? (
            <section className="detail-section">
              <h2 className="detail-section__title">寻求帮助</h2>
              <div className="detail-badges mt-3">
                {project.seekingSkills.map((skill) => (
                  <Chip key={skill}>{skillLabel(skill)}</Chip>
                ))}
              </div>
            </section>
          ) : null}

          {project.isOpenForBeta ? (
            <section className="detail-callout">
              <h2 className="detail-callout__title">
                <i aria-hidden className="detail-callout__dot" />
                正在招募 Beta 用户
              </h2>
              {betaDescription ? <p className="detail-copy">{betaDescription}</p> : null}
            </section>
          ) : null}

          {contacts.length ? (
            <section className="detail-section">
              <h2 className="detail-section__title">联系方式</h2>
              <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-body-sm text-muted-foreground">
                {contacts.map((contact) => (
                  <span key={contact.label}>
                    <span className="mono">{contact.label}</span>
                    <span className="ml-2 text-foreground">{contact.value}</span>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="detail-aside">
          <DemoAssets project={project} />
        </aside>
      </div>
    </article>
  )
}
