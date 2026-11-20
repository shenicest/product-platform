/**
 * 主办方后台的本地演示数据：积分池、评委分配、预算、核验队列与审计日志。
 *
 * 后端已有积分池 / 分配 / 预算接口，但本批先按「前端演示、测试数据」推进，
 * 让主办方后台的四个 tab（评委与积分池 / 预算与结算 / 核验与异议 / 审计）
 * 能完整点通。数据形状刻意贴近后端 DTO，后续替换数据源时页面不用重写。
 *
 * 这些数据由 `season-demo-store.ts` 持有；页面上的操作（追加积分池、分配、
 * 回收、复核、冲正）会写回同一份 store，所以从评委台到主办方复核是一条
 * 真正连起来的状态链，而不是每页各写一份假数据。
 */

export type PointPoolStatus = 'active' | 'closed'
export type AllocationStatus = 'active' | 'reclaimed'
export type BudgetStatus = 'active' | 'superseded'
export type VerificationKind = 'large-review' | 'evidence' | 'dispute'
export type VerificationStatus = 'pending' | 'approved' | 'rejected'

export type OrganizerPointPool = {
  totalPoints: number
  allocatedPoints: number
  usedPoints: number
  status: PointPoolStatus
  updatedAt: string
}

export type OrganizerAllocation = {
  id: string
  judgeName: string
  judgeUserId: string
  /** 作用范围：全部项目 / 本企业命题。 */
  scope: 'all' | 'enterprise'
  scopeLabel: string
  amount: number
  usedAmount: number
  status: AllocationStatus
  dailyQuota: boolean
  createdAt: string
}

export type OrganizerBudgetVersion = {
  id: string
  version: number
  totalAmount: number
  managementFee: number
  prizePoolAmount: number
  reason: string
  status: BudgetStatus
  createdAt: string
}

export type OrganizerVerificationItem = {
  id: string
  kind: VerificationKind
  title: string
  projectName: string
  submittedBy: string
  submittedAt: string
  status: VerificationStatus
  detail: string
  /** 大额复核：关联的作品与评分。 */
  workId?: string
  reviewId?: string
  judgeName?: string
  score?: number
  reason?: string
  /** 处理结论 / 备注。 */
  resolution?: string
}

export type OrganizerAuditEntry = {
  id: string
  actor: string
  action: string
  target: string
  detail: string
  createdAt: string
}

export const ORGANIZER_POINT_POOL: OrganizerPointPool = {
  totalPoints: 1_000,
  allocatedPoints: 350,
  usedPoints: 134,
  status: 'active',
  updatedAt: '11.21 09:10',
}

/**
 * 两个评委的分配与已用额度。
 *
 * 已用额度包含「待复核」的评分：额度在提交评分时就被占用，复核驳回后再退回。
 * 这与后端 `point_allocations.used_amount` 的口径一致，也解释了为什么评委台
 * 的剩余额度会在提交大额评分后立刻下降。
 */
export const ORGANIZER_ALLOCATIONS: OrganizerAllocation[] = [
  {
    id: 'al-108',
    judgeName: '评审甲',
    judgeUserId: '108',
    scope: 'all',
    scopeLabel: '全部项目',
    amount: 200,
    usedAmount: 88,
    status: 'active',
    dailyQuota: false,
    createdAt: '11.15 10:00',
  },
  {
    id: 'al-109',
    judgeName: '评审乙',
    judgeUserId: '109',
    scope: 'all',
    scopeLabel: '全部项目',
    amount: 150,
    usedAmount: 46,
    status: 'active',
    dailyQuota: false,
    createdAt: '11.15 10:05',
  },
]

export const ORGANIZER_BUDGETS: OrganizerBudgetVersion[] = [
  {
    id: 'budget-2',
    version: 2,
    totalAmount: 60_000,
    managementFee: 12_000,
    prizePoolAmount: 30_000,
    reason: '追加过程奖励池（预算 v2）',
    status: 'active',
    createdAt: '11.10 14:00',
  },
  {
    id: 'budget-1',
    version: 1,
    totalAmount: 40_000,
    managementFee: 8_000,
    prizePoolAmount: 22_000,
    reason: '赛季发布预算 v1',
    status: 'superseded',
    createdAt: '10.20 10:00',
  },
]

/**
 * 核验队列的初始数据。
 *
 * 两条大额复核与 `WORKSPACE_WORKS` 里的两条「待复核」评分一一对应：
 * 评委台提交 ≥30 分后，主办方在这里通过或驳回冲正，两边状态才会一致。
 */
export const ORGANIZER_VERIFICATIONS: OrganizerVerificationItem[] = [
  {
    id: 'verify-1',
    kind: 'large-review',
    title: '站点负荷预测 v1',
    projectName: '灵犀储能',
    submittedBy: '评审甲',
    submittedAt: '11.21 11:20',
    status: 'pending',
    detail: '单次评分 32 分，达到大额复核阈值 30 分。复核人不能是原评委。',
    workId: 'w-103',
    reviewId: 'r-106',
    judgeName: '评审甲',
    score: 32,
    reason: '模型口径清楚，基线可复现；建议补充天气与生产排程变量后再看峰值误差。',
  },
  {
    id: 'verify-2',
    kind: 'large-review',
    title: '线下共创工作坊策划',
    projectName: '社区共创桌游',
    submittedBy: '评审乙',
    submittedAt: '11.21 10:15',
    status: 'pending',
    detail: '单次评分 34 分，达到大额复核阈值 30 分。复核人不能是原评委。',
    workId: 'w-108',
    reviewId: 'r-105',
    judgeName: '评审乙',
    score: 34,
    reason: '工作坊流程完整、产出物明确，对产业伙伴的参与门槛设计得当。',
  },
  {
    id: 'verify-3',
    kind: 'evidence',
    title: 'M3 外部试用证据',
    projectName: '仓库巡检小助手',
    submittedBy: '苏禾',
    submittedAt: '11.19 15:46',
    status: 'pending',
    detail: '三家客户试用记录、签字确认与现场照片，申请核验 M3 外部试用。',
  },
  {
    id: 'verify-4',
    kind: 'dispute',
    title: '对 W-105 客户反馈评分的异议',
    projectName: '仓库巡检小助手',
    submittedBy: '陈青',
    submittedAt: '11.20 09:30',
    status: 'pending',
    detail: '认为评分未计入第二次客户回访的证据，申请复核该作品的评分。',
  },
  {
    id: 'verify-5',
    kind: 'evidence',
    title: 'M2 客户访谈证据',
    projectName: '灵犀储能',
    submittedBy: '张一',
    submittedAt: '11.18 17:30',
    status: 'approved',
    detail: '访谈纪要与客户签字已核验。',
    resolution: '证据链完整，通过。',
  },
]

export const ORGANIZER_AUDIT: OrganizerAuditEntry[] = [
  {
    id: 'audit-4',
    actor: '张一',
    action: 'work.published',
    target: 'M2 客户访谈复盘',
    detail: '版本 v2，公开范围：公开',
    createdAt: '11.21 14:32',
  },
  {
    id: 'audit-3',
    actor: '评审甲',
    action: 'score.submitted',
    target: '站点负荷预测 v1',
    detail: '+32 分，达到大额复核阈值',
    createdAt: '11.21 11:20',
  },
  {
    id: 'audit-2',
    actor: '主办方',
    action: 'point_pool.allocated',
    target: '评审甲',
    detail: '分配 200 分，作用范围：全部项目',
    createdAt: '11.15 10:00',
  },
  {
    id: 'audit-1',
    actor: '张一',
    action: 'season_project.created',
    target: '灵犀储能',
    detail: '带入长期项目，选择 2 个命题',
    createdAt: '11.12 09:20',
  },
  {
    id: 'audit-5',
    actor: '主办方',
    action: 'application.approved',
    target: '李二 · AI4BBS',
    detail: '报名审核通过，微信状态：已邀请',
    createdAt: '11.10 09:45',
  },
]

export function verificationKindLabel(kind: VerificationKind): string {
  if (kind === 'large-review') return '大额复核'
  if (kind === 'evidence') return '证据核验'
  return '异议'
}

export function verificationStatusMeta(status: VerificationStatus): {
  label: string
  tone: 'warning' | 'success' | 'danger' | 'neutral'
} {
  if (status === 'pending') return { label: '待处理', tone: 'warning' }
  if (status === 'approved') return { label: '已通过', tone: 'success' }
  return { label: '已驳回', tone: 'danger' }
}
