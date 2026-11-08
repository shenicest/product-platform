/**
 * 运行环境判断。
 *
 * 只有**显式配置为非生产**的环境才算“本地/调试环境”：
 *   · `NODE_ENV` 不是 `production`（`next dev`、`next build` 之外的默认）；
 *   · 或者显式打开 `NEXT_PUBLIC_ORGANIZER_OPEN_ACCESS=true`。
 *
 * 对生产**一律不信任**这个开关：`next build` 是“构建环境”，生产产物也可能在
 * 构建机上跑，所以只要 `NODE_ENV === 'production'`，就永远按生产口径处理，
 * 哪怕 env 里误留了 `NEXT_PUBLIC_ORGANIZER_OPEN_ACCESS=true`。
 *
 * 这些值在构建期被 Next 内联进客户端 bundle，因此服务端与客户端看到的是
 * 同一个常量，不会出现“入口可见但页面 403”的错位。
 */

/** 构建期常量，与 `NODE_ENV` / `NEXT_PUBLIC_*` 保持同一口径。 */
export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/**
 * 本地调试开关：主办方后台对所有已登录账号开放，菜单入口也对所有登录用户显示。
 *
 * 生产环境恒为 `false`（见文件头）。
 */
export const ORGANIZER_OPEN_ACCESS =
  !IS_PRODUCTION && process.env.NEXT_PUBLIC_ORGANIZER_OPEN_ACCESS !== 'false'

/** 是否应该把主办方后台的入口展示给这个用户。 */
export function shouldShowOrganizerEntry(input: {
  isLoggedIn: boolean
  isOperator: boolean
  /** 是否属于至少一个主办方组织；未知（还没查）时传 null。 */
  isOrganizerMember: boolean | null
}): boolean {
  if (!input.isLoggedIn) return false
  if (ORGANIZER_OPEN_ACCESS) return true
  return input.isOperator || input.isOrganizerMember === true
}

/** 是否允许这个用户真正进入主办方后台。 */
export function canAccessOrganizerConsole(input: {
  isLoggedIn: boolean
  isOperator: boolean
  isOrganizerMember: boolean
}): boolean {
  if (!input.isLoggedIn) return false
  if (ORGANIZER_OPEN_ACCESS) return true
  return input.isOperator || input.isOrganizerMember
}
