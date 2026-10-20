'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn, projectIdLabel } from '@/lib/utils'
import {
  OPERATOR_STATUS_COLORS,
  OPERATOR_STATUS_LABELS,
} from '@/lib/operator-filters'
import { saveFeaturedProjects } from '@/lib/client-api'
import type { OperatorFeaturedProject, OperatorProject } from '@/server/operator'

const MAX_FEATURED_PROJECTS = 50

function StatusBadge({ status }: { status: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 font-mono text-[10px] tracking-[0.08em]',
        OPERATOR_STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {OPERATOR_STATUS_LABELS[status] ?? '未知'}
    </span>
  )
}

function Cover({ project }: { project: OperatorProject }) {
  return (
    <div className="size-14 shrink-0 overflow-hidden border border-border bg-muted">
      {project.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.coverUrl}
          alt={project.name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-mono text-[9px] text-muted-foreground">
          NO COVER
        </div>
      )}
    </div>
  )
}

export function OperatorFeaturedProjectsClient({
  initialFeatured,
  liveProjects,
}: {
  initialFeatured: OperatorFeaturedProject[]
  liveProjects: OperatorProject[]
}) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<number[]>(
    initialFeatured.map((project) => project.id)
  )
  const [query, setQuery] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const catalog = useMemo(() => {
    const map = new Map<number, OperatorProject>()
    for (const project of liveProjects) map.set(project.id, project)
    for (const project of initialFeatured) map.set(project.id, project)
    return map
  }, [initialFeatured, liveProjects])

  const selectedSet = new Set(selectedIds)
  const selected = selectedIds
    .map((id) => catalog.get(id))
    .filter((project): project is OperatorProject => Boolean(project))

  const normalizedQuery = query.trim()
  const available = liveProjects.filter((project) => {
    if (selectedSet.has(project.id)) return false
    if (!normalizedQuery) return true
    return (
      project.name.includes(normalizedQuery) ||
      (project.tagline?.includes(normalizedQuery) ?? false)
    )
  })

  const dirty =
    selectedIds.length !== initialFeatured.length ||
    selectedIds.some((id, index) => id !== initialFeatured[index]?.id)

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= selectedIds.length) return
    setSelectedIds((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setMessage(null)
  }

  function remove(projectId: number) {
    setSelectedIds((current) => current.filter((id) => id !== projectId))
    setMessage(null)
  }

  function add(projectId: number) {
    if (selectedIds.includes(projectId)) return
    if (selectedIds.length >= MAX_FEATURED_PROJECTS) {
      setMessage({ type: 'error', text: `最多配置 ${MAX_FEATURED_PROJECTS} 个精选项目` })
      return
    }
    setSelectedIds((current) => [...current, projectId])
    setMessage(null)
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    const { error } = await saveFeaturedProjects(selectedIds)
    setSaving(false)
    if (error) {
      setMessage({
        type: 'error',
        text: error.body.error.message || '保存失败，请稍后重试',
      })
      return
    }
    setMessage({ type: 'ok', text: '已保存，首页即刻生效' })
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">HOMEPAGE CURATION</p>
          <h2 className="mt-2 text-[clamp(24px,3vw,32px)] font-bold leading-[1.15]">
            精选项目
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            已配置 {selectedIds.length} 个 · 首页每次展示最多 4 个
          </p>
        </div>
        <div className="flex items-center gap-3">
          {message ? (
            <p
              className={cn(
                'font-mono text-xs',
                message.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'
              )}
            >
              {message.text}
            </p>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="btn-hard btn-primary px-6 py-3 text-sm"
          >
            {saving ? '保存中…' : '保存配置'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h3 className="font-mono text-xs tracking-[0.12em] text-primary">
                SELECTED
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                顺序即首页展示顺序
              </p>
            </div>
            {selectedIds.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedIds([])
                  setMessage(null)
                }}
                className="font-mono text-[10px] text-muted-foreground underline-offset-4 hover:text-rose-600 hover:underline"
              >
                清空
              </button>
            ) : null}
          </header>

          {selected.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              尚未配置精选项目，首页将隐藏「精选项目」区块。
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {selected.map((project, index) => {
                const live = project.status === 3
                return (
                  <li key={project.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="w-6 shrink-0 font-digits text-lg leading-none text-primary">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <Cover project={project} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-primary">
                          {projectIdLabel(project.id)}
                        </span>
                        <StatusBadge status={project.status} />
                      </div>
                      <p className="mt-1 truncate text-sm font-bold">{project.name}</p>
                      {!live ? (
                        <p className="mt-1 font-mono text-[10px] text-rose-600">
                          当前未上线，不会展示在首页；请移除或恢复上线
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        aria-label={`上移 ${project.name}`}
                        className="btn-hard btn-ghost px-2 py-1 text-[10px]"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={index === selected.length - 1}
                        aria-label={`下移 ${project.name}`}
                        className="btn-hard btn-ghost px-2 py-1 text-[10px]"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(project.id)}
                        aria-label={`移除 ${project.name}`}
                        className="btn-hard btn-ghost px-2 py-1 text-[10px] text-rose-600"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h3 className="font-mono text-xs tracking-[0.12em] text-primary">
              AVAILABLE / LIVE
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              仅已上线项目可被设为精选
            </p>
          </header>

          <div className="border-b border-border p-4">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索项目名称或一句话介绍"
              className="h-10 w-full border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
          </div>

          {available.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              {liveProjects.length === 0
                ? '暂无已上线项目'
                : normalizedQuery
                  ? '没有匹配的项目'
                  : '所有已上线项目都已加入精选'}
            </p>
          ) : (
            <ul className="max-h-[640px] divide-y divide-border overflow-y-auto">
              {available.map((project) => (
                <li key={project.id} className="flex items-center gap-3 px-4 py-3">
                  <Cover project={project} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-primary">
                        {projectIdLabel(project.id)}
                      </span>
                      <StatusBadge status={project.status} />
                    </div>
                    <p className="mt-1 truncate text-sm font-bold">{project.name}</p>
                    {project.tagline ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {project.tagline}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => add(project.id)}
                    className="btn-hard btn-secondary shrink-0 px-3 py-2 text-[10px]"
                  >
                    + 加入
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
