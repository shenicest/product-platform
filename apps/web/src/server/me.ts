import { cache } from 'react'
import { cookies } from 'next/headers'
import { SeasonApplicationStatus, SeasonStatus, type Role, type SeasonParticipantStatus } from '@shenicest/shared'
import { api } from '@/lib/api'
import { getSessionUser } from '@/server/auth'
import type { MySeasonApplication, SeasonSummary } from '@/lib/boomland'
import {
  DEMO_COOKIE,
  DEMO_MODE,
  DEMO_SEASON,
  DEMO_SEASON_BADGES,
  resolveDemoIdentity,
} from '@/lib/demo-mode'

async function authHeaders() {
  const token = (await cookies()).get('shenicest_token')?.value
  return token ? { cookie: `shenicest_token=${token}` } : undefined
}

export type WorkbenchSeasonBadge = {
  id: number
  code: string
  name: string
  /** 赛季状态：active / upcoming / suspended / cancelled 等 */
  status: string
  /** 选手行状态：active / withdrawn；没有选手行时为 null。 */
  participantStatus: SeasonParticipantStatus | null
}

export type WorkbenchHeader = {
  userId: string
  email: string | null
  nickname: string | null
  avatarUrl: string | null
  roles: Role[]
  /** 进行中的参赛赛季：已通过报名、且赛季仍在进行 / 即将开始。 */
  activeSeasons: SeasonSummary[]
  /** 获得过的赛季标签：一个赛季一个，包含已结束与进行中的赛季。 */
  seasonBadges: WorkbenchSeasonBadge[]
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

  // 演示模式：不请求真实 `/me/applications`，直接返回与 seed 对齐的页头数据。
  // 只有「张一 / 赛季选手」这个身份有进行中的赛季和赛季标签；其他身份保留
  // 自己的昵称/角色，但参赛台会显示 NO ACTIVE SEASON。
  if (DEMO_MODE) {
    const identity = resolveDemoIdentity((await cookies()).get(DEMO_COOKIE)?.value)
    const isParticipant = identity.key === 'participant'
    return {
      userId: session.userId,
      email: session.email,
      nickname: identity.nickname,
      avatarUrl: identity.avatarUrl,
      roles: session.roles,
      activeSeasons: isParticipant ? [DEMO_SEASON] : [],
      seasonBadges: isParticipant ? [...DEMO_SEASON_BADGES] : [],
      applicationCount: 0, // 演示模式不渲染报名数据，避免 tab 红点指向空页
      needsTeam: false,
    }
  }

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
  const participated = items.filter(
    (item) =>
      item.participantStatus !== null ||
      item.wechatStatus !== null ||
      item.application.status === SeasonApplicationStatus.Accepted,
  )

  const activeSeasons = participated
    .map((item) => item.season)
    .filter(
      (season) =>
        season.status === SeasonStatus.Active || season.status === SeasonStatus.Upcoming,
    )

  // 标签口径与 activeSeasons 同一份「选手行/报名已通过」数据，但不去掉已结束
  // 的赛季：参加过的赛季会一直保留标签。一个赛季只保留一条。
  const badgeBySeason = new Map<number, WorkbenchSeasonBadge>()
  for (const item of participated) {
    if (badgeBySeason.has(item.season.id)) continue
    badgeBySeason.set(item.season.id, {
      id: item.season.id,
      code: item.season.code,
      name: item.season.name,
      status: item.season.status,
      participantStatus: item.participantStatus,
    })
  }
  const seasonBadges = [...badgeBySeason.values()].sort((a, b) => {
    const rank = (status: string) =>
      status === SeasonStatus.Active ? 0 : status === SeasonStatus.Upcoming ? 1 : 2
    return rank(a.status) - rank(b.status) || b.id - a.id
  })

  return {
    userId: session.userId,
    email: session.email,
    nickname: profile?.nickname ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    roles: session.roles,
    activeSeasons,
    seasonBadges,
    applicationCount: items.length,
    // 没有赛季项目接口的轻量判断：本批先用「是选手」近似。
    // 组队 tab 会用 `GET /seasons/:id/team/me` 拿到精确值再修正显示。
    needsTeam: activeSeasons.length > 0,
  }
})
