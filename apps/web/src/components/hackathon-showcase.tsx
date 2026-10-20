'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { getHackathonProjects } from '@/server/projects'
import { normalizeHackathonTrack, stripTrackAppendix } from '@/lib/hackathon-project'
import { HackathonCover } from '@/components/hackathon-cover'
import { HackathonLikeButton } from '@/components/hackathon-like-button'
import { Chip, ChipButton, type ChipTone } from '@/components/ui/chip'
import { Eyebrow } from '@/components/ui/typography'
import { BloomPop } from '@/components/ui/bloom-pop'
type Project = Awaited<ReturnType<typeof getHackathonProjects>>['data'][number]

const tracks = [
  { value: 'all', label: '全部' },
  { value: 'software', label: '软件' },
  { value: 'hardware', label: '硬件' },
  { value: 'game', label: '游戏' },
  { value: 'aigc', label: 'AIGC 影像' },
] as const

/** 赛道 → 语义色。颜色只走 Chip 的 tone，组件里不出现任何色值。 */
const TRACK_TONE: Record<string, ChipTone> = {
  software: 'sky',
  hardware: 'warning',
  game: 'success',
  aigc: 'accent',
}

function trackFor(project: Project) {
  return normalizeHackathonTrack(project.track, project.name)
}

export function HackathonShowcase({ projects, total, selectedTrack, query }: { projects: Project[]; total: number; selectedTrack: string; query: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState(query)
  const selected = selectedTrack

  function searchProjects(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (selected !== 'all') params.set('track', selected)
    if (search.trim()) params.set('q', search.trim())
    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname)
  }

  function selectTrack(value: string) {
    const params = new URLSearchParams()
    if (value !== 'all') params.set('track', value)
    if (search.trim()) params.set('q', search.trim())
    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname)
  }

  return (
    <main className="shell py-10 sm:py-14">
      <section className="grid gap-8 border-b border-border pb-10 lg:grid-cols-[1.4fr_.6fr] lg:items-end">
        <div className="min-w-0">
          <Eyebrow>HACKATHON / G001 / PROJECTS</Eyebrow>
          <h1 className="mt-4 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[0.96] tracking-[-0.05em] text-foreground">
            让好作品
            <br />
            被看见。
          </h1>
          <p className="mt-5 max-w-[52ch] text-body-lg leading-relaxed text-muted-foreground">
            探索黑客松的参赛项目。按赛道浏览，打开项目详情，为你支持的创意留下一个赞。
          </p>
          <Link
            href="/hackathon/statement"
            className="bloom-label mt-5 inline-flex items-baseline gap-2.5 border-b border-brand-line pb-1 text-body-sm text-brand-text transition-colors hover:border-brand hover:text-foreground"
          >
            <span>She Nicest 团队关于「烈变千人黑客松」活动的致歉与声明</span>
            <span aria-hidden="true" className="text-body">&gt;</span>
            <BloomPop />
          </Link>
        </div>
        <div className="border-brand-line lg:border-l lg:pl-7">
          <strong className="block font-digits text-[3rem] font-normal leading-none text-brand-text">
            {total}
          </strong>
          <span className="mt-2.5 block text-label text-muted-foreground">
            个项目已入选展示
            <br />
            项目内容持续更新中
          </span>
        </div>
      </section>

      <section id="projects">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="按赛道筛选">
            {tracks.map((track) => (
              <ChipButton
                key={track.value}
                aria-pressed={selected === track.value}
                onClick={() => selectTrack(track.value)}
                tone={selected === track.value ? 'accent' : 'neutral'}
                className="font-mono"
              >
                {track.label}
              </ChipButton>
            ))}
          </div>
          <form onSubmit={searchProjects} className="w-full sm:w-auto">
            <div className="ui-search w-full sm:w-[240px]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.6-3.6" strokeLinecap="round" />
              </svg>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                placeholder="搜索项目名称"
                aria-label="搜索项目名称"
              />
            </div>
          </form>
        </div>

        <header className="section-head pt-14">
          <div className="min-w-0">
            <h2 className="section-head__title">精选项目</h2>
          </div>
          <p className="section-head__aside">
            SHOWING {String(projects.length).padStart(2, '0')} / {total}
          </p>
        </header>

        {projects.length ? (
          <div className="card-grid">
            {projects.map((project) => {
              const track = trackFor(project)
              return (
                <article className="ui-card group h-full" key={project.id}>
                  <Link
                    href={`/hackathon/projects/${project.id}`}
                    className="flex flex-1 flex-col focus-visible:outline-none"
                  >
                    <HackathonCover
                      url={project.coverUrl}
                      name={project.name}
                      projectId={project.id}
                      className="card-cover--tall"
                    />
                    <div className="card-body">
                      {/* 标题不用 .card-title：L3 类未分包，工具类无法覆盖它的 color，
                          这里直接用语义工具类，才能让 group-hover 生效。 */}
                      <h3 className="text-body-lg font-bold leading-snug text-foreground transition-colors group-hover:text-brand-text">
                        {project.name}
                      </h3>
                      <p className="card-text line-clamp-3">
                        {project.tagline || stripTrackAppendix(project.description) || '暂无项目简介'}
                      </p>
                      {track ? (
                        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                          <Chip tone={TRACK_TONE[track]} className="font-mono">
                            {track.toUpperCase()}
                          </Chip>
                        </div>
                      ) : null}
                    </div>
                  </Link>
                  <footer className="card-footer card-footer--bordered">
                    <span className="mono truncate">{project.teamName || '匿名团队'}</span>
                    <HackathonLikeButton projectId={project.id} count={project.likeCount} />
                  </footer>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="ui-empty">没有找到匹配的项目。换个赛道或关键词试试。</div>
        )}
      </section>
    </main>
  )
}
