'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CATEGORIES, ProjectStatus } from '@shenicest/shared'
import { projectIdLabel } from '@/lib/utils'
import { ProjectBadges } from '@/components/project-badges'
import { Pagination } from '@/components/pagination'
import { Chip, ChipButton, type ChipTone } from '@/components/ui/chip'
import { Button } from '@/components/ui/button'
import { Card, EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import type { OperatorProject } from '@/server/operator'
import {
  OPERATOR_PAGE_SIZE,
  OPERATOR_STATUS_LABELS,
  STAGE_LABELS,
  SORT_OPTIONS,
  hasActiveOperatorProjectFilters,
  type OperatorProjectListParams,
} from '@/lib/operator-filters'

/** 运营侧状态 → 标签色调（只映射语义，不写颜色）。 */
const STATUS_TONES: Record<number, ChipTone> = {
  [ProjectStatus.PendingReview]: 'warning',
  [ProjectStatus.RevisionRequired]: 'warning',
  [ProjectStatus.Live]: 'success',
  [ProjectStatus.Delisted]: 'danger',
  [ProjectStatus.Rejected]: 'neutral',
}

function StatusBadge({ status }: { status: number }) {
  return (
    <Chip tone={STATUS_TONES[status] ?? 'neutral'} dot>
      {OPERATOR_STATUS_LABELS[status] ?? '未知'}
    </Chip>
  )
}

function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <ChipButton tone={active ? 'accent' : 'neutral'} aria-pressed={active} onClick={onClick}>
      {children}
    </ChipButton>
  )
}

function ProjectRow({ project }: { project: OperatorProject }) {
  return (
    <Card className="group">
      <Link
        href={`/operator/projects/${project.id}`}
        className="flex flex-col gap-3 p-4 outline-none sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="card-cover card-cover--tall w-full shrink-0 sm:size-20">
          {project.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.coverUrl} alt={project.name} loading="lazy" />
          ) : (
            <div className="card-cover--placeholder">NO COVER</div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="card-id">{projectIdLabel(project.id)}</span>
            <StatusBadge status={project.status} />
          </div>
          <h3 className="card-title transition-colors group-hover:text-brand-text">
            {project.name}
          </h3>
          {project.tagline ? (
            <p className="card-text line-clamp-1">{project.tagline}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
          <ProjectBadges stage={project.stage} categories={project.categories} />
          <span className="mono">{new Date(project.createdAt).toLocaleDateString('zh-CN')}</span>
        </div>
      </Link>
    </Card>
  )
}

export function OperatorProjectsClient({
  initialProjects,
  total,
  params,
}: {
  initialProjects: OperatorProject[]
  total: number
  params: OperatorProjectListParams
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const { status, stage, category, q, sort, order } = params
  const page = params.page
  const totalPages = Math.max(1, Math.ceil(total / OPERATOR_PAGE_SIZE))

  function navigate(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')
    mutate(next)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>ALL PROJECTS</Eyebrow>
          <h2 className="mt-2 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold">
            项目管理
          </h2>
          <p className="mono mt-1">共 {total} 个项目</p>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault()
            const value = new FormData(event.currentTarget).get('q')
            navigate((params) => {
              const next = typeof value === 'string' ? value.trim() : ''
              if (next) params.set('q', next)
              else params.delete('q')
            })
          }}
        >
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="搜索项目名称或创始人"
            className="ui-input flex-1"
          />
          <Button type="submit">搜索</Button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mono">STATUS:</span>
          <FilterChip
            active={status === undefined}
            onClick={() =>
              navigate((params) => {
                params.delete('status')
              })
            }
          >
            全部
          </FilterChip>
          {Object.entries(OPERATOR_STATUS_LABELS).map(([value, label]) => (
            <FilterChip
              key={value}
              active={status === Number(value)}
              onClick={() =>
                navigate((params) => {
                  if (status === Number(value)) params.delete('status')
                  else params.set('status', value)
                })
              }
            >
              {label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mono">STAGE:</span>
          <FilterChip
            active={stage === undefined}
            onClick={() =>
              navigate((params) => {
                params.delete('stage')
              })
            }
          >
            全部
          </FilterChip>
          {Object.entries(STAGE_LABELS).map(([value, label]) => (
            <FilterChip
              key={value}
              active={stage === Number(value)}
              onClick={() =>
                navigate((params) => {
                  if (stage === Number(value)) params.delete('stage')
                  else params.set('stage', value)
                })
              }
            >
              {label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mono">CATEGORY:</span>
          <FilterChip
            active={category === undefined}
            onClick={() =>
              navigate((params) => {
                params.delete('category')
              })
            }
          >
            全部
          </FilterChip>
          {CATEGORIES.map((cat) => (
            <FilterChip
              key={cat}
              active={category === cat}
              onClick={() =>
                navigate((params) => {
                  if (category === cat) params.delete('category')
                  else params.set('category', cat)
                })
              }
            >
              {cat}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="mono">SORT:</span>
          {SORT_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              active={(sort ?? 'created_at') === opt.value}
              onClick={() =>
                navigate((params) => {
                  params.set('sort', opt.value)
                })
              }
            >
              {opt.label}
            </FilterChip>
          ))}
          <span className="mono mx-1">|</span>
          <FilterChip
            active={(order ?? 'desc') === 'desc'}
            onClick={() =>
              navigate((params) => {
                params.set('order', 'desc')
              })
            }
          >
            降序
          </FilterChip>
          <FilterChip
            active={order === 'asc'}
            onClick={() =>
              navigate((params) => {
                params.set('order', 'asc')
              })
            }
          >
            升序
          </FilterChip>
        </div>
      </div>

      {initialProjects.length === 0 ? (
        <EmptyState
          title="NO PROJECTS"
          description={
            hasActiveOperatorProjectFilters({ status, stage, category, q })
              ? '没有符合筛选条件的项目'
              : '暂无项目'
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {initialProjects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            searchParams={Object.fromEntries(searchParams.entries())}
            basePath="/operator/projects"
          />
        </>
      )}
    </div>
  )
}
