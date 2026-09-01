import { notFound } from 'next/navigation'
import { getHackathonProject } from '@/server/projects'
import { stripTrackAppendix } from '@/lib/hackathon-project'
import { HackathonCover } from '@/components/hackathon-cover'
import { PublicInteractionBoundary } from '@/components/public-interaction-boundary'
import { HackathonLikeButton } from '@/components/hackathon-like-button'
import { HackathonHideButton } from '@/components/hackathon-hide-button'
import { DemoEmbed } from '@/components/demo-embed'

export const dynamic = 'force-dynamic'

function visibleDescription(description: string | null) {
  return stripTrackAppendix(description) || '暂无项目介绍'
}

export default async function HackathonProjectPage(props: PageProps<'/hackathon/projects/[id]'>) {
  const rawId = (await props.params).id
  if (!/^\d+$/.test(rawId)) notFound()
  const project = await getHackathonProject(Number(rawId))
  if (!project) notFound()
  return <PublicInteractionBoundary><main className="detail-page mx-auto w-full max-w-[1440px] px-5 py-8 sm:px-8 lg:px-16">
    <a className="detail-back" href="/hackathon">← 返回项目展厅</a>
    <header className="detail-hero mt-8">
      <div>
        <p className="eyebrow">FEATURED PROJECT / EVENT 04</p>
        <h1 className="detail-title mt-4 text-[clamp(40px,5vw,70px)] font-bold leading-[.96]">{project.name}</h1>
        {project.tagline ? <p className="detail-tagline mt-4">{project.tagline}</p> : null}
      </div>
      <div className="detail-summary" aria-label="项目概要">
        <div><span>PROJECT ID</span><strong>#{String(project.id).padStart(4, '0')}</strong></div>
        <div><span>TRACK</span><strong>{(project.track || 'software').toUpperCase()}</strong></div>
        {project.teamName ? <div><span>TEAM</span><strong>{project.teamName}</strong></div> : null}
        <div className="detail-summary-action"><span>SUPPORT THIS PROJECT</span><HackathonLikeButton projectId={project.id} count={project.likeCount} /></div>
      </div>
    </header>

    <div className="detail-layout mt-12">
      <article className="detail-main">
        <div className="detail-cover-wrap"><HackathonCover url={project.coverUrl} name={project.name} projectId={project.id} track={project.track} className="detail-cover" /></div>
        <section className="detail-section" aria-labelledby="intro-title">
          <div className="detail-section-heading"><span>01</span><h2 id="intro-title">项目介绍</h2></div>
          <p className="detail-copy whitespace-pre-line">{visibleDescription(project.description)}</p>
        </section>
        {project.teamName ? <section className="detail-section detail-team" aria-labelledby="team-title"><div className="detail-section-heading"><span>02</span><h2 id="team-title">团队</h2></div><p className="detail-copy">{project.teamName}</p></section> : null}
      </article>
      <aside className="detail-aside">
        <div className="detail-aside-heading"><span>TRY IT OUT</span><span className="detail-status"><i aria-hidden /> LIVE</span></div>
        {project.demoLink ? <div className="detail-demo">
          <DemoEmbed className="h-[620px] w-full bg-white" src={project.demoLink} title={`${project.name} Demo`} />
          <p className="border-t border-border bg-[#111116] p-3 text-center text-xs text-muted-foreground">如果 Demo 无法显示，请 <a className="underline" href={project.demoLink} target="_blank" rel="noopener noreferrer">打开产品 Demo</a>。</p>
        </div> : <div className="showcase-empty">暂无 Demo 链接</div>}
        <div className="detail-links">
          {project.demoLink ? <a className="detail-link detail-link-primary" href={project.demoLink} target="_blank" rel="noreferrer">打开产品 Demo <span aria-hidden>↗</span></a> : null}
           {project.githubUrl ? <a className="detail-link" href={project.githubUrl} target="_blank" rel="noreferrer">查看 GitHub <span aria-hidden>↗</span></a> : null}
           <HackathonHideButton projectId={project.id} />
        </div>
      </aside>
    </div>
  </main></PublicInteractionBoundary>
}
