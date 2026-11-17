import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'
import type { SeasonAnnouncement, SeasonChallenge } from '@/lib/boomland'
import type { OrganizerOrg, SeasonReadiness } from '@/lib/organizer'
import {
  seasonsOfOrg,
  type PlatformOrgCard,
  type PlatformOrgMember,
  type PlatformSeasonPreview,
  type PlatformSeasonRow,
} from '@/lib/platform-console'
import {
  getSeasonChallengesForOrganizer,
  getSeasonManageDetail,
  getSeasonReadiness,
} from '@/server/organizer'
import { getSeasonAnnouncements } from '@/server/boomland'

/**
 * 平台后台（`/operator/boomland`）的 Server 端数据层。
 *
 * 约定与 `server/organizer.ts` 一致：`cache()` 去重、只做读请求（写操作走
 * `lib/platform-console-api.ts`）、cookie 手动转发给 Eden treaty。
 *
 * 为什么不复用 `getManagedSeasons`？
 * 那边是「赛季选择器」的取数口径：管理员走 `/admin/seasons/all`（不含发布门槛，
 * 100 行也不会打几百次往返）。平台后台的治理表必须看到每一项门槛的通过数，
 * 所以走 `/admin/seasons`（= `listManage`，逐行算 readiness）。两者的性能取舍
 * 正好相反，混用一个函数只会让其中一边吃亏。
 *
 * 读失败一律降级成「空列表 + failed 标记」：平台后台的列表页是导航的第一屏，
 * 把一次列表读取失败升级成整页错误卡片，用户就看不到任何其它入口了。
 */

/** 列表读失败时仍然返回结构，页面据此显示「读取失败」而不是「没有数据」。 */
export type PlatformListResult<T> = {
  items: T[]
  failed: boolean
}

async function authHeaders() {
  const token = (await cookies()).get('shenicest_token')?.value
  return token ? { cookie: `shenicest_token=${token}` } : undefined
}

/**
 * 平台后台能看到的赛季。
 *
 * - 平台管理员：`GET /admin/seasons`，全平台赛季；
 * - 主办方组织成员：`GET /organizer/seasons`，后端按组织成员关系过滤 ——
 *   「成员只能管被指定的赛季」这条不变量由后端执行，前端不另做过滤，
 *   否则两份规则迟早会漂移。
 */
export const getPlatformSeasons = cache(
  async (isOperator: boolean): Promise<PlatformListResult<PlatformSeasonRow>> => {
    const headers = await authHeaders()
    if (!headers) return { items: [], failed: false }

    const query = { pageSize: 100 }
    const result = isOperator
      ? await api.admin.seasons.get({ query, headers })
      : await api.organizer.seasons.get({ query, headers })

    if (result.error || !result.data) return { items: [], failed: true }
    // 两个接口的行形状相同（都是 `SeasonSummary + 计数`），但 Eden 对三元表达式
    // 推出的联合类型不会自动收窄到 `.items` —— 显式断言成同一页类型。
    const page = result.data as unknown as { items?: PlatformSeasonRow[] }
    return { items: page.items ?? [], failed: false }
  },
)

/**
 * 主办方组织卡片：组织 + 成员 + 该组织主办的赛季。
 *
 * 成员逐个组织取（`GET /organizer-orgs/:id/members`）而不是新加一个批量接口：
 * 组织数量是个位数，而成员列表本来就只对「管理员 / 本组织成员」开放 ——
 * 批量接口会把两套权限压成一次调用，反而更容易漏判。
 *
 * 主办方成员只看自己所属的组织；管理员看全部。
 */
export const getPlatformOrgCards = cache(
  async (isOperator: boolean): Promise<PlatformListResult<PlatformOrgCard>> => {
    const headers = await authHeaders()
    if (!headers) return { items: [], failed: false }

    const { data, error } = await api['organizer-orgs'].get({ headers })
    if (error || !data) return { items: [], failed: true }

    const orgs = ((data as { items: OrganizerOrg[] }).items ?? [])
      .filter((org) => isOperator || org.isMember)
    const seasons = (await getPlatformSeasons(isOperator)).items

    const items = await Promise.all(orgs.map(async (org) => {
      const membersRes = await api['organizer-orgs']({ id: org.id }).members.get({ headers })
      const members = membersRes.error || !membersRes.data
        ? []
        : ((membersRes.data as { items: PlatformOrgMember[] }).items ?? [])
      return {
        org,
        members,
        seasons: seasonsOfOrg(org.id, seasons),
        canManageMembers: isOperator,
      }
    }))

    return { items, failed: false }
  },
)

export type PlatformSeasonPreviewData = {
  season: PlatformSeasonPreview
  readiness: SeasonReadiness | null
  challenges: SeasonChallenge[]
  announcements: SeasonAnnouncement[]
}

/**
 * 预览页的数据：管理视图 + 就绪度 + 命题 + 公告。
 *
 * 赛季本身**不降级**：预览的全部内容就是这份数据，读不到（403 / 404）时
 * 页面必须给出明确结论，而不是渲染一个空赛季壳。
 */
export const getPlatformSeasonPreview = cache(
  async (seasonId: number): Promise<PlatformSeasonPreviewData> => {
    const season = (await getSeasonManageDetail(seasonId)) as PlatformSeasonPreview
    const [readiness, challenges, announcements] = await Promise.all([
      getSeasonReadiness(seasonId),
      getSeasonChallengesForOrganizer(seasonId).catch(() => []),
      getSeasonAnnouncements(seasonId).catch(() => []),
    ])
    return { season, readiness, challenges, announcements }
  },
)
