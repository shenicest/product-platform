import { CATEGORIES, ProjectStage, ProjectStatus } from '@shenicest/shared'

export const OPERATOR_STATUS_LABELS: Record<number, string> = {
  [ProjectStatus.Draft]: '草稿',
  [ProjectStatus.PendingReview]: '待审核',
  [ProjectStatus.RevisionRequired]: '需修改',
  [ProjectStatus.Live]: '已上线',
  [ProjectStatus.Delisted]: '已下架',
  [ProjectStatus.Rejected]: '已驳回',
}

export const OPERATOR_STATUS_COLORS: Record<number, string> = {
  [ProjectStatus.Draft]: 'bg-muted text-muted-foreground',
  [ProjectStatus.PendingReview]: 'bg-primary/10 text-primary',
  [ProjectStatus.RevisionRequired]: 'bg-amber-500/10 text-amber-600',
  [ProjectStatus.Live]: 'bg-emerald-500/10 text-emerald-600',
  [ProjectStatus.Delisted]: 'bg-rose-500/10 text-rose-600',
  [ProjectStatus.Rejected]: 'bg-slate-500/10 text-slate-500',
}

export const PROPOSAL_STATUS_LABELS: Record<number, string> = {
  0: '待审核',
  1: '已通过',
  2: '已驳回',
  3: '需修改',
}

export const PROPOSAL_STATUS_COLORS: Record<number, string> = {
  0: 'bg-primary/10 text-primary',
  1: 'bg-emerald-500/10 text-emerald-600',
  2: 'bg-slate-500/10 text-slate-500',
  3: 'bg-amber-500/10 text-amber-600',
}

export const STAGE_LABELS: Record<number, string> = {
  [ProjectStage.MVP]: 'MVP',
  [ProjectStage.Growth]: '成长',
}

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  approve: '通过',
  reject: '驳回',
  require_revision: '要求修改',
  delist: '下架',
  restore: '恢复上架',
  approve_proposal: '通过提案',
  reject_proposal: '驳回提案',
  require_proposal_revision: '要求修改提案',
}

export const OPERATOR_PAGE_SIZE = 20

export const SORT_OPTIONS = [
  { value: 'created_at', label: '创建时间' },
  { value: 'updated_at', label: '更新时间' },
] as const

export interface OperatorProjectFilters {
  status?: number
  stage?: number
  category?: string
  q?: string
  sort?: 'created_at' | 'updated_at'
  order?: 'asc' | 'desc'
}

export interface OperatorProjectListParams extends OperatorProjectFilters {
  page: number
}

export interface OperatorProposalFilters {
  stage?: number
  category?: string
}

export interface OperatorProposalListParams extends OperatorProposalFilters {
  page: number
}

export interface AuditRecordListParams {
  projectId?: number
  from?: string
  to?: string
  page: number
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseOperatorProjectParams(
  searchParams: Record<string, string | string[] | undefined>
): OperatorProjectListParams {
  const params: OperatorProjectListParams = { page: 1 }

  const status = first(searchParams.status)
  if (status !== undefined && status !== '') {
    const n = Number(status)
    if (Number.isInteger(n) && n in OPERATOR_STATUS_LABELS) {
      params.status = n
    }
  }

  const stage = first(searchParams.stage)
  if (stage !== undefined && stage !== '') {
    const n = Number(stage)
    if (n === ProjectStage.MVP || n === ProjectStage.Growth) {
      params.stage = n
    }
  }

  const category = first(searchParams.category)
  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    params.category = category
  }

  const q = first(searchParams.q)?.trim()
  if (q) params.q = q

  const sort = first(searchParams.sort)
  if (sort === 'created_at' || sort === 'updated_at') {
    params.sort = sort
  }

  const order = first(searchParams.order)
  if (order === 'asc' || order === 'desc') {
    params.order = order
  }

  const page = Number(first(searchParams.page))
  if (Number.isInteger(page) && page > 0) params.page = page

  return params
}

export function parseOperatorProposalParams(
  searchParams: Record<string, string | string[] | undefined>
): OperatorProposalListParams {
  const params: OperatorProposalListParams = { page: 1 }

  const stage = first(searchParams.stage)
  if (stage !== undefined && stage !== '') {
    const n = Number(stage)
    if (n === ProjectStage.MVP || n === ProjectStage.Growth) {
      params.stage = n
    }
  }

  const category = first(searchParams.category)
  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    params.category = category
  }

  const page = Number(first(searchParams.page))
  if (Number.isInteger(page) && page > 0) params.page = page

  return params
}

export function parseAuditRecordParams(
  searchParams: Record<string, string | string[] | undefined>
): AuditRecordListParams {
  const params: AuditRecordListParams = { page: 1 }

  const projectId = first(searchParams.projectId)
  if (projectId !== undefined && projectId !== '') {
    const n = Number(projectId)
    if (Number.isInteger(n) && n > 0) params.projectId = n
  }

  const from = first(searchParams.from)?.trim()
  if (from) params.from = from

  const to = first(searchParams.to)?.trim()
  if (to) params.to = to

  const page = Number(first(searchParams.page))
  if (Number.isInteger(page) && page > 0) params.page = page

  return params
}

export function hasActiveOperatorProjectFilters(filters: OperatorProjectFilters): boolean {
  return Boolean(
    filters.status !== undefined ||
    filters.stage !== undefined ||
    filters.category ||
    filters.q
  )
}
