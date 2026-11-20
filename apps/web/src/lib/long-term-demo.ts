import type { PublicScope } from './season-workspace'

/**
 * 赛季外（长期项目）的本地演示数据。
 *
 * 权限矩阵 4.3 的「发布作品（赛季外）」与「发布招募卡（P1）」都挂在项目
 * 发起人 / 长期成员上，不依赖赛季选手身份。这里用一份独立于赛季项目的
 * 长期项目数据，让普通用户也能把这两条流程走通。
 *
 * 与赛季项目分开的原因：长期项目不产生赛季积分，也不进入赛季项目列表；
 * 如果把两者混在 `WORKSPACE_PROJECTS` 里，首页排行榜、赛季项目评审都会
 * 把长期项目算进去。
 */

export type LongTermProject = {
  id: string
  code: string
  name: string
  ownerId: string
  ownerName: string
  ownerEmail: string
  summary: string
  stage: string
  members: string[]
  createdAt: string
}

export type LongTermWork = {
  id: string
  projectId: string
  title: string
  type: string
  summary: string
  body: string
  publicScope: PublicScope
  authorName: string
  createdAt: string
  /** 赛季外作品提交后进入产品共生审核，不产生积分。 */
  status: 'pending_review' | 'published'
}

export type LongTermRecruitmentCard = {
  id: string
  projectId: string
  roles: string[]
  skills: string[]
  description: string
  deadline: string
  status: 'open' | 'closed'
  createdAt: string
}

export const LONG_TERM_PROJECTS: LongTermProject[] = [
  {
    id: 'lp-101',
    code: 'L-101',
    name: '灵犀储能',
    ownerId: '101',
    ownerName: '张一',
    ownerEmail: 'zhang.yi@example.com',
    summary: '用负荷预测把工商业储能站点的需量电费降下来，长期维护的交付型产品。',
    stage: '已上线',
    members: ['张一', '周野'],
    createdAt: '2026.08.12',
  },
]

export const LONG_TERM_WORKS: LongTermWork[] = [
  {
    id: 'ltw-1',
    projectId: 'lp-101',
    title: '储能站点巡检 SOP v1',
    type: '交付',
    summary: '把站点巡检拆成 12 个可拍照留痕的检查项，客户现场可直接使用。',
    body: '巡检 SOP 覆盖电池舱、PCS、消防、通信与配电五个区域，共 12 个检查项。每项包含判断标准、拍照要求和异常处置建议，已在两个站点试用。',
    publicScope: '公开',
    authorName: '张一',
    createdAt: '11.16 14:00',
    status: 'published',
  },
]

export const LONG_TERM_RECRUITMENT_CARDS: LongTermRecruitmentCard[] = [
  {
    id: 'lrc-1',
    projectId: 'lp-101',
    roles: ['前端工程师'],
    skills: ['React', '数据可视化'],
    description: '做储能站点的监控看板，每周投入 6 小时，长期合作优先。',
    deadline: '2026-12-15',
    status: 'open',
    createdAt: '11.18 10:00',
  },
]

export const LONG_TERM_WORK_TYPES = [
  '交付',
  '过程记录',
  '研究',
  '原型',
  '客户反馈',
  '复盘',
] as const

export function longTermProjectById(
  id: string,
  projects: readonly LongTermProject[] = LONG_TERM_PROJECTS,
): LongTermProject | null {
  return projects.find((project) => project.id === id) ?? null
}
