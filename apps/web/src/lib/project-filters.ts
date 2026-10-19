import { CATEGORIES, ProjectStage } from '@shenicest/shared'

export const PAGE_SIZE = 20

export const SORTS = ['latest', 'recently_updated'] as const
export type Sort = (typeof SORTS)[number]

export const SORT_LABELS: Record<Sort, string> = {
  latest: '最新',
  recently_updated: '最近更新',
}

export const STAGE_LABELS: Record<number, string> = {
  [ProjectStage.Idea]: '想法验证',
  [ProjectStage.Prototype]: '原型',
  [ProjectStage.Mvp]: 'MVP',
  [ProjectStage.Launched]: '已上线有用户',
  [ProjectStage.Revenue]: '有收入',
}

export type SearchParams = Record<string, string | string[] | undefined>

export interface ProjectFilters {
  category?: string
  stage?: ProjectStage
  q?: string
  sort?: Sort
}

export interface ListParams extends ProjectFilters {
  page: number
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parseListParams(searchParams: SearchParams): ListParams {
  const params: ListParams = { page: 1 }

  const category = first(searchParams.category)
  if (category && (CATEGORIES as readonly string[]).includes(category)) {
    params.category = category
  }

  const stageRaw = first(searchParams.stage)
  if (stageRaw !== undefined && stageRaw !== '') {
    const stage = Number(stageRaw)
    if ((Object.values(ProjectStage) as number[]).includes(stage)) {
      params.stage = stage as ProjectStage
    }
  }

  const q = first(searchParams.q)?.trim()
  if (q) params.q = q

  const sort = first(searchParams.sort)
  if (sort && (SORTS as readonly string[]).includes(sort)) {
    params.sort = sort as Sort
  }

  const page = Number(first(searchParams.page))
  if (Number.isInteger(page) && page > 0) params.page = page

  return params
}

export function hasActiveFilters(filters: ProjectFilters): boolean {
  return Boolean(filters.category || filters.stage !== undefined || filters.q)
}
