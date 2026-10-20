import { ProjectStatus } from '@shenicest/shared'

export const FOUNDER_STATUS_LABELS: Record<number, string> = {
  [ProjectStatus.Draft]: '草稿',
  [ProjectStatus.PendingReview]: '审核中',
  [ProjectStatus.RevisionRequired]: '需修改',
  [ProjectStatus.Live]: '已上线',
  [ProjectStatus.Delisted]: '已下架',
  [ProjectStatus.Rejected]: '已驳回',
}

// 状态配色不在这里：颜色属于主题层，由组件用 ChipTone 决定
// （success / warning / danger / neutral），这样换肤时自动跟随。
// 见 docs/boomland-ui-system.md。

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
