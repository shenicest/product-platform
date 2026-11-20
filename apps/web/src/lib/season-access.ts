/**
 * 赛季角色与入口准入。
 *
 * 权限矩阵（V2.6 §4.3）按「平台身份 → 赛季角色 → 项目角色」三层判断：
 *   · 平台身份来自 `user_identities`（`Role.Founder` / `Role.Operator`）；
 *   · 赛季角色来自本赛季的选手行、评分授权、企业归属与主办方组织；
 *   · 项目角色来自赛季项目的成员行。
 *
 * 本批赛季流程（参赛台 / 评委台 / 企业命题台）仍使用前端演示数据，后端还没有
 * 「查询我的赛季角色」的读接口。因此这里维护一张**只用于本地演示**的
 * userId → 赛季角色表，页面守卫据此隐藏入口、拒绝越权访问。
 *
 * 它不能替代后端鉴权：真实写操作仍必须由后端校验赛季授权。等后端提供
 * `/me/season-roles`（或等价的授权读接口）后，删除这张表，改为读接口即可，
 * 页面守卫与菜单共用同一个函数，不会出现「入口可见但页面 403」的错位。
 *
 * 演示账号与 seed 对齐（`apps/api/src/db/seed-shared.ts` + `seed-season.ts`）：
 *   101 张一    AI4BBS 报名已通过，同时是 BoomLand 组委会成员；
 *   102 李二    AI4BBS 报名已通过，曜石储能联系人，也是曜石储能主办方成员；
 *   103 王知微  AI4BBS 报名已通过，青禾物流主办方成员；
 *   108 评审甲  持有 AI4BBS 积分分配的评委；
 *   109 评审乙  持有 AI4BBS 积分分配的评委。
 *
 * 注意：一个用户可以同时拥有多个赛季角色，权限按角色分别判断；不要用
 * 「平台角色」推断赛季角色（平台管理员没有评委授权也不能评分）。
 */
export const SeasonRole = {
  Participant: 'participant',
  Judge: 'judge',
  Enterprise: 'enterprise',
  Organizer: 'organizer',
} as const
export type SeasonRole = (typeof SeasonRole)[keyof typeof SeasonRole]

export const SEASON_ROLE_LABELS: Record<SeasonRole, string> = {
  participant: '赛季选手',
  judge: '评委',
  enterprise: '企业合作方',
  organizer: '主办方',
}

/**
 * 本地演示用的赛季角色表。
 *
 * 只放 demo 账号；真实用户在没有后端授权读接口前一律视为「没有赛季角色」，
 * 宁可不给入口，也不在客户端猜测授权。
 */
const DEMO_SEASON_ROLES: Readonly<Record<string, readonly SeasonRole[]>> = {
  '101': [SeasonRole.Participant, SeasonRole.Organizer],
  '102': [SeasonRole.Participant, SeasonRole.Enterprise, SeasonRole.Organizer],
  '103': [SeasonRole.Participant, SeasonRole.Organizer],
  '108': [SeasonRole.Judge],
  '109': [SeasonRole.Judge],
}

/**
 * 演示赛季项目（灵犀储能）的发起人。
 *
 * 本批参赛台 / 作品页 / 「我的项目」仍是前端演示数据，只有张一（101）这一份
 * 项目、作品与里程碑。其他已通过报名的选手也能通过真实报名数据进入参赛台，
 * 但他们的项目还没有接后端，不能看到张一的数据，更不能以张一的名义发布。
 *
 * 等作品/里程碑接口接入后，这条替换为「当前用户是否该项目成员」的后端判断。
 */
export const DEMO_WORKSPACE_OWNER_ID = '101'

export function canAccessDemoWorkspace(userId: string | number | null | undefined): boolean {
  return userId !== null && userId !== undefined && String(userId) === DEMO_WORKSPACE_OWNER_ID
}

/** 当前用户在演示数据里的赛季角色；未知用户返回空数组。 */
export function getSeasonRoles(userId: string | number | null | undefined): SeasonRole[] {
  if (userId === null || userId === undefined) return []
  return [...(DEMO_SEASON_ROLES[String(userId)] ?? [])]
}

/** 是否拥有某个赛季角色。 */
export function hasSeasonRole(
  userId: string | number | null | undefined,
  role: SeasonRole,
): boolean {
  return getSeasonRoles(userId).includes(role)
}

export function seasonRoleLabels(roles: readonly SeasonRole[]): string[] {
  return roles.map((role) => SEASON_ROLE_LABELS[role])
}
