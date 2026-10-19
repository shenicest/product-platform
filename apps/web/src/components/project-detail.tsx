import Link from 'next/link'
import type { ProjectDetail } from '@/server/projects'
import { ProjectBadges } from '@/components/project-badges'
import { resolveDemoVideo } from '@/lib/demo-media'
import { tractionMetrics } from '@/lib/traction'
import { projectIdLabel } from '@/lib/utils'
import { LikeButton } from '@/components/like-button'
import { FounderCard } from '@/components/founder-card'
import { DemoEmbed } from '@/components/demo-embed'

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
    <section className="detail-demo mt-12 border border-border bg-card">
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
        {demoLink ? (
          <div className="overflow-hidden border border-border bg-[#111116]">
            <div className="flex h-7 items-center gap-1.5 border-b border-border px-2 font-mono text-[10px] text-muted-foreground">
              <i className="size-1.5 rounded-full bg-[#4a4a52]" /><i className="size-1.5 rounded-full bg-[#4a4a52]" /><i className="size-1.5 rounded-full bg-[#4a4a52]" />
              <span className="truncate pl-2">{demoLink.replace(/^https?:\/\//, '')}</span>
            </div>
            <DemoEmbed src={demoLink} title={`${project.name} 产品 Demo`} className="h-[560px] w-full border-0 bg-white" />
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function ProjectDetail({ project, backHref = '/', showLike = true }: { project: ProjectDetail; backHref?: string; showLike?: boolean }) {
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
    <article className="detail-page mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 lg:px-16">
      <Link
        href={backHref}
        className="font-mono text-xs tracking-[0.08em] text-muted-foreground transition-colors hover:text-primary"
      >
        ← BACK / {backHref === '/' ? 'INDEX' : 'DASHBOARD'}
      </Link>

      <div className="detail-crumb mb-8">PROJECTS / PROJECT {project.id}</div>
      <div className="detail-layout">
      <div>
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
           <p className="eyebrow">FEATURED PROJECT / {projectIdLabel(project.id)}</p>
           <h1 className="detail-title mt-3 text-[clamp(40px,5vw,70px)] font-bold leading-[.96]">
            {project.name}
          </h1>
          {tagline ? (
            <p className="mt-3 text-lg leading-[1.7] text-muted-foreground">
              {tagline}
            </p>
          ) : null}
           {showLike ? <div className="detail-actions mt-5"><LikeButton projectId={project.id} likeCount={project.likeCount} /></div> : null}

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

      {traction.length ? (
        <section className="mt-12 border border-border p-6">
          <div className="flex flex-wrap gap-8">
            {traction.map((item) => (
              <div key={item.label}>
                <div className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">{item.label}</div>
                <div className="mt-1 text-2xl font-bold">{item.value}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {project.seekingSkills?.length ? (
        <section className="mt-12">
          <h2 className="text-lg font-bold">寻求帮助</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {project.seekingSkills.map((skill) => (
              <span key={skill} className="chip-hard">{skill}</span>
            ))}
          </div>
        </section>
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

      {contacts.length ? (
        <section className="mt-12">
          <h2 className="text-lg font-bold">联系方式</h2>
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm text-muted-foreground">
            {contacts.map((contact) => (
              <span key={contact.label}>
                <span className="font-mono text-[10px] tracking-[0.08em]">{contact.label}</span>
                <span className="ml-2 text-foreground">{contact.value}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}
      </div>
      <aside className="detail-aside"><DemoAssets project={project} /></aside>
      </div>
    </article>
  )
}
