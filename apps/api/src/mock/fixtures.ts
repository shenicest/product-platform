import { Role } from '@shenicest/shared'
import { isMockAuthEnabled } from './config'

/**
 * ★ 本地 mock 用户清单 —— 这就是你要改的那个文件。
 *
 * 加一个用户 = 往数组里加一项，保存后 `bun --watch` 自动重载，
 * 刷新页面即可在右下角切换器里看到。不写库、不跑 seed。
 *
 * 字段说明
 * --------
 * - `key`         切换器的稳定标识，全局唯一；改动会让已选中的会话失效。
 * - `label`       切换器里显示的名字。
 * - `description` 一句话说明「这个用户用来调什么」。
 * - `userId`      平台侧用户 id（`user_identities.user_id`、`projects.user_id` 都是这个）。
 * - `email`       平台账号邮箱；`/me` 与顶部导航显示用。
 * - `roles`       平台角色：`Role.Founder` = 0、`Role.Operator` = 1。空数组 = 普通登录用户。
 * - `organizer`   是否属于主办方组织。true 时对所有主办方组织都算成员。
 * - `sharedProfile` 共享 users 表（外部认证系统持有）里的资料行；`null` = 该用户在共享表里没有行，
 *                  用来调「昵称/头像缺失」的降级展示。
 * - `overrides`   **这个用户是否覆盖数据库读出的角色/组织/资料。**
 *                  true（默认）：完全不查库，角色就是 `roles`、组织就是 `organizer`、资料就是
 *                  `sharedProfile` —— 所以加 mock 用户永远不用 seed。
 *                  false：走真实数据库。只有想复用 seed 数据时才这么写（见 `founder-demo`）。
 *
 * userId 号段约定
 * ---------------
 * 9000 起是 mock 专用号段，避开 seed 占用的 1 / 2 / 101-111，
 * 这样开着 mock 也不会把 seed 出来的角色和数据搅乱。
 * 唯一例外是 `founder-demo`：它故意复用 seed 的 founder id `1`。
 */
export interface MockUser {
  key: string
  label: string
  description: string
  userId: string
  email: string | null
  roles: Role[]
  organizer: boolean
  sharedProfile: { nickname: string; avatarUrl: string } | null
  overrides?: boolean
}

export const MOCK_USERS: readonly MockUser[] = [
  {
    key: 'guest',
    label: '普通用户',
    description: '已登录但没有任何平台角色：看不到运营/创始人后台，提交项目后才会有 Founder 角色。',
    userId: '9001',
    email: 'guest@mock.local',
    roles: [],
    organizer: false,
    sharedProfile: { nickname: '路人甲', avatarUrl: 'https://picsum.photos/seed/mock-guest/200/200' },
  },
  {
    key: 'founder',
    label: '创始人',
    description: '持有 Founder 角色：可进创始人后台，可提交/编辑自己的项目、发提案。',
    userId: '9002',
    email: 'founder@mock.local',
    roles: [Role.Founder],
    organizer: false,
    sharedProfile: { nickname: '林晓', avatarUrl: 'https://picsum.photos/seed/mock-founder/200/200' },
  },
  {
    key: 'founder-demo',
    label: '创始人（看 seed 数据）',
    description: '复用 seed 的 founder id=1，走真实数据库：切到它就能在创始人后台看到 seed 出来的示例项目。',
    userId: '1',
    email: 'demo-founder@mock.local',
    roles: [Role.Founder],
    organizer: false,
    sharedProfile: null,
    overrides: false,
  },
  {
    key: 'founder-no-profile',
    label: '创始人（无资料）',
    description: '有 Founder 角色，但共享 users 表里没有资料行：调昵称/头像缺失、通知邮件地址为空时的降级。',
    userId: '9003',
    email: null,
    roles: [Role.Founder],
    organizer: false,
    sharedProfile: null,
  },
  {
    key: 'operator',
    label: '运营',
    description: '持有 Operator 角色：可进运营后台审核项目/提案、管理人才与精选。',
    userId: '9004',
    email: 'operator@mock.local',
    roles: [Role.Operator],
    organizer: false,
    sharedProfile: { nickname: '运营小二', avatarUrl: 'https://picsum.photos/seed/mock-operator/200/200' },
  },
  {
    key: 'admin',
    label: '运营 + 创始人',
    description: '同时持有 Founder 与 Operator：调「自己提交的项目自己审」这类双角色路径。',
    userId: '9005',
    email: 'admin@mock.local',
    roles: [Role.Founder, Role.Operator],
    organizer: true,
    sharedProfile: { nickname: '平台管理员', avatarUrl: 'https://picsum.photos/seed/mock-admin/200/200' },
  },
  {
    key: 'organizer',
    label: '主办方成员',
    description: '没有平台角色，但属于主办方组织：只能进主办方后台管理赛季，进不了运营后台。',
    userId: '9006',
    email: 'organizer@mock.local',
    roles: [],
    organizer: true,
    sharedProfile: { nickname: '组委会小王', avatarUrl: 'https://picsum.photos/seed/mock-organizer/200/200' },
  },
]

// ---------------------------------------------------------------------------
// 查询辅助：mock 关闭时全部返回「没命中」，调用方自然回落到真实数据库。
// ---------------------------------------------------------------------------

function activeMockUsers(): readonly MockUser[] {
  return isMockAuthEnabled() ? MOCK_USERS : []
}

export function getMockUserByKey(key: string): MockUser | null {
  return activeMockUsers().find((user) => user.key === key) ?? null
}

/**
 * 按 userId 找回会覆盖数据库的 mock 用户。
 *
 * 只有 `overrides !== false` 的条目参与 —— `founder-demo` 这类「走真实数据库」
 * 的条目必须让开，否则会把 seed 出来的真实角色/资料盖掉。
 */
export function getOverridingMockUser(userId: string): MockUser | null {
  return activeMockUsers().find(
    (user) => user.userId === userId && user.overrides !== false,
  ) ?? null
}

/** 当前 token 对应的 mock 用户（含不覆盖数据库的条目），供切换器回显。 */
export function findMockUserByUserId(userId: string): MockUser | null {
  return activeMockUsers().find((user) => user.userId === userId) ?? null
}

/** 切换器需要的公开字段，不含任何内部实现细节。 */
export interface MockUserSummary {
  key: string
  label: string
  description: string
  userId: string
  email: string | null
  roles: number[]
  isOrganizer: boolean
  hasProfile: boolean
}

export function toMockUserSummary(user: MockUser): MockUserSummary {
  return {
    key: user.key,
    label: user.label,
    description: user.description,
    userId: user.userId,
    email: user.email,
    roles: user.roles,
    isOrganizer: user.organizer,
    hasProfile: user.sharedProfile !== null,
  }
}
