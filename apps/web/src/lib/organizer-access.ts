/**
 * 主办方后台准入。
 *
 * 只有两类账号能进：平台管理员（`Role.Operator`）或至少属于一个主办方组织的用户。
 * 口径与后端一致（见 `docs/boomland/pre-start-season-api.md` 的 Season Organizer）。
 *
 * 为什么不再有「本地永久开放」的开关？
 * ------------------------------------
 * 早先本地没有可用的主办方身份 —— seed 出来的组织成员要跑一遍 `seed:season` 才有，
 * 而且很难凑出「管理员 / 普通主办方 / 无权限账号」这几种状态，所以一度在非生产
 * 构建里对**所有登录账号**开放后台与菜单入口，纯粹为了能点开页面。
 *
 * 现在 `apps/api/src/mock/fixtures.ts` 提供了完整的主办方 mock 用户：
 *   · `organizer` —— 无平台角色，但属于所有主办方组织；
 *   · `admin`     —— Founder + Operator，且同样算主办方成员；
 *   · 其余条目    —— 都不属于任何组织，正好用来验「看不到入口 / 进不去」。
 * 后端 `mock/overrides.ts` 让这些身份在组织归属读路径上也生效，于是本地只需要
 * 在右下角切换用户，就能覆盖准入矩阵的每一种情况。那个开关因此失去了存在理由，
 * 留着反而会让本地行为和生产不一致（本地能进、生产 403）。
 *
 * 两个函数的入参都只描述「这个人是谁」，没有任何构建期常量参与，所以服务端守卫
 * 与客户端菜单读到的是同一套规则，不会出现「入口可见但页面 403」的错位。
 */

/** 是否应该把主办方后台的入口展示给这个用户。 */
export function shouldShowOrganizerEntry(input: {
  isLoggedIn: boolean
  isOperator: boolean
  /** 是否属于至少一个主办方组织；未知（还没查）时传 null。 */
  isOrganizerMember: boolean | null
}): boolean {
  if (!input.isLoggedIn) return false
  return input.isOperator || input.isOrganizerMember === true
}

/** 是否允许这个用户真正进入主办方后台。 */
export function canAccessOrganizerConsole(input: {
  isLoggedIn: boolean
  isOperator: boolean
  isOrganizerMember: boolean
}): boolean {
  if (!input.isLoggedIn) return false
  return input.isOperator || input.isOrganizerMember
}
