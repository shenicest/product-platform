import { cache } from 'react'
import { cookies } from 'next/headers'
import { SeasonApplicationStatus, SeasonStatus, type Role } from '@shenicest/shared'
import { api } from '@/lib/api'
import { getSessionUser } from '@/server/auth'
import type { MySeasonApplication, SeasonSummary } from '@/lib/boomland'

async function authHeaders() {
  const token = (await cookies()).get('shenicest_token')?.value
  return token ? { cookie: `shenicest_token=${token}` } : undefined
}

export type WorkbenchHeader = {
  userId: string
  email: string | null
  nickname: string | null
  avatarUrl: string | null
  roles: Role[]
  /** 进行中的参赛赛季：已通过报名、且赛季仍在进行 / 即将开始。 */
  activeSeasons: SeasonSummary[]
  applicationCount: number
  /** 已是选手、但还没有任何赛季项目 —— 组队 tab 的红点依据。 */
  needsTeam: boolean
}

/**
 * 个人中心页头需要的数据。
 *
 * 昵称与头像来自共享 users 表（`/founder/profile`），角色来自 `/identity/roles`，
 * 参赛赛季来自 `/me/applications` —— 与 `UserMenu` 用的是同一批接口，
 * 所以页头显示的昵称和右上角菜单里的账号不会出现两个版本。
 *
 * `cache()` 去重：layout 与页面都读它，同一次渲染只发一轮请求。
 */
export const getWorkbenchHeader = cache(async (): Promise<WorkbenchHeader | null> => {
  const session = await getSessionUser()
  if (!session) return null
  const headers = await authHeaders()
  if (!headers) return null

  const [profileResult, applicationsResult] = await Promise.all([
    api.founder.profile.get({ headers }).catch(() => null),
    api.me.applications
      .get({ query: { pageSize: 100 }, headers })
      .catch(() => null),
  ])

  const profile = profileResult && !profileResult.error ? profileResult.data : null
  const items: MySeasonApplication[] =
    applicationsResult && !applicationsResult.error
      ? ((applicationsResult.data as { items?: MySeasonApplication[] } | null)?.items ?? [])
      : []

  // 「进行中的参赛赛季」= 报名已通过 + 赛季还在 upcoming / active。
  // 用 `wechatStatus !== null` 而不是只看报名状态：选手行的存在才是「参赛」的
  // 真实凭据（报名被接受后才会创建选手行），撤回报名但仍是选手的边界情况
  // 也该算作参赛。
  const activeSeasons = items
    .filter((item) => item.wechatStatus !== null || item.application.status === SeasonApplicationStatus.Accepted)
    .map((item) => item.season)
    .filter(
      (season) =>
        season.status === SeasonStatus.Active || season.status === SeasonStatus.Upcoming,
    )

  return {
    userId: session.userId,
    email: session.email,
    nickname: profile?.nickname ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    roles: session.roles,
    activeSeasons,
    applicationCount: items.length,
    // 没有赛季项目接口的轻量判断：本批先用「是选手」近似。
    // 组队 tab 会用 `GET /seasons/:id/team/me` 拿到精确值再修正显示。
    needsTeam: activeSeasons.length > 0,
  }
})
