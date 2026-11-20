import { useSyncExternalStore } from 'react'
import {
  WORKSPACE_MILESTONES,
  WORKSPACE_PROJECTS,
  WORKSPACE_WORKS,
  type WorkspaceMilestone,
  type WorkspaceProject,
  type WorkspaceWork,
} from './season-workspace'
import {
  ORGANIZER_ALLOCATIONS,
  ORGANIZER_AUDIT,
  ORGANIZER_BUDGETS,
  ORGANIZER_POINT_POOL,
  ORGANIZER_VERIFICATIONS,
  type OrganizerAllocation,
  type OrganizerAuditEntry,
  type OrganizerBudgetVersion,
  type OrganizerPointPool,
  type OrganizerVerificationItem,
} from './season-organizer-demo'
import {
  LONG_TERM_PROJECTS,
  LONG_TERM_RECRUITMENT_CARDS,
  LONG_TERM_WORKS,
  type LongTermProject,
  type LongTermRecruitmentCard,
  type LongTermWork,
} from './long-term-demo'

/**
 * 赛季演示数据的**单一内存状态**。
 *
 * 作品、里程碑、评分、积分分配、核验队列、审计、长期项目作品都放在这里。
 * 参赛台提交作品后，主办方「项目与进度」与评委台会立刻看到；评委评分后，
 * 主办方「核验与异议」里会出现对应的待复核项；主办方通过/驳回后，评委台
 * 的评分状态、积分余额和作品得分都会跟着变。
 *
 * 边界：
 *   · 只在客户端使用（`useDemoState` 内部是 `useSyncExternalStore`）；
 *   · 不落 localStorage —— 整页刷新会回到初始演示数据，避免上一轮测试的
 *     脏状态带到下一轮；
 *   · 路由切换（Next Link）不会丢，因为模块状态在客户端会话内一直存在。
 *
 * 接后端时，把这里换成 API 调用与缓存即可，页面读写的字段形状保持不变。
 */
export type EnterpriseChallengeDraft = {
  id: string
  title: string
  direction: string
  workTypes: string
  formatLimit: string
  capacity: number
  status: 'draft' | 'published'
  createdAt: string
}

export type EnterpriseJudgeRecommendation = {
  id: string
  name: string
  email: string
  reason: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

export type DeliveryStatus = Record<string, 'pending' | 'accepted'>

export type SeasonDemoState = {
  projects: WorkspaceProject[]
  works: WorkspaceWork[]
  milestones: WorkspaceMilestone[]
  pointPool: OrganizerPointPool
  allocations: OrganizerAllocation[]
  budgets: OrganizerBudgetVersion[]
  verifications: OrganizerVerificationItem[]
  audit: OrganizerAuditEntry[]
  longTermProjects: LongTermProject[]
  longTermWorks: LongTermWork[]
  longTermRecruitmentCards: LongTermRecruitmentCard[]
  enterpriseDrafts: EnterpriseChallengeDraft[]
  judgeRecommendations: EnterpriseJudgeRecommendation[]
  deliveryStatus: DeliveryStatus
}

function cloneWorks(works: readonly WorkspaceWork[]): WorkspaceWork[] {
  return works.map((work) => ({
    ...work,
    reviews: work.reviews.map((review) => ({ ...review })),
    contributors: work.contributors ? [...work.contributors] : undefined,
    attachments: work.attachments ? [...work.attachments] : undefined,
  }))
}

function createInitialState(): SeasonDemoState {
  return {
    projects: WORKSPACE_PROJECTS.map((project) => ({
      ...project,
      challengeIds: [...project.challengeIds],
      members: [...project.members],
    })),
    works: cloneWorks(WORKSPACE_WORKS),
    milestones: WORKSPACE_MILESTONES.map((milestone) => ({ ...milestone })),
    pointPool: { ...ORGANIZER_POINT_POOL },
    allocations: ORGANIZER_ALLOCATIONS.map((allocation) => ({ ...allocation })),
    budgets: ORGANIZER_BUDGETS.map((budget) => ({ ...budget })),
    verifications: ORGANIZER_VERIFICATIONS.map((item) => ({ ...item })),
    audit: ORGANIZER_AUDIT.map((entry) => ({ ...entry })),
    longTermProjects: LONG_TERM_PROJECTS.map((project) => ({
      ...project,
      members: [...project.members],
    })),
    longTermWorks: LONG_TERM_WORKS.map((work) => ({ ...work })),
    longTermRecruitmentCards: LONG_TERM_RECRUITMENT_CARDS.map((card) => ({
      ...card,
      roles: [...card.roles],
      skills: [...card.skills],
    })),
    enterpriseDrafts: [],
    judgeRecommendations: [],
    deliveryStatus: { 'sp-101': 'pending' },
  }
}

let state = createInitialState()
let sequence = 0
const listeners = new Set<() => void>()

/** 生成会话内稳定的演示 id；不依赖时间，测试可预期。 */
export function demoId(prefix: string): string {
  sequence += 1
  // 中间带 `demo` 是为了避开初始数据里固定的 `verify-1` / `audit-1` 等 id：
  // 生成项与种子项一旦撞 id，按 id 查找会选中另一条记录。
  return `${prefix}-demo-${sequence}`
}

export function getDemoState(): SeasonDemoState {
  return state
}

export function subscribeDemoState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setDemoState(
  updater: (current: SeasonDemoState) => SeasonDemoState,
): void {
  state = updater(state)
  for (const listener of listeners) listener()
}

/** 测试用：回到初始数据，避免用例之间互相污染。 */
export function resetDemoState(): void {
  state = createInitialState()
  sequence = 0
  for (const listener of listeners) listener()
}

/**
 * 追加一条审计记录。所有会改变赛季状态的演示操作都应调用它，
 * 这样「审计」tab 才是真实操作日志，而不是一份静态表。
 */
export function auditEntry(
  action: string,
  target: string,
  detail: string,
  actor = '主办方',
): OrganizerAuditEntry {
  return {
    id: demoId('audit'),
    actor,
    action,
    target,
    detail,
    createdAt: '刚刚',
  }
}

/** React hook：订阅整份演示状态。页面较小，整份订阅比 selector 更简单。 */
export function useDemoState(): SeasonDemoState {
  return useSyncExternalStore(subscribeDemoState, getDemoState, getDemoState)
}

/** 根据作品的有效评分重算作品得分与状态。 */
export function recomputeWorkScore(work: WorkspaceWork): WorkspaceWork {
  const validTotal = work.reviews
    .filter((review) => review.status === '有效')
    .reduce((sum, review) => sum + review.score, 0)
  return {
    ...work,
    score: validTotal > 0 ? validTotal : null,
    status:
      validTotal > 0
        ? 'scored'
        : work.status === 'changes_requested'
          ? 'changes_requested'
          : 'reviewing',
  }
}
