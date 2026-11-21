import { Role, SeasonStatus } from '@shenicest/shared'
import type { SeasonSummary } from './boomland'

/**
 * 临时演示开关。
 *
 * ★ 演示结束后把这里改回 `false` 即可恢复真实登录；这是唯一开关。
 * 不要在其它地方再判断 NODE_ENV / Vercel 环境，否则会漏掉某个守卫。
 *
 * 单测里 `NODE_ENV === 'test'` 时保持关闭，这样 server/auth、user-menu 等
 * 既有用例仍然验证真实登录逻辑；开发与生产构建都会开启演示模式。
 *
 * 开启后：
 *   · `/api/me` 返回下面的演示身份，不再依赖真实 cookie；
 *   · 服务端页面守卫读取 `demo_identity` cookie，绕过真实登录；
 *   · 右下角出现演示身份切换器；
 *   · 赛季页面继续使用 `season-demo-store` 的本地测试数据。
 *
 * 这不是生产登录方案：不要长期开启，也不要在真实用户使用的域名上开启。
 */
export const DEMO_MODE = process.env.NODE_ENV !== 'test'

export const DEMO_COOKIE = 'demo_identity'

export type DemoIdentityKey =
  | 'participant'
  | 'judge'
  | 'enterprise'
  | 'organizer'
  | 'guest'

export type DemoIdentity = {
  key: DemoIdentityKey
  label: string
  description: string
  userId: string
  email: string
  nickname: string
  avatarUrl: string | null
  roles: Role[]
  isOrganizerMember: boolean
}

/**
 * 演示身份与 seed 数据对齐：
 *   101 张一：AI4BBS 选手 + BoomLand 组委会
 *   108 评审甲：评委
 *   102 李二：企业合作方（同时是曜石储能主办方成员）
 *   9006 组委会：只有主办方身份，用来演示主办方后台
 *   9001 普通用户：没有赛季角色，用来看权限拦截
 */
export const DEMO_IDENTITIES: readonly DemoIdentity[] = [
  {
    key: 'participant',
    label: '张一 · 赛季选手 / 主办方',
    description: '参赛台、作品、里程碑、主办方后台',
    userId: '101',
    email: 'zhang.yi@example.com',
    nickname: '张一',
    avatarUrl: 'https://picsum.photos/seed/zhang-yi/200/200',
    roles: [Role.Founder],
    isOrganizerMember: true,
  },
  {
    key: 'judge',
    label: '评审甲 · 评委',
    description: '评委台、评分与大额复核',
    userId: '108',
    email: 'scorer.jia@example.com',
    nickname: '评审甲',
    avatarUrl: 'https://picsum.photos/seed/scorer-jia/200/200',
    roles: [Role.Founder],
    isOrganizerMember: false,
  },
  {
    key: 'enterprise',
    label: '李二 · 企业合作方',
    description: '曜石储能企业命题台、命题草稿与验收',
    userId: '102',
    email: 'li.er@example.com',
    nickname: '李二',
    avatarUrl: 'https://picsum.photos/seed/li-er/200/200',
    roles: [Role.Founder],
    isOrganizerMember: true,
  },
  {
    key: 'organizer',
    label: '组委会 · 主办方',
    description: '只有主办方身份，演示后台与项目评审',
    userId: '9006',
    email: 'organizer@demo.local',
    nickname: '组委会小王',
    avatarUrl: 'https://picsum.photos/seed/demo-organizer/200/200',
    roles: [],
    isOrganizerMember: true,
  },
  {
    key: 'guest',
    label: '普通用户',
    description: '没有赛季角色，用来看权限拦截',
    userId: '9001',
    email: 'guest@demo.local',
    nickname: '路人甲',
    avatarUrl: 'https://picsum.photos/seed/demo-guest/200/200',
    roles: [],
    isOrganizerMember: false,
  },
]

export function resolveDemoIdentity(value: string | null | undefined): DemoIdentity {
  return DEMO_IDENTITIES.find((identity) => identity.key === value) ?? DEMO_IDENTITIES[0]
}

/** `/api/me` 的演示用户形状，与 `AuthUser` 对齐。 */
export function demoAuthUser(identity: DemoIdentity) {
  const isOperator = identity.roles.includes(Role.Operator)
  const isFounder = identity.roles.includes(Role.Founder)
  return {
    user_id: Number(identity.userId),
    email: identity.email,
    role: isOperator ? 'operator' : isFounder ? 'founder' : 'user',
    roles: identity.roles,
    nickname: identity.nickname,
    avatarUrl: identity.avatarUrl,
    isOrganizerMember: identity.isOrganizerMember,
  }
}

/**
 * 主办方后台提示用户选中的赛季。只有 AI4BBS 有完整的测试数据；
 * 选择器里另外两季只用于展示赛季切换的形态，切过去后新页面会回到 AI4BBS。
 */
export const DEMO_SEASON: SeasonSummary = {
  id: 1,
  code: 'AI4BBS',
  name: 'AI4BBS 产业商业赛季',
  type: 'season',
  city: null,
  status: SeasonStatus.Active,
  themes: ['新型储能基建', '全球 AI 基建', '新生产关系的人本基建'],
  schedule: null,
  organizerOrgs: [{ id: 1, name: 'BoomLand 组委会' }],
  pinned: true,
  approvedAt: '2026-11-01T00:00:00.000Z',
  participantCapacity: 50,
  participantCount: 1,
  publishedChallengeCount: 4,
}

export const DEMO_SEASONS: readonly SeasonSummary[] = [
  DEMO_SEASON,
  {
    ...DEMO_SEASON,
    id: 2,
    code: 'H03-SH',
    name: 'H03 上海站 · 黑客松',
    status: SeasonStatus.Active,
    pinned: false,
  },
  {
    ...DEMO_SEASON,
    id: 3,
    code: 'PROTO-S2',
    name: 'Proto Seeds 第二季',
    status: SeasonStatus.Upcoming,
    pinned: false,
  },
]

/** 个人中心页头的赛季标签（与 AI4BBS 选手身份对应）。 */
export const DEMO_SEASON_BADGES = [
  {
    id: DEMO_SEASON.id,
    code: DEMO_SEASON.code,
    name: DEMO_SEASON.name,
    status: DEMO_SEASON.status,
    participantStatus: 'active',
  },
] as const

export const DEMO_ORGANIZER_ORGS = [
  { id: 1, name: 'BoomLand 组委会', memberCount: 3, isMember: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 2, name: '曜石储能', memberCount: 2, isMember: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 3, name: '青禾物流', memberCount: 2, isMember: true, createdAt: '2026-01-01T00:00:00.000Z' },
] as const
