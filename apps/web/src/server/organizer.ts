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
import type {
  ChallengeDto,
  EnterpriseCooperationDto,
} from '@/lib/organizer-challenges'
import type { SeasonParticipantsPage } from '@/lib/organizer-manual-group'
import type {
  ApplicationAuditEntry,
  ApplicationDetail,
  ApplicationListPage,
  ApplicationListQuery,
} from '@/lib/organizer-applications'

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

/**
 * 某个赛季的选手名单（人工拉群页）。
 *
 * 与 `getSeasonReadiness` 不同，这里**不降级**：拉群页的全部内容就是这份名单，
 * 读不到就没有可展示的东西，必须让页面显示错误卡片而不是一个空表 —— 空表会被
 * 误读成「这一季还没有选手」。
 */
export const getSeasonParticipants = cache(
  async (
    seasonId: number,
    query: {
      status?: 'active' | 'withdrawn'
      wechatStatus?: 'not_invited' | 'invited' | 'joined' | 'failed'
      q?: string
      page?: number
      pageSize?: number
    } = {},
  ): Promise<SeasonParticipantsPage> => {
    const { data, error } = await api
      .seasons({ id: seasonId })
      .participants.get({ query, headers: await authHeaders() })
    if (error || !data) {
      throw new OrganizerApiError('Failed to load participants', statusOf(error))
    }
    return data as SeasonParticipantsPage
  },
)

/**
 * 报名审核队列（`GET /seasons/:id/applications`）。
 *
 * 列表只带**掩码**联系方式，完整联系方式要再点详情取 —— 这条分界在后端，
 * 前端不另做过滤：列表页的 DOM 里从来就没有明文联系方式。
 */
export const getSeasonApplications = cache(
  async (seasonId: number, query: ApplicationListQuery = {}): Promise<ApplicationListPage> => {
    const { data, error } = await api.seasons({ id: seasonId }).applications.get({
      query,
      headers: await authHeaders(),
    })
    if (error || !data) {
      throw new OrganizerApiError('Failed to load season applications', statusOf(error))
    }
    return data as ApplicationListPage
  },
)

/**
 * 单条报名详情（`GET /applications/:id`）。
 *
 * 返回解密后的联系方式与报名者公开资料；403 说明这条报名不属于当前账号
 * 能管的赛季，404 说明已被删除 —— 两种都让调用方转成 null，页面按
 * 「读不到这条报名」处理，不泄漏其它赛季的存在性。
 */
export const getApplicationDetail = cache(
  async (applicationId: number): Promise<ApplicationDetail | null> => {
    const { data, error } = await api.applications({ id: applicationId }).get({
      headers: await authHeaders(),
    })
    if (error || !data) return null
    return data as ApplicationDetail
  },
)

// ---------------------------------------------------------------------------
// 命题与资源
// ---------------------------------------------------------------------------

/**
 * 命题库（`GET /seasons/:id/challenges?includeDrafts=true`）。
 *
 * `includeDrafts=true` 是主办方后台的前提：草稿也要出现在表格里，否则
 * 「新建命题草稿」建完就看不见了。后端对该参数会额外校验赛季管理权限，
 * 403 由页面转成无权限卡片。
 */
export const getSeasonChallengesForOrganizer = cache(
  async (seasonId: number): Promise<ChallengeDto[]> => {
    const { data, error } = await api.seasons({ id: seasonId }).challenges.get({
      query: { includeDrafts: 'true' },
      headers: await authHeaders(),
    })
    if (error || !data) {
      throw new OrganizerApiError('Failed to load season challenges', statusOf(error))
    }
    return (data as { items: ChallengeDto[] }).items ?? []
  },
)

/**
 * 企业合作配置（`GET /seasons/:id/cooperations`）。
 *
 * 读失败降级成空数组：这一块是表格里的一节，读不到就给空态，
 * 不该让整页变成错误卡片（命题表格仍然可用）。
 */
export const getSeasonCooperations = cache(
  async (seasonId: number): Promise<EnterpriseCooperationDto[]> => {
    const { data, error } = await api.seasons({ id: seasonId }).cooperations.get({
      headers: await authHeaders(),
    })
    if (error || !data) return []
    return (data as { items: EnterpriseCooperationDto[] }).items ?? []
  },
)

/**
 * 某条报名的审核历史。
 *
 * 后端没有「按报名取审计」的专用接口，但审计表支持 `targetType + targetId`
 * 过滤，正好是报名审核写入时的口径（`season_application` / 报名 id）。
 * 读失败降级成空数组：历史是附属信息，不该让详情打不开。
 */
export const getApplicationAuditTrail = cache(
  async (seasonId: number, applicationId: number): Promise<ApplicationAuditEntry[]> => {
    const { data, error } = await api.seasons({ id: seasonId })['audit-logs'].get({
      query: {
        targetType: 'season_application',
        targetId: String(applicationId),
        pageSize: 50,
      },
      headers: await authHeaders(),
    })
    if (error || !data) return []
    return (data as { items: ApplicationAuditEntry[] }).items
  },
)
