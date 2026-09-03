'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HACKATHON_TRACK_TAGS, type HackathonDimension, type HackathonTrack } from '@shenicest/shared'
import { useOptionalAuth } from '@/components/auth-provider'
import { selectHackathonTag, unselectHackathonTag } from '@/lib/client-api'

const dimensionLabels: Record<HackathonDimension, string> = {
  experience: '体验感受',
  technology: '技术实现',
  creativity: '创意表达',
  utility: '实用价值',
  improvement: '改进建议',
}

const dimensionNotes: Record<HackathonDimension, string> = {
  experience: '第一次体验时，什么感受最明显？',
  technology: '性能、稳定性和完成度表现如何？',
  creativity: '它是否带来了独特而清晰的表达？',
  utility: '它有没有解决一个真实、具体的问题？',
  improvement: '如果继续迭代，最该优先处理什么？',
}

const dimensionCodes: Record<HackathonDimension, string> = {
  experience: 'EXPERIENCE',
  technology: 'BUILD',
  creativity: 'ORIGINALITY',
  utility: 'VALUE',
  improvement: 'NEXT PASS',
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
  const [pendingTag, setPendingTag] = useState<string | null>(null)
  const [error, setError] = useState('')
  const trackConfig = HACKATHON_TRACK_TAGS[track]
  const tagEntries = (Object.entries(trackConfig.dimensions) as [HackathonDimension, readonly string[]][])
  const allTags = tagEntries.flatMap(([dimension, tags]) => tags.map((label, index) => ({ id: `${dimension}:${index}`, label })))
  const totalSignals = Object.values(tagCounts).reduce((total, count) => total + count, 0)
  const topTag = allTags.reduce<{ id: string; label: string; count: number } | null>((top, tag) => {
    const count = tagCounts[tag.id] ?? 0
    return !top || count > top.count ? { ...tag, count } : top
  }, null)
  const highestCount = topTag?.count ?? 0

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
        <div><span>COMMUNITY SIGNAL / {trackConfig.label}</span><p>选出最符合你体验的标签，帮助团队看到亮点与下一步方向。</p></div>
        <span className="tag-panel-mode">MULTI SELECT</span>
      </header>
      <div className="tag-metrics" aria-label="评价概览">
        <div><span>TOTAL SIGNALS</span><strong>{String(totalSignals).padStart(2, '0')}</strong><p>社区累计反馈</p></div>
        <div><span>YOUR INPUT</span><strong>{String(selected.size).padStart(2, '0')}</strong><p>{selected.size ? '已记录你的选择' : '等待你的评价'}</p></div>
        <div className="tag-metric-top"><span>MOST SELECTED</span><strong>{topTag?.count ? topTag.label : '等待首条反馈'}</strong><p>{topTag?.count ? `${topTag.count} 人有同感` : '成为第一个评价的人'}</p></div>
      </div>
      <div className="tag-evaluator">
        {tagEntries.map(([dimension, tags], dimensionIndex) => <div className={`tag-dimension ${dimension === 'improvement' ? 'tag-dimension-improvement' : ''}`} key={dimension}>
          <div className="tag-dimension-head"><span>{String(dimensionIndex + 1).padStart(2, '0')} / {dimensionCodes[dimension]}</span><h3>{dimensionLabels[dimension]}</h3><p>{dimensionNotes[dimension]}</p></div>
          <div className="tag-options">
            {tags.map((label, index) => {
              const tagId = `${dimension}:${index}`
              const isSelected = selected.has(tagId)
              const count = tagCounts[tagId] ?? 0
              const isTop = count > 0 && count === highestCount
              return <button key={tagId} type="button" className={`evaluation-tag ${isSelected ? 'selected' : ''} ${isTop ? 'top-signal' : ''}`} onClick={() => toggle(tagId)} disabled={pendingTag === tagId} aria-pressed={isSelected} aria-busy={pendingTag === tagId}>
                <i aria-hidden />
                <span>{label}</span>
                <b>{pendingTag === tagId ? '··' : String(count).padStart(2, '0')}</b>
                {highestCount > 0 ? <em aria-hidden style={{ width: `${Math.max(3, (count / highestCount) * 100)}%` }} /> : null}
              </button>
            })}
          </div>
        </div>)}
      </div>
      <footer className="tag-panel-foot">
        <span><i aria-hidden /> 你的选择</span><span>数字为社区选择次数</span>
        {!auth?.user ? <button type="button" onClick={() => router.push('/login')}>登录后参与 <b aria-hidden>↗</b></button> : <span>点击标签可随时修改</span>}
      </footer>
    </div>
    {error ? <p className="tag-error" role="alert">{error}</p> : null}
  </section>
}
