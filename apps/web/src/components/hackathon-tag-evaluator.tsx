'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HACKATHON_TRACK_TAGS, type HackathonDimension, type HackathonTrack } from '@shenicest/shared'
import { useOptionalAuth } from '@/components/auth-provider'
import { selectHackathonTag, unselectHackathonTag } from '@/lib/client-api'

const dimensionLabels: Record<HackathonDimension, string> = {
  experience: '体验感受', technology: '技术实现', creativity: '创意表达', utility: '实用价值', improvement: '改进建议',
}

const dimensionCodes: Record<HackathonDimension, string> = {
  experience: 'EXPERIENCE', technology: 'BUILD', creativity: 'ORIGINALITY', utility: 'VALUE', improvement: 'NEXT PASS',
}

export function HackathonTagEvaluator({ projectId, track, initialTagCounts, initialMyTagIds }: {
  projectId: number
  track: HackathonTrack
  initialTagCounts: Record<string, number>
  initialMyTagIds: string[]
}) {
  const router = useRouter()
  const auth = useOptionalAuth()
  const [tagCounts, setTagCounts] = useState(initialTagCounts)
  const [selected, setSelected] = useState(() => new Set(initialMyTagIds))
  const [open, setOpen] = useState(false)
  const [pendingTag, setPendingTag] = useState<string | null>(null)
  const [error, setError] = useState('')
  const trackConfig = HACKATHON_TRACK_TAGS[track]
  const tagEntries = Object.entries(trackConfig.dimensions) as [HackathonDimension, readonly string[]][]
  const allTags = tagEntries.flatMap(([dimension, tags]) => tags.map((label, index) => ({ id: `${dimension}:${index}`, label, dimension })))
  const visibleTags = allTags.filter((tag) => (tagCounts[tag.id] ?? 0) > 0 || selected.has(tag.id))
  const totalSignals = Object.values(tagCounts).reduce((total, count) => total + count, 0)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('tag-modal-open')
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('tag-modal-open')
    }
  }, [open])

  async function toggle(tagId: string) {
    if (!auth?.user) {
      window.sessionStorage.setItem('shenicest_pending_hackathon_tag', `${projectId}:${tagId}`)
      router.push('/login')
      return
    }
    if (pendingTag) return
    const nextSelected = !selected.has(tagId)
    setPendingTag(tagId)
    setError('')
    setSelected((current) => {
      const next = new Set(current)
      if (nextSelected) next.add(tagId)
      else next.delete(tagId)
      return next
    })
    setTagCounts((current) => ({ ...current, [tagId]: Math.max(0, (current[tagId] ?? 0) + (nextSelected ? 1 : -1)) }))
    try {
      const response = nextSelected ? await selectHackathonTag(projectId, tagId) : await unselectHackathonTag(projectId, tagId)
      if (response.error || !response.data) throw new Error(response.error?.body.error.message ?? '提交失败')
      setTagCounts(response.data.tagCounts)
    } catch (err) {
      setSelected((current) => {
        const next = new Set(current)
        if (nextSelected) next.delete(tagId)
        else next.add(tagId)
        return next
      })
      setTagCounts((current) => ({ ...current, [tagId]: Math.max(0, (current[tagId] ?? 0) + (nextSelected ? -1 : 1)) }))
      setError(err instanceof Error ? err.message : '提交失败，请稍后重试')
    } finally {
      setPendingTag(null)
    }
  }

  return <section className="detail-section detail-tags" aria-labelledby="tags-title">
    <div className="detail-section-heading"><span>03</span><h2 id="tags-title">社区评价</h2></div>
    <div className="tag-panel">
      <header className="tag-panel-head">
        <div><span>COMMUNITY SIGNAL / {trackConfig.label}</span><p>来自社区的真实体验反馈，帮助团队看见项目的亮点与下一步。</p></div>
        <button type="button" className="tag-open-button" onClick={() => auth?.user ? setOpen(true) : router.push('/login')}><span>{auth?.user ? '参与评价' : '登录后评价'}</span><b aria-hidden>↗</b></button>
      </header>
      <div className="tag-overview">
        <div className="tag-overview-total"><span>COMMUNITY SIGNALS</span><strong>{String(totalSignals).padStart(2, '0')}</strong><p>{totalSignals ? '条累计反馈' : '还没有人留下评价'}</p></div>
        <div className="tag-overview-list">
          {visibleTags.length ? visibleTags.slice(0, 8).map((tag) => <span className={selected.has(tag.id) ? 'is-mine' : ''} key={tag.id}>{tag.label}<b>{tagCounts[tag.id] ?? 0}</b></span>) : <p>成为第一个留下体验信号的人</p>}
          {visibleTags.length > 8 ? <em>+{visibleTags.length - 8} 更多</em> : null}
        </div>
      </div>
      <footer className="tag-panel-foot"><span><i aria-hidden /> 已展示有社区反馈的标签</span><span>{selected.size ? `你选择了 ${selected.size} 项` : '可多选标签'}</span></footer>
    </div>
    {error ? <p className="tag-error" role="alert">{error}</p> : null}
    {open ? <div className="tag-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <section className="tag-modal" role="dialog" aria-modal="true" aria-labelledby="tag-modal-title">
        <header className="tag-modal-head"><div><span>YOUR SIGNAL / {trackConfig.label}</span><h2 id="tag-modal-title">留下你的体验</h2><p>选择你认为符合项目的标签，可多选。</p></div><button type="button" className="tag-modal-close" onClick={() => setOpen(false)} aria-label="关闭评价弹窗">×</button></header>
        <div className="tag-modal-body">
          {tagEntries.map(([dimension, tags], dimensionIndex) => <div className={`tag-dimension ${dimension === 'improvement' ? 'tag-dimension-improvement' : ''}`} key={dimension}>
            <div className="tag-dimension-head"><span>{String(dimensionIndex + 1).padStart(2, '0')} / {dimensionCodes[dimension]}</span><h3>{dimensionLabels[dimension]}</h3></div>
            <div className="tag-options">{tags.map((label, index) => {
              const tagId = `${dimension}:${index}`
              const isSelected = selected.has(tagId)
              return <button key={tagId} type="button" className={`evaluation-tag ${isSelected ? 'selected' : ''}`} onClick={() => toggle(tagId)} disabled={pendingTag === tagId} aria-pressed={isSelected} aria-busy={pendingTag === tagId}><i aria-hidden />{label}<b>{pendingTag === tagId ? '··' : tagCounts[tagId] ?? 0}</b></button>
            })}</div>
          </div>)}
        </div>
        <footer className="tag-modal-foot"><span>已选择 {selected.size} 项</span><button type="button" className="tag-modal-done" onClick={() => setOpen(false)}>完成 <b aria-hidden>↗</b></button></footer>
      </section>
    </div> : null}
  </section>
}
