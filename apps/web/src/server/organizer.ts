import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'
import type {
  AdminSeasonListItem,
  ManagedSeason,
  OrganizerOrg,
  SeasonListPage,
  SeasonManageDetail,
  SeasonReadiness,
} from '@/lib/organizer'

/**
 * 主办方后台的 Server 端数据层。
 *
 * 约定与 `server/boomland.ts` 一致：`cache()` 去重、只做读请求（写操作走
 * `lib/organizer-api.ts`）、cookie 手动转发给 Eden treaty。
 *
 * 错误分两种处理方式：
 *   · 列表类（选择器、组织下拉）：降级成空列表，页面其余部分照常渲染；
 *   · 详情类（某个赛季的完整字段）：把 `status` 抛给页面，由页面决定
 *     是 403 卡片还是 404。
 */

export class OrganizerApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function authHeaders() {
  const token = (await cookies()).get('shenicest_token')?.value
  return token ? { cookie: `shenicest_token=${token}` } : undefined
}

function statusOf(error: unknown): number {
  const status = (error as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : 500
}

/**
 * 主办方后台可见的赛季。
 *
 * - 平台管理员（Operator）：走 `/admin/seasons/all`，能看见、也能选中平台上的
 *   每一个赛季 —— 管理员本来就有权管理任意赛季，只列自己的组织会漏项；
 * - 普通主办方：走 `/organizer/seasons`，后端已按组织成员关系过滤。
 *
 * 只取一页上限内的数据：赛季选择器是下拉框，不是分页表格。
 */
export const getManagedSeasons = cache(async (pageSize = 100): Promise<SeasonListPage<ManagedSeason | AdminSeasonListItem>> => {
  const headers = await authHeaders()
  if (!headers) return { items: [], total: 0, page: 1, pageSize }

  const admin = await api.admin.seasons.all.get({ query: { pageSize }, headers })
  if (!admin.error && admin.data) {
    return admin.data as SeasonListPage<AdminSeasonListItem>
  }

  const { data, error } = await api.organizer.seasons.get({ query: { pageSize }, headers })
  if (error || !data) {
    throw new OrganizerApiError('Failed to load seasons', statusOf(error))
  }
  return data as SeasonListPage<ManagedSeason>
})

/**
 * 可用的主办方组织。
 *
 * `GET /organizer-orgs` 对所有登录用户开放，返回每一行带 `isMember`。
 * 管理员可以给任意组织建赛季，普通主办方只能选自己是成员的组织。
 */
export const getOrganizerOrgOptions = cache(
  async (options: { isOperator: boolean }): Promise<OrganizerOrg[]> => {
    const headers = await authHeaders()
    if (!headers) return []
    const { data, error } = await api['organizer-orgs'].get({ headers })
    if (error || !data) return []
    const items = (data as { items: OrganizerOrg[] }).items ?? []
    return options.isOperator ? items : items.filter((org) => org.isMember)
  },
)

/** 某个赛季的完整管理视图；403 / 404 由调用方转成页面态。 */
export const getSeasonManageDetail = cache(
  async (seasonId: number): Promise<SeasonManageDetail> => {
    const { data, error } = await api.seasons({ id: seasonId }).manage.get({ headers: await authHeaders() })
    if (error || !data) {
      throw new OrganizerApiError('Failed to load season', statusOf(error))
    }
    return data as SeasonManageDetail
  },
)

/** 发布就绪度九项；“复制上季”后用来提示还缺什么。 */
export const getSeasonReadiness = cache(
  async (seasonId: number): Promise<SeasonReadiness | null> => {
    const { data, error } = await api.seasons({ id: seasonId }).readiness.get({ headers: await authHeaders() })
    if (error || !data) return null
    return data as SeasonReadiness
  },
)
