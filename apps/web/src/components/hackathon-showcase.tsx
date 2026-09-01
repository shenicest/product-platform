'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { getHackathonProjects } from '@/server/projects'
import { stripTrackAppendix } from '@/lib/hackathon-project'
import { HackathonCover } from '@/components/hackathon-cover'
import { HackathonLikeButton } from '@/components/hackathon-like-button'
type Project = Awaited<ReturnType<typeof getHackathonProjects>>['data'][number]

const tracks = [
  { value: 'all', label: '全部' },
  { value: 'software', label: '软件' },
  { value: 'hardware', label: '硬件' },
  { value: 'game', label: '游戏' },
  { value: 'aigc', label: 'AIGC 影像' },
] as const

function trackFor(project: Project) {
  const text = `${project.track ?? ''} ${project.name}`.toLowerCase()
  if (text.includes('硬件') || text.includes('hardware')) return 'hardware'
  if (text.includes('游戏') || text.includes('game')) return 'game'
  if (text.includes('aigc') || text.includes('影像')) return 'aigc'
  return 'software'
}

export function HackathonShowcase({ projects, total, selectedTrack }: { projects: Project[]; total: number; selectedTrack: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [query, setQuery] = useState('')
  const selected = selectedTrack
  const filtered = projects.filter((project) => {
    const haystack = `${project.name} ${project.teamName ?? ''}`.toLowerCase()
    return !query.trim() || haystack.includes(query.trim().toLowerCase())
  })

  function selectTrack(value: string) {
    router.push(value === 'all' ? pathname : `${pathname}?track=${value}`)
  }

  return (
    <main className="showcase-shell mx-auto w-full max-w-[1440px] px-5 sm:px-8 lg:px-16">
      <section className="showcase-hero grid gap-8 py-14 sm:py-20 lg:grid-cols-[1.4fr_.6fr] lg:items-end">
        <div><p className="eyebrow">HACKATHON / G001 / PROJECTS</p><h1>让好作品<br />被看见。</h1><p className="hero-copy">探索黑客松的参赛项目。按赛道浏览，打开项目详情，为你支持的创意留下一个赞。</p></div>
        <div className="hero-meta"><strong>{total}</strong><span>个项目已入选展示<br />项目内容持续更新中</span></div>
      </section>
      <section id="projects">
        <div className="showcase-toolbar"><div className="filters" role="group" aria-label="按赛道筛选">{tracks.map((track) => <button key={track.value} type="button" className={`filter ${selected === track.value ? 'active' : ''}`} onClick={() => selectTrack(track.value)}>{track.label}</button>)}</div><input className="showcase-search" value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索项目名称" aria-label="搜索项目名称" /></div>
        <div className="section-head"><h2>精选项目</h2><span className="section-count">SHOWING {String(filtered.length).padStart(2, '0')} / {total}</span></div>
        {filtered.length ? <div className="showcase-grid">{filtered.map((project) => <article className="showcase-card" key={project.id}><Link href={`/hackathon/projects/${project.id}`}><HackathonCover url={project.coverUrl} name={project.name} projectId={project.id} track={trackFor(project)} /><div className="showcase-body"><h3>{project.name}</h3><p>{project.tagline || stripTrackAppendix(project.description) || '暂无项目简介'}</p></div></Link><footer><span>{project.teamName || '匿名团队'}</span><HackathonLikeButton projectId={project.id} count={project.likeCount} /></footer></article>)}</div> : <div className="showcase-empty">没有找到匹配的项目。换个赛道或关键词试试。</div>}
      </section>
    </main>
  )
}
