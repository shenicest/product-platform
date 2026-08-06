import { ProjectStatus } from '@shenicest/shared'

export const FOUNDER_STATUS_LABELS: Record<number, string> = {
  [ProjectStatus.Draft]: '草稿',
  [ProjectStatus.PendingReview]: '审核中',
  [ProjectStatus.RevisionRequired]: '需修改',
  [ProjectStatus.Live]: '已上线',
  [ProjectStatus.Delisted]: '已下架',
  [ProjectStatus.Rejected]: '已驳回',
}

export const FOUNDER_STATUS_COLORS: Record<number, string> = {
  [ProjectStatus.Draft]: 'bg-muted text-muted-foreground',
  [ProjectStatus.PendingReview]: 'bg-primary/10 text-primary',
  [ProjectStatus.RevisionRequired]: 'bg-amber-500/10 text-amber-600',
  [ProjectStatus.Live]: 'bg-emerald-500/10 text-emerald-600',
  [ProjectStatus.Delisted]: 'bg-rose-500/10 text-rose-600',
  [ProjectStatus.Rejected]: 'bg-slate-500/10 text-slate-500',
}

export interface FounderFilters {
  status?: number
  q?: string
}

export interface FounderListParams extends FounderFilters {
  page: number
}

export const FOUNDER_PAGE_SIZE = 20

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseFounderParams(searchParams: Record<string, string | string[] | undefined>): FounderListParams {
  const params: FounderListParams = { page: 1 }

  const status = first(searchParams.status)
  if (status !== undefined && status !== '') {
    const n = Number(status)
    if (Number.isInteger(n) && n in FOUNDER_STATUS_LABELS) {
      params.status = n
    }
  }

  const q = first(searchParams.q)?.trim()
  if (q) params.q = q

  const page = Number(first(searchParams.page))
  if (Number.isInteger(page) && page > 0) params.page = page

  return params
}

export function hasActiveFounderFilters(filters: FounderFilters): boolean {
  return Boolean(filters.status !== undefined || filters.q)
}
