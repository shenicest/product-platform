import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getHackathonProject } from '@/server/projects'
import { normalizeHackathonTrack, stripTrackAppendix } from '@/lib/hackathon-project'
import { HackathonTagEvaluator } from '@/components/hackathon-tag-evaluator'
import { HackathonCover } from '@/components/hackathon-cover'
import { PublicInteractionBoundary } from '@/components/public-interaction-boundary'
import { HackathonLikeButton } from '@/components/hackathon-like-button'
import { HackathonHideButton } from '@/components/hackathon-hide-button'
import { HackathonConnectButton } from '@/components/hackathon-connection-dialog'
import { getMyHackathonConnectionStatus } from '@/server/hackathon-connections'
import { DemoEmbed } from '@/components/demo-embed'
import { HackathonProjectEditor } from '@/components/hackathon-project-editor'
import { ButtonAnchor } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'

export const dynamic = 'force-dynamic'

function visibleDescription(description: string | null) {
  return stripTrackAppendix(description) || '暂无项目介绍'
}

export default async function HackathonProjectPage(props: PageProps<'/hackathon/projects/[id]'>) {
  const rawId = (await props.params).id
  if (!/^\d+$/.test(rawId)) notFound()
  const project = await getHackathonProject(Number(rawId))
  if (!project) notFound()
  const track = normalizeHackathonTrack(project.track, project.name)
  const connectGate = await getMyHackathonConnectionStatus(project.id)
  return (
    <PublicInteractionBoundary>
      <main className="shell py-8">
        <Link
          href="/hackathon"
          className="font-mono text-meta tracking-[0.08em] text-muted-foreground transition-colors hover:text-brand-text"
        >
          ← 返回项目展厅
        </Link>

        <header className="mt-8 grid gap-8 border-b border-border pb-9 lg:grid-cols-[minmax(0,1fr)_minmax(250px,.42fr)] lg:items-end">
          <div className="min-w-0">
            <Eyebrow>FEATURED PROJECT / EVENT 04</Eyebrow>
            <h1 className="detail-title">{project.name}</h1>
            {project.tagline ? <p className="detail-tagline">{project.tagline}</p> : null}
          </div>

          {/* 摘要区：值行不用 `.mono`（它自带 color/font-size，会盖掉工具类），
              改用 font-mono 工具类组合，保证 label 尺寸与前景色可控。 */}
          <dl className="grid grid-cols-2 rounded-lg border border-border bg-card" aria-label="项目概要">
            <div className="min-w-0 border-b border-border py-3 px-4">
              <dt className="font-mono text-meta tracking-[0.1em] text-muted-foreground">PROJECT ID</dt>
              <dd className="mt-1.5 truncate font-mono text-label font-bold text-foreground">
                #{String(project.id).padStart(4, '0')}
              </dd>
            </div>
            <div className="min-w-0 border-b border-border py-3 px-4">
              <dt className="font-mono text-meta tracking-[0.1em] text-muted-foreground">TRACK</dt>
              <dd className="mt-1.5 truncate font-mono text-label font-bold text-foreground">
                {track ? track.toUpperCase() : '未分类'}
              </dd>
            </div>
            {project.teamName ? (
              <div className="col-span-2 min-w-0 border-b border-border py-3 px-4">
                <dt className="font-mono text-meta tracking-[0.1em] text-muted-foreground">TEAM</dt>
                <dd className="mt-1.5 truncate font-mono text-label font-bold text-foreground">
                  {project.teamName}
                </dd>
              </div>
            ) : null}
            <div className="col-span-2 py-3 px-4">
              <dt className="font-mono text-meta tracking-[0.1em] text-muted-foreground">
                SUPPORT THIS PROJECT
              </dt>
              <dd className="mt-2.5">
                <HackathonLikeButton projectId={project.id} count={project.likeCount} />
              </dd>
            </div>
          </dl>
        </header>

        <div className="detail-layout mt-12">
          <article>
            <HackathonCover
              url={project.coverUrl}
              name={project.name}
              projectId={project.id}
              priority
              className="card-cover--wide rounded-lg border border-border"
            />

            <section className="detail-section" aria-labelledby="intro-title">
              <h2 id="intro-title" className="detail-section__title">
                <span className="detail-section__index">01</span>
                项目介绍
              </h2>
              <p className="detail-copy whitespace-pre-line">{visibleDescription(project.description)}</p>
            </section>

            {project.teamName ? (
              <section className="detail-section" aria-labelledby="team-title">
                <h2 id="team-title" className="detail-section__title">
                  <span className="detail-section__index">02</span>
                  团队
                </h2>
                <p className="detail-copy">{project.teamName}</p>
              </section>
            ) : null}

            {track ? <HackathonTagEvaluator projectId={project.id} track={track} initialTagCounts={project.tagCounts} initialMyTagIds={project.myTagIds} /> : null}
          </article>

          <aside className="detail-aside">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-mono text-meta tracking-[0.1em] text-muted-foreground">TRY IT OUT</span>
              <span className="inline-flex items-center gap-2 font-mono text-meta tracking-[0.1em] text-brand-text">
                <i aria-hidden className="detail-callout__dot" /> LIVE
              </span>
            </div>

            {project.demoLink ? (
              <div className="demo-shell mt-4">
                <div className="demo-shell__bar">
                  <i className="demo-shell__dot" aria-hidden />
                  <i className="demo-shell__dot" aria-hidden />
                  <i className="demo-shell__dot" aria-hidden />
                  <span className="demo-shell__url">{project.demoLink.replace(/^https?:\/\//, '')}</span>
                </div>
                <DemoEmbed className="demo-shell__frame h-[620px]" src={project.demoLink} title={`${project.name} Demo`} />
                <p className="border-t border-border bg-secondary p-3 text-center text-meta text-muted-foreground">
                  如果 Demo 无法显示，请{' '}
                  <a className="text-brand-text underline underline-offset-2" href={project.demoLink} target="_blank" rel="noopener noreferrer">
                    打开产品 Demo
                  </a>
                  。
                </p>
              </div>
            ) : (
              <div className="ui-empty mt-4">暂无 Demo 链接</div>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {project.demoLink ? (
                <ButtonAnchor href={project.demoLink} target="_blank" rel="noreferrer" variant="primary" size="sm">
                  打开产品 Demo <span className="ui-btn__arrow" aria-hidden>↗</span>
                </ButtonAnchor>
              ) : null}
              {project.githubUrl ? (
                <ButtonAnchor href={project.githubUrl} target="_blank" rel="noreferrer" variant="secondary" size="sm">
                  查看 GitHub <span className="ui-btn__arrow" aria-hidden>↗</span>
                </ButtonAnchor>
              ) : null}
              <HackathonHideButton projectId={project.id} />
            </div>

            <HackathonConnectButton projectId={project.id} initialStatus={connectGate} />
            <HackathonProjectEditor project={project} />
          </aside>
        </div>
      </main>
    </PublicInteractionBoundary>
  )
}
