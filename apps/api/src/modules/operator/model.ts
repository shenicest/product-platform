import { t } from 'elysia'
import { SelectAuditRecord, SelectProject, SelectProjectEditProposal } from '../../db/schema'

export const ProposalResponse = SelectProjectEditProposal
export type ProposalResponse = typeof ProposalResponse.static

export const ReviewReasonBody = t.Object({
  reason: t.String({ minLength: 1, description: "Operator's reason for the action (shown to the founder)" }),
})
export type ReviewReasonBody = typeof ReviewReasonBody.static

export const ProposalIdParams = t.Object({
  proposalId: t.Numeric({ description: 'Proposal ID' }),
})
export type ProposalIdParams = typeof ProposalIdParams.static

export const OperatorProjectQuery = t.Object({
  status: t.Optional(t.Numeric({ description: 'Filter by status: 0=Draft, 1=PendingReview, 2=RevisionRequired, 3=Live, 4=Delisted, 5=Rejected' })),
  stage: t.Optional(t.Numeric({ description: 'Filter by stage: 0=Idea, 1=Prototype, 2=Mvp, 3=Launched, 4=Revenue' })),
  category: t.Optional(t.String({ description: 'Filter by category name' })),
  q: t.Optional(t.String({ description: 'Keyword search on project name and founder name' })),
  sort: t.Optional(t.Union([t.Literal('created_at'), t.Literal('updated_at')], { description: 'Sort field (default: created_at)' })),
  order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')], { description: 'Sort direction (default: desc)' })),
  offset: t.Optional(t.Numeric({ description: 'Number of records to skip (default: 0)' })),
  limit: t.Optional(t.Numeric({ description: 'Page size (default: 20)' })),
})
export type OperatorProjectQuery = typeof OperatorProjectQuery.static

export const OperatorProposalQuery = t.Object({
  projectId: t.Optional(t.Numeric({ description: 'Filter by project ID' })),
  stage: t.Optional(t.Numeric({ description: 'Filter by project stage: 0=Idea, 1=Prototype, 2=Mvp, 3=Launched, 4=Revenue' })),
  category: t.Optional(t.String({ description: 'Filter by project category' })),
  offset: t.Optional(t.Numeric({ description: 'Number of records to skip (default: 0)' })),
  limit: t.Optional(t.Numeric({ description: 'Page size (default: 20)' })),
})
export type OperatorProposalQuery = typeof OperatorProposalQuery.static

export const AuditRecordQuery = t.Object({
  projectId: t.Optional(t.Numeric({ description: 'Filter by project ID' })),
  from: t.Optional(t.String({ description: 'Start of time range (ISO 8601, inclusive)' })),
  to: t.Optional(t.String({ description: 'End of time range (ISO 8601, inclusive)' })),
  offset: t.Optional(t.Numeric({ description: 'Number of records to skip (default: 0)' })),
  limit: t.Optional(t.Numeric({ description: 'Page size (default: 20)' })),
})
export type AuditRecordQuery = typeof AuditRecordQuery.static

export const ProjectListResponse = t.Object({
  data: t.Array(SelectProject),
  total: t.Number(),
})
export type ProjectListResponse = typeof ProjectListResponse.static

export const ProposalListResponse = t.Object({
  data: t.Array(SelectProjectEditProposal),
  total: t.Number(),
})
export type ProposalListResponse = typeof ProposalListResponse.static

export const AuditRecordListResponse = t.Object({
  data: t.Array(SelectAuditRecord),
  total: t.Number(),
})
export type AuditRecordListResponse = typeof AuditRecordListResponse.static

export const MAX_FEATURED_PROJECTS = 50

export const FeaturedProjectIdsBody = t.Object({
  projectIds: t.Array(t.Numeric({ minimum: 1 }), {
    maxItems: MAX_FEATURED_PROJECTS,
    uniqueItems: true,
    description: 'Ordered list of Live project IDs to feature on the homepage. Replaces the existing configuration; an empty array clears it.',
  }),
})
export type FeaturedProjectIdsBody = typeof FeaturedProjectIdsBody.static

export const FeaturedProjectItem = t.Composite([
  SelectProject,
  t.Object({
    sortOrder: t.Number({ description: 'Position in the featured list (0-based)' }),
  }),
])
export type FeaturedProjectItem = typeof FeaturedProjectItem.static

export const FeaturedProjectListResponse = t.Object({
  data: t.Array(FeaturedProjectItem),
  total: t.Number(),
})
export type FeaturedProjectListResponse = typeof FeaturedProjectListResponse.static

export class FeaturedProjectValidationError extends Error {
  readonly code = 'INVALID_FEATURED_PROJECT'

  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export const StatsResponse = t.Object({
  totalProjects: t.Number({ description: 'Total number of projects on the platform' }),
  byStatus: t.Record(t.String(), t.Number(), { description: 'Project count keyed by status name (Draft, PendingReview, RevisionRequired, Live, Delisted, Rejected)' }),
  byStage: t.Record(t.String(), t.Number(), { description: 'Project count keyed by stage name (Idea, Prototype, Mvp, Launched, Revenue)' }),
  byCategory: t.Record(t.String(), t.Number(), { description: 'Project count keyed by category name' }),
})
export type StatsResponse = typeof StatsResponse.static
