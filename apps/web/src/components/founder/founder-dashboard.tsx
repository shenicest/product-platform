'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ProjectStatus } from '@shenicest/shared'
import { projectIdLabel } from '@/lib/utils'
import { ProjectBadges } from '@/components/project-badges'
import { Pagination } from '@/components/pagination'
import { Button, ButtonLink } from '@/components/ui/button'
import { Chip, ChipButton, type ChipTone } from '@/components/ui/chip'
import { Card, EmptyState } from '@/components/ui/surface'
import { Eyebrow } from '@/components/ui/typography'
import type { FounderProject } from '@/server/founder'
import {
  FOUNDER_PAGE_SIZE,
  FOUNDER_STATUS_LABELS,
  hasActiveFounderFilters,
  type FounderListParams,
} from '@/lib/founder-filters'

/** 项目状态 → 标签色调（只映射语义，不写颜色）。 */
const STATUS_TONES: Record<number, ChipTone> = {
  [ProjectStatus.Draft]: 'neutral',
  [ProjectStatus.PendingReview]: 'warning',
  [ProjectStatus.RevisionRequired]: 'warning',
  [ProjectStatus.Live]: 'success',
  [ProjectStatus.Delisted]: 'danger',
  [ProjectStatus.Rejected]: 'neutral',
}

function StatusBadge({ status }: { status: number }) {
  return (
    <Chip tone={STATUS_TONES[status] ?? 'neutral'} dot>
      {FOUNDER_STATUS_LABELS[status] ?? '未知'}
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

function FounderProjectCard({ project }: { project: FounderProject }) {
  const isEditable =
    project.status === ProjectStatus.Draft ||
    project.status === ProjectStatus.RevisionRequired
  const isPending = project.status === ProjectStatus.PendingReview
  const isLive = project.status === ProjectStatus.Live
  const isRejected = project.status === ProjectStatus.Rejected

  return (
    <Card className="group">
      <div className="card-cover card-cover--tall border-b border-border">
        {project.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.coverUrl} alt={project.name} loading="lazy" />
        ) : (
          <span className="card-cover--placeholder">NO COVER</span>
        )}
      </div>

      <div className="card-body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="card-id">{projectIdLabel(project.id)}</span>
          <StatusBadge status={project.status} />
        </div>
        <h3 className="card-title transition-colors group-hover:text-brand-text">
          {project.name}
        </h3>
        {project.tagline ? <p className="card-text line-clamp-2">{project.tagline}</p> : null}

        <ProjectBadges
          stage={project.stage}
          categories={project.categories}
          className="mt-auto pt-2"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isEditable ? (
            <ButtonLink href={`/projects/${project.id}/edit`} size="sm">
              编辑
            </ButtonLink>
          ) : null}
          {isPending ? (
            <ButtonLink href={`/founder/projects/${project.id}`} variant="secondary" size="sm">
              查看项目
            </ButtonLink>
          ) : null}
          {isLive ? (
            <ButtonLink href={`/projects/${project.id}`} variant="secondary" size="sm">
              查看
            </ButtonLink>
          ) : null}
          {isLive ? (
            <ButtonLink href={`/founder/projects/${project.id}`} variant="secondary" size="sm">
              管理
            </ButtonLink>
          ) : null}
          {isRejected ? <span className="mono">已驳回，无法重新提交</span> : null}
        </div>
      </div>
    </Card>
  )
}

export function FounderDashboard({
  initialProjects,
  total,
  params,
  stats,
  isFounder,
}: {
  initialProjects: FounderProject[]
  total: number
  params: FounderListParams
  stats: { totalProjects: number; liveProjects: number; pendingReviewProjects: number }
  isFounder: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const status = params.status
  const q = params.q ?? ''
  const page = params.page
  const totalPages = Math.max(1, Math.ceil(total / FOUNDER_PAGE_SIZE))

  function navigate(mutate: (next: URLSearchParams) => void) {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('page')
    mutate(next)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  if (!isFounder) {
    return (
      <EmptyState
        title="ACCESS DENIED"
        description="你还不是创始人。请先提交一个项目。"
        action={<ButtonLink href="/submit">提交项目</ButtonLink>}
      />
    )
  }

  return (
    <div className="flex flex-col gap-10">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="ui-metric">
          <span className="ui-metric__label">TOTAL PROJECTS</span>
          <span className="ui-metric__value">{stats.totalProjects}</span>
          <p className="ui-metric__hint">全部项目</p>
        </div>
        <div className="ui-metric">
          <span className="ui-metric__label">LIVE</span>
          <span className="ui-metric__value text-success-text">{stats.liveProjects}</span>
          <p className="ui-metric__hint">已上线</p>
        </div>
        <div className="ui-metric">
          <span className="ui-metric__label">PENDING REVIEW</span>
          <span className="ui-metric__value text-warning-text">
            {stats.pendingReviewProjects}
          </span>
          <p className="ui-metric__hint">等待审核</p>
        </div>
      </section>

      <section>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>MY PROJECTS</Eyebrow>
            <h2 className="mt-2 text-[clamp(24px,3vw,32px)] leading-[1.15] font-bold">
              我的项目
            </h2>
          </div>
          <ButtonLink href="/submit">
            <span aria-hidden>＋</span> 新建项目
          </ButtonLink>
        </header>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <form
            className="flex flex-1 flex-col gap-3 sm:flex-row"
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
              defaultValue={q}
              placeholder="搜索项目名称或标语"
              className="ui-input flex-1"
            />
            <Button type="submit">搜索</Button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
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
            {Object.entries(FOUNDER_STATUS_LABELS).map(([value, label]) => (
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
        </div>

        {initialProjects.length === 0 ? (
          <EmptyState
            title="NO PROJECTS"
            description={
              hasActiveFounderFilters({ status, q })
                ? '没有符合筛选条件的项目'
                : '你还没有创建任何项目'
            }
            action={
              hasActiveFounderFilters({ status, q }) ? null : (
                <ButtonLink href="/submit">提交第一个项目</ButtonLink>
              )
            }
          />
        ) : (
          <>
            <div className="card-grid">
              {initialProjects.map((project) => (
                <FounderProjectCard key={project.id} project={project} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              searchParams={Object.fromEntries(searchParams.entries())}
              basePath="/founder/dashboard"
            />
          </>
        )}
      </section>
    </div>
  )
}
