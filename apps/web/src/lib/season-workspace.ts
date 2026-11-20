/**
 * 线上赛季演示数据。
 *
 * 后端尚未提供作品、进度、评分与活动流接口，这一版先用同一份本地数据
 * 把选手、主办方、评委、企业四端的页面串起来。所有页面共享这里的类型和
 * 数据，后续接后端时只需要把数据源换掉，页面结构不用重写。
 *
 * 约定：数据里不出现「演示 / mock / 示例」字样；对外呈现的是 AI4BBS
 * 赛季真实形状的内容。
 */

export type WorkStatus = 'published' | 'reviewing' | 'scored' | 'changes_requested'
export type MilestoneStatus = 'pending' | 'submitted' | 'approved' | 'changes_requested'
export type ProjectReviewStatus = 'pending' | 'approved' | 'changes_requested'
export type PublicScope = '公开' | '仅共建与核验可见'

export type WorkspaceChallenge = {
  id: string
  title: string
  enterprise: string
  typeLabel: string
  direction: string
  workTypes: string
  formatLimit: string
  capacity: number
  selected: number
}

export type WorkspaceProject = {
  id: string
  code: string
  name: string
  ownerId: string
  ownerName: string
  ownerEmail: string
  summary: string
  stage: string
  challengeIds: string[]
  members: string[]
  worksCount: number
  score: number
  expectedReward: number
  latestUpdate: string
  milestoneLabel: string
  reviewStatus: ProjectReviewStatus
  reviewNote: string | null
}

export type WorkspaceWork = {
  id: string
  projectId: string
  challengeId: string | null
  type: string
  title: string
  summary: string
  body: string
  authorName: string
  createdAt: string
  status: WorkStatus
  score: number | null
  version: number
  publicScope: PublicScope
  reviewNote: string | null
  reviews: WorkspaceReview[]
  /** 可选的外部链接（演示地址、文档、视频等）。 */
  externalLink?: string | null
  /** 共同贡献者；核心作者之外的人。 */
  contributors?: string[]
  /** 可选关联的里程碑。 */
  milestone?: 'M1' | 'M2' | 'M3' | 'M4' | null
  /** 私密证据说明，只对项目成员/评委/核验员/主办方可见。 */
  privateNote?: string | null
  /** 是否申请评分；发布本身不自动得分。 */
  requestReview?: boolean
  /** 附件文件名；当前由前端记录，上传接口后续接入。 */
  attachments?: string[]
}

export type WorkspaceReview = {
  id: string
  workId: string
  judgeName: string
  score: number
  reason: string
  createdAt: string
  status: '有效' | '待复核' | '已冲正' | '不予赋分'
}

export type WorkspaceMilestone = {
  id: string
  projectId: string
  milestone: 'M1' | 'M2' | 'M3' | 'M4'
  label: string
  status: MilestoneStatus
  submittedAt: string | null
  reviewedAt: string | null
  note: string | null
  /** 提交时关联的作品。 */
  workIds?: string[]
  /** M3/M4 审核所依据的项目命题。 */
  challengeId?: string | null
}

export type WorkspaceActivity = {
  id: string
  text: string
  time: string
  href: string
}

export type WorkspaceJudge = {
  name: string
  scope: string
  allocated: number
  used: number
  remaining: number
  dailyQuota: boolean
}

export type WorkspaceCandidate = {
  userId: string
  name: string
  email: string
  projectId: string
  projectName: string
  challengeIds: string[]
  worksCount: number
}

export type WorkspaceEnterprise = {
  name: string
  challengeIds: string[]
  projectIds: string[]
}

export const WORKSPACE_SEASON = {
  id: 1,
  code: 'AI4BBS',
  name: 'AI4BBS 产业商业赛季',
  statusLabel: '进行中',
  dayIndex: 10,
  dayTotal: 29,
  workDeadline: '2026.12.10',
  scoreDeadline: '2026.12.15',
  settleDate: '2026.12.22',
  themes: ['新型储能基建', '全球 AI 基建', '新生产关系的人本基建'],
  exchangeRate: 1,
  maxChallengesPerProject: 3,
  maxProjectsPerParticipant: 2,
  singleWorkCap: 300,
  reviewThreshold: 30,
} as const

export const WORKSPACE_CHALLENGES: WorkspaceChallenge[] = [
  {
    id: 'c1',
    title: '新型储能站点智能运维',
    enterprise: '曜石储能',
    typeLabel: '商单验证型',
    direction: '储能 / 智能运维',
    workTypes: '过程记录、原型、数据/模型',
    formatLimit: 'PDF / 图片 / 外链，单个附件 ≤ 20MB',
    capacity: 6,
    selected: 3,
  },
  {
    id: 'c2',
    title: '边缘算力调度与能耗优化',
    enterprise: '云杉算力',
    typeLabel: '解决方案 / POC 型',
    direction: '算力 / 能耗',
    workTypes: '研究、原型、复盘',
    formatLimit: 'PDF / 图片 / 外链，单个附件 ≤ 20MB',
    capacity: 5,
    selected: 2,
  },
  {
    id: 'c3',
    title: '物流可视化与异常预警',
    enterprise: '青禾物流',
    typeLabel: '上下游合作型',
    direction: '物流 / 数据',
    workTypes: '客户反馈、交付、过程记录',
    formatLimit: 'PDF / 图片 / 视频外链，单个附件 ≤ 30MB',
    capacity: 4,
    selected: 2,
  },
  {
    id: 'c4',
    title: '产业内容与社区增长',
    enterprise: 'BoomLand 组委会',
    typeLabel: '数据 / 研究验证型',
    direction: '内容 / 社区',
    workTypes: '策划、复盘、研究',
    formatLimit: 'PDF / 图片 / 外链，单个附件 ≤ 20MB',
    capacity: 8,
    selected: 2,
  },
]

export const WORKSPACE_PROJECTS: WorkspaceProject[] = [
  {
    id: 'sp-101',
    code: 'P-101',
    name: '灵犀储能',
    ownerId: '101',
    ownerName: '张一',
    ownerEmail: 'zhang.yi@example.com',
    summary: '用负荷预测把工商业储能站点的需量电费降下来。',
    stage: '生长',
    challengeIds: ['c1', 'c2'],
    members: ['张一', '周野', '陈青'],
    worksCount: 3,
    score: 42,
    expectedReward: 42,
    latestUpdate: '11.21 14:32',
    milestoneLabel: 'M2 已通过',
    reviewStatus: 'pending',
    reviewNote: null,
  },
  {
    id: 'sp-102',
    code: 'P-102',
    name: '云杉边缘',
    ownerId: '202',
    ownerName: '周野',
    ownerEmail: 'zhou.ye@example.com',
    summary: '把边缘节点的峰谷算力调度成可计量的服务。',
    stage: '发芽',
    challengeIds: ['c2'],
    members: ['周野', '苏禾'],
    worksCount: 2,
    score: 18,
    expectedReward: 18,
    latestUpdate: '11.21 11:08',
    milestoneLabel: 'M1 已通过',
    reviewStatus: 'approved',
    reviewNote: null,
  },
  {
    id: 'sp-103',
    code: 'P-103',
    name: '青禾链路',
    ownerId: '203',
    ownerName: '陈青',
    ownerEmail: 'chen.qing@example.com',
    summary: '给区域仓库做一套异常预警与可视化看板。',
    stage: '开花',
    challengeIds: ['c3', 'c4'],
    members: ['陈青', '张一', '苏禾'],
    worksCount: 4,
    score: 56,
    expectedReward: 56,
    latestUpdate: '11.20 19:40',
    milestoneLabel: 'M3 待审核',
    reviewStatus: 'pending',
    reviewNote: null,
  },
  {
    id: 'sp-104',
    code: 'P-104',
    name: '城市共创',
    ownerId: '204',
    ownerName: '苏禾',
    ownerEmail: 'su.he@example.com',
    summary: '把城市产业伙伴的线下共创做成可复用的工作坊产品。',
    stage: '种子',
    challengeIds: ['c4'],
    members: ['苏禾'],
    worksCount: 1,
    score: 0,
    expectedReward: 0,
    latestUpdate: '11.20 16:10',
    milestoneLabel: 'M1 待审核',
    reviewStatus: 'pending',
    reviewNote: null,
  },
]

export const WORKSPACE_WORKS: WorkspaceWork[] = [
  {
    id: 'w-101',
    projectId: 'sp-101',
    challengeId: 'c1',
    type: '过程记录',
    title: 'M2 客户访谈复盘',
    summary: '访谈 6 家工商业站点，整理出 3 个高频痛点。',
    body: '我们访谈了 6 家工商业站点，发现需量电费、峰谷套利和运维响应是三个最高频的痛点。复盘记录了每家客户的用电结构、现有管理方式与愿意尝试的边界。',
    authorName: '张一',
    createdAt: '11.21 14:32',
    status: 'scored',
    score: 30,
    version: 2,
    publicScope: '公开',
    reviewNote: null,
    reviews: [
      {
        id: 'r-101',
        workId: 'w-101',
        judgeName: '评审甲',
        score: 18,
        reason: '访谈样本覆盖了主要客户类型，痛点归纳清晰，建议下一步补上付费意愿分层。',
        createdAt: '11.21 15:10',
        status: '有效',
      },
      {
        id: 'r-102',
        workId: 'w-101',
        judgeName: '评审乙',
        score: 12,
        reason: '证据扎实，若能补充客户访谈纪要的原始链接会更有说服力。',
        createdAt: '11.21 16:02',
        status: '有效',
      },
    ],
  },
  {
    id: 'w-102',
    projectId: 'sp-101',
    challengeId: 'c2',
    type: '原型',
    title: '边缘调度原型 v0.2',
    summary: '把峰谷电价接入调度策略，完成第一版可视化。',
    body: '第一版原型已经能读取峰谷电价与节点负载，给出未来 24 小时的调度建议。当前还在补齐异常回退和人工确认流程。',
    authorName: '周野',
    createdAt: '11.21 11:08',
    status: 'reviewing',
    score: null,
    version: 1,
    publicScope: '公开',
    reviewNote: null,
    reviews: [],
  },
  {
    id: 'w-103',
    projectId: 'sp-101',
    challengeId: 'c1',
    type: '数据/模型',
    title: '站点负荷预测 v1',
    summary: '用 30 天电表数据训练基线模型，MAPE 12.6%。',
    body: '基于 30 天 15 分钟粒度的电表数据训练基线模型，MAPE 12.6%。下一步会把天气与生产排程接进来，验证峰值预测能否再降 3 个百分点。',
    authorName: '陈青',
    createdAt: '11.20 18:26',
    status: 'reviewing',
    score: null,
    version: 1,
    publicScope: '仅共建与核验可见',
    reviewNote: null,
    reviews: [
      {
        id: 'r-106',
        workId: 'w-103',
        judgeName: '评审甲',
        score: 32,
        reason: '模型口径清楚，基线可复现；建议补充天气与生产排程变量后再看峰值误差。',
        createdAt: '11.21 11:20',
        status: '待复核',
      },
    ],
  },
  {
    id: 'w-104',
    projectId: 'sp-102',
    challengeId: 'c2',
    type: '研究',
    title: '算力峰谷数据观察',
    summary: '统计 4 个边缘节点的负载曲线，找到 3 个可调度窗口。',
    body: '统计了 4 个边缘节点连续两周的负载曲线，识别出 3 个稳定的可调度窗口。报告给出了窗口时长、可迁移任务类型与预估节省。',
    authorName: '周野',
    createdAt: '11.21 10:20',
    status: 'scored',
    score: 18,
    version: 1,
    publicScope: '公开',
    reviewNote: null,
    reviews: [
      {
        id: 'r-103',
        workId: 'w-104',
        judgeName: '评审甲',
        score: 18,
        reason: '数据口径清楚，窗口识别方法可复用；建议补充一次真实现场验证。',
        createdAt: '11.21 12:05',
        status: '有效',
      },
    ],
  },
  {
    id: 'w-105',
    projectId: 'sp-103',
    challengeId: 'c3',
    type: '客户反馈',
    title: '三家仓库的试用反馈',
    summary: '三家客户完成一周试用，给出 5 条明确改进项。',
    body: '三家区域仓库完成了一周试用，反馈集中在异常阈值配置、移动端提醒和导出格式。团队已经把 5 条改进项排进下一版。',
    authorName: '陈青',
    createdAt: '11.20 19:40',
    status: 'scored',
    score: 20,
    version: 1,
    publicScope: '公开',
    reviewNote: null,
    reviews: [
      {
        id: 'r-104',
        workId: 'w-105',
        judgeName: '评审甲',
        score: 20,
        reason: '有真实客户反馈与明确改进项，证据链完整，符合外部试用阶段的要求。',
        createdAt: '11.20 21:12',
        status: '有效',
      },
    ],
  },
  {
    id: 'w-106',
    projectId: 'sp-103',
    challengeId: 'c4',
    type: '交付',
    title: '首次付费交付复盘',
    summary: '完成第一单 8,000 元交付，记录交付流程与客户验收。',
    body: '完成第一单 8,000 元的看板交付，记录了从需求确认、部署到客户验收的全过程。复盘重点是把交付清单和验收标准产品化。',
    authorName: '张一',
    createdAt: '11.20 16:10',
    status: 'changes_requested',
    score: null,
    version: 2,
    publicScope: '仅共建与核验可见',
    reviewNote: '请补充客户验收截图与交付清单，便于核验金额与交付范围。',
    reviews: [],
  },
  {
    id: 'w-107',
    projectId: 'sp-103',
    challengeId: 'c3',
    type: '过程记录',
    title: 'M3 外部试用证据',
    summary: '整理 M3 试用证据、客户签字与现场照片。',
    body: '把三家客户的试用记录、签字确认与现场照片整理成一份 M3 证据包，已提交主办方审核。',
    authorName: '苏禾',
    createdAt: '11.19 15:46',
    status: 'reviewing',
    score: null,
    version: 1,
    publicScope: '仅共建与核验可见',
    reviewNote: null,
    reviews: [],
  },
  {
    id: 'w-108',
    projectId: 'sp-104',
    challengeId: 'c4',
    type: '策划',
    title: '线下共创工作坊策划',
    summary: '面向 20 位产业伙伴的半天共创工作坊流程。',
    body: '围绕城市产业伙伴的真实问题设计了半天共创工作坊，包含问题排序、方案共创和下一步承诺三个环节。',
    authorName: '苏禾',
    createdAt: '11.20 14:08',
    status: 'reviewing',
    score: null,
    version: 1,
    publicScope: '公开',
    reviewNote: null,
    reviews: [
      {
        id: 'r-105',
        workId: 'w-108',
        judgeName: '评审乙',
        score: 34,
        reason: '工作坊流程完整、产出物明确，对产业伙伴的参与门槛设计得当。',
        createdAt: '11.21 10:15',
        status: '待复核',
      },
    ],
  },
]

export const WORKSPACE_MILESTONES: WorkspaceMilestone[] = [
  {
    id: 'm-101',
    projectId: 'sp-101',
    milestone: 'M1',
    label: '验证真实问题',
    status: 'approved',
    submittedAt: '11.12 10:20',
    reviewedAt: '11.13 09:40',
    note: '访谈与需求证据充分。',
  },
  {
    id: 'm-102',
    projectId: 'sp-101',
    milestone: 'M2',
    label: '形成可交付方案',
    status: 'approved',
    submittedAt: '11.18 17:30',
    reviewedAt: '11.19 10:05',
    note: '原型与交付边界清楚。',
  },
  {
    id: 'm-103',
    projectId: 'sp-101',
    milestone: 'M3',
    label: '完成外部试用或真实交付',
    status: 'pending',
    submittedAt: null,
    reviewedAt: null,
    note: null,
  },
  {
    id: 'm-104',
    projectId: 'sp-101',
    milestone: 'M4',
    label: '完成命题关键结果',
    status: 'pending',
    submittedAt: null,
    reviewedAt: null,
    note: null,
  },
  {
    id: 'm-105',
    projectId: 'sp-102',
    milestone: 'M1',
    label: '验证真实问题',
    status: 'approved',
    submittedAt: '11.14 11:00',
    reviewedAt: '11.15 09:20',
    note: '数据观察覆盖了主要节点。',
  },
  {
    id: 'm-106',
    projectId: 'sp-102',
    milestone: 'M2',
    label: '形成可交付方案',
    status: 'submitted',
    submittedAt: '11.21 09:30',
    reviewedAt: null,
    note: null,
  },
  {
    id: 'm-107',
    projectId: 'sp-103',
    milestone: 'M1',
    label: '验证真实问题',
    status: 'approved',
    submittedAt: '11.13 14:10',
    reviewedAt: '11.14 10:00',
    note: '三家仓库需求验证完成。',
  },
  {
    id: 'm-108',
    projectId: 'sp-103',
    milestone: 'M2',
    label: '形成可交付方案',
    status: 'approved',
    submittedAt: '11.17 16:40',
    reviewedAt: '11.18 11:30',
    note: '看板与预警方案可被外部理解。',
  },
  {
    id: 'm-109',
    projectId: 'sp-103',
    milestone: 'M3',
    label: '完成外部试用或真实交付',
    status: 'submitted',
    submittedAt: '11.19 15:46',
    reviewedAt: null,
    note: null,
  },
  {
    id: 'm-110',
    projectId: 'sp-104',
    milestone: 'M1',
    label: '验证真实问题',
    status: 'submitted',
    submittedAt: '11.20 16:10',
    reviewedAt: null,
    note: null,
  },
]

export const WORKSPACE_JUDGE: WorkspaceJudge = {
  // 与 seed 的评审甲（userId 108）对齐：积分分配 200，已用 88
  // （三笔有效评分 56 + 一笔待复核 32），剩余 112。
  name: '评审甲',
  scope: '全部项目',
  allocated: 200,
  used: 88,
  remaining: 112,
  dailyQuota: false,
}

export const WORKSPACE_ENTERPRISE: WorkspaceEnterprise = {
  name: '曜石储能',
  challengeIds: ['c1'],
  projectIds: ['sp-101'],
}

export const WORKSPACE_CANDIDATES: WorkspaceCandidate[] = [
  {
    userId: '101',
    name: '张一',
    email: 'zhang.yi@example.com',
    projectId: 'sp-101',
    projectName: '灵犀储能',
    challengeIds: ['c1', 'c2'],
    worksCount: 3,
  },
  {
    userId: '202',
    name: '周野',
    email: 'zhou.ye@example.com',
    projectId: 'sp-102',
    projectName: '云杉边缘',
    challengeIds: ['c2'],
    worksCount: 2,
  },
  {
    userId: '203',
    name: '陈青',
    email: 'chen.qing@example.com',
    projectId: 'sp-103',
    projectName: '青禾链路',
    challengeIds: ['c3', 'c4'],
    worksCount: 4,
  },
  {
    userId: '204',
    name: '苏禾',
    email: 'su.he@example.com',
    projectId: 'sp-104',
    projectName: '城市共创',
    challengeIds: ['c4'],
    worksCount: 1,
  },
]

export const WORKSPACE_ACTIVITIES: WorkspaceActivity[] = [
  {
    id: 'a1',
    text: '张一 提交了进度《M2 客户访谈复盘》',
    time: '2 分钟前',
    href: '/seasons/1',
  },
  {
    id: 'a2',
    text: '周野 给「灵犀储能」的《M2 客户访谈复盘》评分 +18',
    time: '6 分钟前',
    href: '/seasons/1',
  },
  {
    id: 'a3',
    text: '青禾链路 完成 M3 外部试用证据提交',
    time: '12 分钟前',
    href: '/seasons/1',
  },
  {
    id: 'a4',
    text: '陈青 提交了作品《三家仓库的试用反馈》',
    time: '18 分钟前',
    href: '/seasons/1',
  },
  {
    id: 'a5',
    text: '评委李二 完成 3 份作品的评审',
    time: '25 分钟前',
    href: '/seasons/1',
  },
  {
    id: 'a6',
    text: '苏禾 发起了项目「城市共创」',
    time: '32 分钟前',
    href: '/seasons/1',
  },
  {
    id: 'a7',
    text: 'AI4BBS 产业商业赛季 已进入作品提交阶段',
    time: '1 小时前',
    href: '/seasons/1',
  },
  {
    id: 'a8',
    text: '曜石储能 发布了命题「新型储能站点智能运维」',
    time: '2 小时前',
    href: '/challenges/1',
  },
]

export type LeaderboardRow = {
  rank: number
  projectName: string
  subtitle: string
  rLevel: 'R5' | 'R4' | 'R3' | 'R2' | 'R1' | null
  points: number
  reward: number
}

export const WORKSPACE_LEADERBOARD: LeaderboardRow[] = [
  {
    rank: 1,
    projectName: '光储小卖部',
    subtitle: '工商业储能的第一张订单 等 2 个命题 · 结果',
    rLevel: 'R5',
    points: 1670,
    reward: 1670,
  },
  {
    rank: 2,
    projectName: '储能管家',
    subtitle: '工商业储能的第一张订单 · 生长',
    rLevel: 'R4',
    points: 1640,
    reward: 1640,
  },
  {
    rank: 3,
    projectName: '仓库眼',
    subtitle: '仓储 AI 质检：两周跑通一个 POC · 开花',
    rLevel: 'R3',
    points: 1410,
    reward: 1410,
  },
  {
    rank: 4,
    projectName: '算力电费账本',
    subtitle: '边缘算力进园区：拼出一个新业态 · 生长',
    rLevel: null,
    points: 850,
    reward: 850,
  },
  {
    rank: 5,
    projectName: '园区算力拼车',
    subtitle: '边缘算力进园区：拼出一个新业态 · 发芽',
    rLevel: null,
    points: 800,
    reward: 800,
  },
  {
    rank: 6,
    projectName: '货架盘点眼镜',
    subtitle: '仓储 AI 质检：两周跑通一个 POC · 生长',
    rLevel: 'R2',
    points: 470,
    reward: 470,
  },
  {
    rank: 7,
    projectName: '冷库削峰',
    subtitle: '工商业储能的第一张订单 · 发芽',
    rLevel: 'R1',
    points: 380,
    reward: 380,
  },
  {
    rank: 8,
    projectName: '园区共享运维',
    subtitle: '边缘算力进园区：拼出一个新业态 · 发芽',
    rLevel: null,
    points: 140,
    reward: 140,
  },
  {
    rank: 9,
    projectName: '零碳食堂',
    subtitle: '工商业储能的第一张订单 · 种子',
    rLevel: null,
    points: 60,
    reward: 60,
  },
  {
    rank: 10,
    projectName: '夜间仓巡机器人',
    subtitle: '仓储 AI 质检：两周跑通一个 POC · 种子',
    rLevel: null,
    points: 0,
    reward: 0,
  },
]

export type LeaderboardFeedItem = {
  id: string
  /** 行内加粗主体，如评委名 / 项目名 / 用户名。 */
  actor: string
  /** 动作与对象，例如「给《…》赋分 +140」。 */
  action: string
  time: string
}

export const LEADERBOARD_RECENT_SCORES: LeaderboardFeedItem[] = [
  {
    id: 'ls1',
    actor: '黎明',
    action: '给 园区共享运维《共享运维排班方案》v1 赋分 +140',
    time: '3 小时前',
  },
  {
    id: 'ls2',
    actor: '唐果',
    action: '给 光储小卖部《给曜石储能的季中路演》v1 赋分 +220',
    time: '4 小时前',
  },
  {
    id: 'ls3',
    actor: '黎明',
    action: '给 园区算力拼车《5 家设计工作室的渲染算力需求》v1 赋分 +100',
    time: '5 小时前',
  },
  {
    id: 'ls4',
    actor: '赵敏',
    action: '给 储能管家《首付付费试点客户的两周反馈》v1 赋分 +280',
    time: '5 小时前',
  },
  {
    id: 'ls5',
    actor: '宋河',
    action: '给 货架盘点眼镜《两位盘点员的试戴反馈》v1 赋分 +160',
    time: '19 小时前',
  },
]

export const LEADERBOARD_RECENT_EVOLUTIONS: LeaderboardFeedItem[] = [
  {
    id: 'le1',
    actor: '光储小卖部',
    action: '通过 M4，进化为「结果」',
    time: '20 小时前',
  },
  {
    id: 'le2',
    actor: '仓库眼',
    action: '通过 M3，进化为「开花」',
    time: '20 小时前',
  },
  {
    id: 'le3',
    actor: '货架盘点眼镜',
    action: '通过 M2，进化为「生长」',
    time: '1 天前',
  },
]

export const LEADERBOARD_RECENT_ACTIVITY: LeaderboardFeedItem[] = [
  {
    id: 'la1',
    actor: '白露',
    action: '发布了 数据/模型《破损样本库 2,400 张标注说明》',
    time: '2 小时前',
  },
  {
    id: 'la2',
    actor: '许诺',
    action: '发布了 原型《拼车下单页》',
    time: '4 小时前',
  },
  {
    id: 'la3',
    actor: '陈一鸣',
    action: '提交了里程碑 M2',
    time: '6 小时前',
  },
]

export const MY_USER_ID = '101'
export const MY_PROJECT_ID = 'sp-101'
export const MY_PROJECT = WORKSPACE_PROJECTS.find((project) => project.id === MY_PROJECT_ID)!

export const WORK_TYPES = [
  '过程记录',
  '原型',
  '研究',
  '客户反馈',
  '交付',
  '策划',
  '数据/模型',
  '复盘',
] as const

export const PUBLIC_SCOPES: PublicScope[] = ['公开', '仅共建与核验可见']

export function challengeById(id: string | null): WorkspaceChallenge | null {
  return id ? WORKSPACE_CHALLENGES.find((challenge) => challenge.id === id) ?? null : null
}

export function projectById(id: string): WorkspaceProject | null {
  return WORKSPACE_PROJECTS.find((project) => project.id === id) ?? null
}

export function projectWorks(projectId: string): WorkspaceWork[] {
  return WORKSPACE_WORKS.filter((work) => work.projectId === projectId)
}

export function projectMilestones(projectId: string): WorkspaceMilestone[] {
  return WORKSPACE_MILESTONES.filter((milestone) => milestone.projectId === projectId)
}

export function workStatusMeta(status: WorkStatus): {
  label: string
  tone: 'neutral' | 'sky' | 'success' | 'warning' | 'danger'
} {
  switch (status) {
    case 'reviewing':
      return { label: '评审中', tone: 'sky' }
    case 'scored':
      return { label: '已评分', tone: 'success' }
    case 'changes_requested':
      return { label: '需补充', tone: 'warning' }
    default:
      return { label: '已发布', tone: 'neutral' }
  }
}

export function milestoneStatusMeta(status: MilestoneStatus): {
  label: string
  tone: 'neutral' | 'sky' | 'success' | 'warning' | 'danger'
} {
  switch (status) {
    case 'submitted':
      return { label: '待审核', tone: 'sky' }
    case 'approved':
      return { label: '已通过', tone: 'success' }
    case 'changes_requested':
      return { label: '需补充', tone: 'warning' }
    default:
      return { label: '未提交', tone: 'neutral' }
  }
}

export function projectReviewMeta(status: ProjectReviewStatus): {
  label: string
  tone: 'neutral' | 'sky' | 'success' | 'warning'
} {
  switch (status) {
    case 'approved':
      return { label: '已确认', tone: 'success' }
    case 'changes_requested':
      return { label: '需补充', tone: 'warning' }
    default:
      return { label: '待评审', tone: 'sky' }
  }
}

/** 固定 1 积分 = ¥1。 */
export function formatReward(points: number): string {
  return `¥${points.toLocaleString('zh-CN')}`
}

export function selectedChallengeLabels(project: WorkspaceProject): string[] {
  return project.challengeIds
    .map((id) => challengeById(id)?.title)
    .filter((title): title is string => Boolean(title))
}
