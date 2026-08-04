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
