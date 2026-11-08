import { getOverridingMockUser, type MockUser } from './fixtures'

/**
 * 数据库读路径上的 mock 覆盖点。
 *
 * 为什么在 service 层覆盖，而不是在 auth 中间件里塞一个「mock 用户对象」？
 * ------------------------------------------------------------------------
 * 平台的身份事实分散在四处，且**全都是按 userId 查库**：
 *   · `user_identities`            → 角色（Founder / Operator）
 *   · `organizer_org_members`      → 主办方组织归属
 *   · 共享 `users` 表               → 昵称 / 头像 / 邮箱
 *   · 各业务表的 `user_id` 列        → 项目、报名、提案的属主
 * 只替换「当前登录用户是谁」（即 JWT）而不管这四处，会得到一个身份和权限
 * 对不上的用户 —— 比如有 Operator 角色但 `/identity/roles` 返回空。
 *
 * 所以 mock 的定位是：**JWT 让请求变成「以某人身份登录」，这里让那四个数据源
 * 也认同这个身份。** 两者都做，任何一处调用点都不需要知道 mock 的存在。
 *
 * 这也正是「不用 seed」的原因：覆盖是进程内的纯函数，不写库、不留脏数据、
 * 改完 fixtures.ts 存盘就生效。
 */

/** 该 userId 是否有生效中的 mock 覆盖（`overrides: false` 的条目不参与）。 */
export function mockOverrideFor(userId: string): MockUser | null {
  return getOverridingMockUser(userId)
}

/**
 * 组织归属的 mock 判定。
 *
 * `organizer: true` 的 mock 用户对**所有**主办方组织都算成员 —— 本地通常只有
 * seed 出来的那几个组织，逐个写 id 既啰嗦又会在重建 seed 后失效；
 * 反过来 `organizer: false` 则一个都不算，用来复现「没有主办方权限」。
 *
 * 返回 null 表示「没有覆盖，去查库」。
 */
export function mockOrganizerMembership(userId: string): boolean | null {
  const user = mockOverrideFor(userId)
  if (!user) return null
  return user.organizer
}
