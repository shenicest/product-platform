'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HACKATHON_TRACK_TAGS, type HackathonDimension, type HackathonTrack } from '@shenicest/shared'
import { useOptionalAuth } from '@/components/auth-provider'
import { selectHackathonTag, unselectHackathonTag } from '@/lib/client-api'
import { Chip, ChipButton } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { Eyebrow } from '@/components/ui/typography'

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
    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
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

  return (
    <section className="detail-section" aria-labelledby="tags-title">
      <h2 id="tags-title" className="detail-section__title">
        <span className="detail-section__index">03</span>
        社区评价
      </h2>

      <div className="ui-card ui-card--static mt-5">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-5">
          <div className="min-w-0">
            <Eyebrow tone="accent">COMMUNITY SIGNAL / {trackConfig.label}</Eyebrow>
            <p className="mt-2 max-w-[52ch] text-body-sm leading-relaxed text-muted-foreground">
              来自社区的真实体验反馈，帮助团队看见项目的亮点与下一步。
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => auth?.user ? setOpen(true) : router.push('/login')}
          >
            <span>{auth?.user ? '参与评价' : '登录后评价'}</span>
            <b aria-hidden className="text-body leading-none">↗</b>
          </Button>
        </header>

        <div className="grid gap-5 px-5 py-5 md:grid-cols-[150px_minmax(0,1fr)] md:items-center">
          <div className="border-b border-border pb-4 md:border-b-0 md:border-r md:pb-0 md:pr-5">
            <span className="mono">COMMUNITY SIGNALS</span>
            <strong className="mt-2 block font-digits text-[2rem] font-normal leading-none text-brand-text">
              {String(totalSignals).padStart(2, '0')}
            </strong>
            <p className="mt-1.5 text-meta text-muted-foreground">
              {totalSignals ? '条累计反馈' : '还没有人留下评价'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {visibleTags.length ? (
              visibleTags.slice(0, 8).map((tag) => (
                <Chip key={tag.id} tone={selected.has(tag.id) ? 'accent' : 'neutral'}>
                  {tag.label}
                  <b className="font-mono text-meta">{tagCounts[tag.id] ?? 0}</b>
                </Chip>
              ))
            ) : (
              <p className="text-body-sm text-muted-foreground">成为第一个留下体验信号的人</p>
            )}
            {visibleTags.length > 8 ? (
              <Chip tone="accent">+{visibleTags.length - 8} 更多</Chip>
            ) : null}
          </div>
        </div>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-5 py-3 font-mono text-meta text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <i aria-hidden className="size-1.5 rounded-full bg-brand" />
            已展示有社区反馈的标签
          </span>
          <span className="md:ml-auto">{selected.size ? `你选择了 ${selected.size} 项` : '可多选标签'}</span>
        </footer>
      </div>

      {error ? (
        <p className="ui-note ui-note--danger mt-3.5" role="alert">
          {error}
        </p>
      ) : null}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-6 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <section
            className="flex max-h-[min(820px,calc(100dvh-3rem))] w-[min(760px,100%)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tag-modal-title"
          >
            <header className="flex justify-between gap-5 border-b border-border px-6 py-5">
              <div>
                <Eyebrow tone="accent">YOUR SIGNAL / {trackConfig.label}</Eyebrow>
                <h2 id="tag-modal-title" className="mt-2 text-h3 font-bold text-foreground">留下你的体验</h2>
                <p className="mt-1.5 text-body-sm text-muted-foreground">选择你认为符合项目的标签，可多选。</p>
              </div>
              <button
                type="button"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-h3 leading-none text-muted-foreground transition-colors hover:border-brand-line hover:text-brand-text"
                onClick={() => setOpen(false)}
                aria-label="关闭评价弹窗"
              >
                ×
              </button>
            </header>

            <div className="overflow-y-auto">
              {tagEntries.map(([dimension, tags], dimensionIndex) => (
                <div
                  className={
                    dimension === 'improvement'
                      ? 'border-b border-border bg-brand-wash px-6 py-5'
                      : 'border-b border-border px-6 py-5'
                  }
                  key={dimension}
                >
                  <div className="mb-3.5">
                    <Eyebrow tone={dimension === 'improvement' ? 'accent' : 'muted'}>
                      {String(dimensionIndex + 1).padStart(2, '0')} / {dimensionCodes[dimension]}
                    </Eyebrow>
                    <h3 className="mt-1.5 text-body-lg font-bold text-foreground">{dimensionLabels[dimension]}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((label, index) => {
                      const tagId = `${dimension}:${index}`
                      const isSelected = selected.has(tagId)
                      return (
                        <ChipButton
                          key={tagId}
                          tone={isSelected ? 'accent' : 'neutral'}
                          className="min-h-10"
                          onClick={() => toggle(tagId)}
                          disabled={pendingTag === tagId}
                          aria-pressed={isSelected}
                          aria-busy={pendingTag === tagId}
                        >
                          <i
                            aria-hidden
                            className={
                              isSelected
                                ? 'size-1.5 border border-brand bg-brand'
                                : 'size-1.5 border border-border-strong bg-transparent'
                            }
                          />
                          {label}
                          <b className="min-w-[18px] font-mono text-meta">
                            {pendingTag === tagId ? '··' : tagCounts[tagId] ?? 0}
                          </b>
                        </ChipButton>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <footer className="flex items-center justify-between gap-4 px-6 py-3.5 font-mono text-meta text-muted-foreground">
              <span>已选择 {selected.size} 项</span>
              <Button variant="primary" size="sm" onClick={() => setOpen(false)}>
                完成 <b aria-hidden className="text-body leading-none">↗</b>
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  )
}
