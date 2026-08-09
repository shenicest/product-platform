'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CATEGORIES } from '@shenicest/shared'
import { cn } from '@/lib/utils'
import { projectIdLabel } from '@/lib/utils'
import { ProjectBadges } from '@/components/project-badges'
import { Pagination } from '@/components/pagination'
import type { OperatorProject } from '@/server/operator'
import {
  OPERATOR_PAGE_SIZE,
  OPERATOR_STATUS_LABELS,
  OPERATOR_STATUS_COLORS,
  STAGE_LABELS,
  SORT_OPTIONS,
  hasActiveOperatorProjectFilters,
  type OperatorProjectListParams,
} from '@/lib/operator-filters'

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
        OPERATOR_STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'
      )}
    >
      {OPERATOR_STATUS_LABELS[status] ?? '未知'}
    </span>
  )
}

function ProjectRow({ project }: { project: OperatorProject }) {
  return (
    <Link
      href={`/operator/projects/${project.id}`}
      className="group flex flex-col gap-3 border border-border bg-card p-4 transition-[transform,box-shadow] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--secondary)] sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="aspect-[4/3] w-full shrink-0 overflow-hidden border border-border bg-muted sm:size-20">
        {project.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.coverUrl}
            alt={project.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[10px] text-muted-foreground">
            NO COVER
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.08em] text-primary">
            {projectIdLabel(project.id)}
          </span>
          <StatusBadge status={project.status} />
        </div>
        <h3 className="text-base font-bold leading-snug transition-colors group-hover:text-primary">
          {project.name}
        </h3>
        {project.tagline ? (
          <p className="line-clamp-1 text-sm text-muted-foreground">
            {project.tagline}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
        <ProjectBadges stage={project.stage} categories={project.categories} />
        <span className="font-mono text-[10px] text-muted-foreground">
          {new Date(project.createdAt).toLocaleDateString('zh-CN')}
        </span>
      </div>
    </Link>
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
    <div className="space-y-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">ALL PROJECTS</p>
          <h2 className="mt-2 text-[clamp(24px,3vw,32px)] font-bold leading-[1.15]">
            项目管理
          </h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            共 {total} 个项目
          </p>
        </div>
      </div>

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
            className="h-11 flex-1 border border-input bg-card px-3.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
          <button type="submit" className="btn-hard btn-primary px-6 py-3">
            搜索
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
            STATUS:
          </span>
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
          {Object.entries(OPERATOR_STATUS_LABELS).map(([value, label]) => (
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
            STAGE:
          </span>
          <Chip
            active={stage === undefined}
            onClick={() =>
              navigate((params) => {
                params.delete('stage')
              })
            }
          >
            全部
          </Chip>
          {Object.entries(STAGE_LABELS).map(([value, label]) => (
            <Chip
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
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
            CATEGORY:
          </span>
          <Chip
            active={category === undefined}
            onClick={() =>
              navigate((params) => {
                params.delete('category')
              })
            }
          >
            全部
          </Chip>
          {CATEGORIES.map((cat) => (
            <Chip
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
            </Chip>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
            SORT:
          </span>
          {SORT_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={(sort ?? 'created_at') === opt.value}
              onClick={() =>
                navigate((params) => {
                  params.set('sort', opt.value)
                })
              }
            >
              {opt.label}
            </Chip>
          ))}
          <span className="mx-1 font-mono text-[10px] text-muted-foreground">|</span>
          <Chip
            active={(order ?? 'desc') === 'desc'}
            onClick={() =>
              navigate((params) => {
                params.set('order', 'desc')
              })
            }
          >
            降序
          </Chip>
          <Chip
            active={order === 'asc'}
            onClick={() =>
              navigate((params) => {
                params.set('order', 'asc')
              })
            }
          >
            升序
          </Chip>
        </div>
      </div>

      {initialProjects.length === 0 ? (
        <div className="border border-dashed border-border py-24 text-center">
          <p className="font-mono text-xs tracking-[0.12em] text-primary">
            NO PROJECTS
          </p>
          <p className="mt-3 text-base text-muted-foreground">
            {hasActiveOperatorProjectFilters({ status, stage, category, q })
              ? '没有符合筛选条件的项目'
              : '暂无项目'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
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
