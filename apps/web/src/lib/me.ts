import type { Role } from '@shenicest/shared'

/**
 * 个人中心（工作台）的 tab 定义。
 *
 * 每个 tab 是一个真实路由 `/me/<slug>`，不是本地 state —— 刷新、分享、
 * 直接打开某个 tab 都能落到同一屏，和主办方后台的 tab 是同一套做法。
 *
 * `ready` 标记「本批是否已实现」：未实现的 tab 渲染占位说明，
 * 但导航项照样出现 —— 隐藏它们会让用户以为个人中心只有两屏，
 * 而占位页明确告诉他后面还有什么。
 */
export type WorkbenchTab = {
  /** 路由末段，同时作为稳定标识。 */
  slug: string
  label: string
  /** 本批是否已实现真实内容。 */
  ready: boolean
}

export const WORKBENCH_TABS: readonly WorkbenchTab[] = [
  { slug: 'workbench', label: '工作台', ready: false },
  { slug: 'announcements', label: '公告', ready: false },
  { slug: 'applications', label: '报名', ready: true },
  { slug: 'team', label: '组队', ready: true },
  { slug: 'projects', label: '项目', ready: false },
  { slug: 'works', label: '作品', ready: false },
  { slug: 'following', label: '关注', ready: false },
  { slug: 'growth', label: '成长', ready: false },
  { slug: 'rewards', label: '奖励', ready: false },
]

/** 默认落在「报名」：它是本批唯一一屏有真实数据、且几乎人人都要看的内容。 */
export const DEFAULT_WORKBENCH_TAB = WORKBENCH_TABS[2]

export function workbenchTabBySlug(slug: string): WorkbenchTab | undefined {
  return WORKBENCH_TABS.find((tab) => tab.slug === slug)
}

/**
 * tab 上的红点数字。
 *
 * 只统计**真实可点进去处理**的数量，不做假红点：
 *   · 报名 —— 我提交过的报名条数（有待审核的就更该点进去看）；
 *   · 组队 —— 我是选手但还没有赛季项目时给 1，提示「该组队了」。
 * 其余 tab 本批没有真实数据源，一律不显示角标。
 */
export function workbenchTabBadges(input: {
  applicationCount: number
  needsTeam: boolean
}): Record<string, number> {
  return {
    applications: input.applicationCount,
    team: input.needsTeam ? 1 : 0,
  }
}

/**
 * 用户组标签：`普通用户` / `创始人` / `运营` / `创始人 · 运营`。
 *
 * 平台没有「用户组」这个实体，界面上这一栏展示的就是角色集合 ——
 * 所以文案直接由 `Role` 派生，不另建一张表。
 */
export function userGroupLabel(roles: readonly Role[]): string {
  const labels: string[] = []
  if (roles.includes(0 as Role)) labels.push('创始人')
  if (roles.includes(1 as Role)) labels.push('运营')
  return labels.length > 0 ? labels.join(' · ') : '普通用户'
}

/** 公开主页地址：有 `userId` 就指向个人主页。 */
export function publicProfileHref(userId: string): string {
  return `/talents/${encodeURIComponent(userId)}`
}
