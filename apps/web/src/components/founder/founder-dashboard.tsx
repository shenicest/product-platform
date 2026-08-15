'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ProjectStatus } from '@shenicest/shared'
import { cn } from '@/lib/utils'
import { projectIdLabel } from '@/lib/utils'
import { ProjectBadges } from '@/components/project-badges'
import { Pagination } from '@/components/pagination'
import type { FounderProject } from '@/server/founder'
import {
  FOUNDER_PAGE_SIZE,
  FOUNDER_STATUS_COLORS,
  FOUNDER_STATUS_LABELS,
  hasActiveFounderFilters,
  type FounderListParams,
} from '@/lib/founder-filters'

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'chip-hard cursor-pointer transition-colors',
        active
          ? 'chip-active'
          : 'hover:border-primary/60 hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

function StatusBadge({ status }: { status: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 font-mono text-[10px] tracking-[0.08em]',
        FOUNDER_STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {FOUNDER_STATUS_LABELS[status] ?? '未知'}
    </span>
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
    <div className="group flex flex-col border border-border bg-card transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--secondary)]">
      <div className="aspect-[4/3] w-full overflow-hidden border-b border-border bg-muted">
        {project.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt={project.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-xs text-muted-foreground">
            NO COVER
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] tracking-[0.08em] text-primary">
            {projectIdLabel(project.id)}
          </span>
          <StatusBadge status={project.status} />
        </div>
        <h3 className="text-base font-bold leading-snug transition-colors group-hover:text-primary">
          {project.name}
        </h3>
        {project.tagline ? (
          <p className="line-clamp-2 text-sm leading-normal text-muted-foreground">
            {project.tagline}
          </p>
        ) : null}

        <ProjectBadges
          stage={project.stage}
          categories={project.categories}
          className="mt-auto pt-2"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isEditable ? (
            <Link
              href={`/projects/${project.id}/edit`}
              className="btn-hard btn-primary px-3 py-1.5 text-xs"
            >
              编辑
            </Link>
          ) : null}
          {isPending ? (
            <Link
              href={`/founder/projects/${project.id}`}
              className="btn-hard btn-secondary px-3 py-1.5 text-xs"
            >
              查看项目
            </Link>
          ) : null}
          {isLive ? (
            <Link
              href={`/projects/${project.id}`}
              className="btn-hard btn-secondary px-3 py-1.5 text-xs"
            >
              查看
            </Link>
          ) : null}
          {isLive ? (
            <Link
              href={`/founder/projects/${project.id}`}
              className="btn-hard btn-secondary px-3 py-1.5 text-xs"
            >
              管理
            </Link>
          ) : null}
          {isRejected ? (
            <span className="font-mono text-[10px] text-muted-foreground">
              已驳回，无法重新提交
            </span>
          ) : null}
        </div>
      </div>
    </div>
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
      <div className="border border-dashed border-border py-24 text-center">
        <p className="font-mono text-xs tracking-[0.12em] text-primary">ACCESS DENIED</p>
        <p className="mt-3 text-base text-muted-foreground">
          你还不是创始人。请先提交一个项目。
        </p>
        <Link href="/submit" className="btn-hard btn-primary mt-6 inline-block px-6 py-3">
          提交项目
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="border border-border bg-card p-5">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
            TOTAL PROJECTS
          </p>
          <p className="mt-2 font-digits text-[clamp(32px,5vw,48px)] leading-none text-primary">
            {stats.totalProjects}
          </p>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
            LIVE
          </p>
          <p className="mt-2 font-digits text-[clamp(32px,5vw,48px)] leading-none text-emerald-600">
            {stats.liveProjects}
          </p>
        </div>
        <div className="border border-border bg-card p-5">
          <p className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground">
            PENDING REVIEW
          </p>
          <p className="mt-2 font-digits text-[clamp(32px,5vw,48px)] leading-none text-amber-600">
            {stats.pendingReviewProjects}
          </p>
        </div>
      </section>

      <section>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">MY PROJECTS</p>
            <h2 className="mt-2 text-[clamp(24px,3vw,32px)] font-bold leading-[1.15]">
              我的项目
            </h2>
          </div>
          <Link href="/submit" className="btn-hard btn-primary px-5 py-2.5 text-sm">
            + 新建项目
          </Link>
        </div>

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
              className="h-11 flex-1 border border-input bg-card px-3.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
            />
            <button type="submit" className="btn-hard btn-primary px-6 py-3">
              搜索
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <Chip
              active={status === undefined}
              onClick={() =>
                navigate((params) => {
                  params.delete('status')
                })
              }
            >
              全部
            </Chip>
            {Object.entries(FOUNDER_STATUS_LABELS).map(([value, label]) => (
              <Chip
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
              </Chip>
            ))}
          </div>
        </div>

        {initialProjects.length === 0 ? (
          <div className="border border-dashed border-border py-24 text-center">
            <p className="font-mono text-xs tracking-[0.12em] text-primary">
              NO PROJECTS
            </p>
            <p className="mt-3 text-base text-muted-foreground">
              {hasActiveFounderFilters({ status, q })
                ? '没有符合筛选条件的项目'
                : '你还没有创建任何项目'}
            </p>
            {!hasActiveFounderFilters({ status, q }) ? (
              <Link
                href="/submit"
                className="btn-hard btn-primary mt-6 inline-block px-6 py-3"
              >
                提交第一个项目
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
