export const ProjectStatus = {
  Draft: 0,
  PendingReview: 1,
  RevisionRequired: 2,
  Live: 3,
  Delisted: 4,
  Rejected: 5,
} as const
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus]

export const ProposalStatus = {
  Pending: 0,
  Approved: 1,
  Rejected: 2,
  RevisionRequired: 3,
} as const
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus]

export const ProjectStage = {
  MVP: 0,
  Growth: 1,
} as const
export type ProjectStage = (typeof ProjectStage)[keyof typeof ProjectStage]

export const Role = {
  Founder: 0,
  Operator: 1,
} as const
export type Role = (typeof Role)[keyof typeof Role]

export const CATEGORIES = ['女性健康', '效率工具', '教育学习', '开发者工具', '生活方式', '其他'] as const
export type Category = (typeof CATEGORIES)[number]

export const TalentProfileStatus = {
  Published: 0,
  Paused: 1,
  Suspended: 2,
} as const
export type TalentProfileStatus = (typeof TalentProfileStatus)[keyof typeof TalentProfileStatus]

export const ConnectionRequestStatus = {
  Pending: 0,
  Accepted: 1,
  Ignored: 2,
  Cancelled: 3,
} as const
export type ConnectionRequestStatus = (typeof ConnectionRequestStatus)[keyof typeof ConnectionRequestStatus]

export const TALENT_SKILLS = [
  '产品策略', '需求分析', '用户研究', '产品设计', '原型设计', '项目管理',
  'UI 设计', 'UX 设计', '交互设计', '视觉设计', '品牌设计', '动效设计',
  '前端开发', '后端开发', '全栈开发', '移动端开发', 'AI 开发', '数据开发', 'DevOps', '硬件开发',
  '增长策略', '内容策划', '内容创作', '社交媒体', 'SEO', '品牌传播',
  '用户运营', '社区运营', '活动运营', '商业运营', '客户成功',
  '数据分析', '数据可视化', '实验设计', '商业分析', '商业策略', '融资', '法务', '财务', '行业研究',
] as const
export type TalentSkill = (typeof TALENT_SKILLS)[number]

export const TALENT_ROLES = ['产品', '设计', '开发', '增长/内容', '运营', '数据', '其他'] as const
export type TalentRole = (typeof TALENT_ROLES)[number]

export const COLLABORATION_DURATIONS = ['一次咨询', '短期项目', '长期合作'] as const
export type CollaborationDuration = (typeof COLLABORATION_DURATIONS)[number]

export const CONNECTION_PURPOSES = ['共同创业', '加入项目', '短期协作', '专业咨询', '认识交流', '其他'] as const
export type ConnectionPurpose = (typeof CONNECTION_PURPOSES)[number]
