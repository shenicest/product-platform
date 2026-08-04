import { t } from 'elysia'
import { SelectAuditRecord, SelectProject, SelectProjectEditProposal } from '../../db/schema'
import { DomainError } from '../project/model'

export const FounderProjectQuery = t.Object({
  status: t.Optional(t.Numeric({ description: 'Filter by status: 0=Draft, 1=PendingReview, 2=RevisionRequired, 3=Live, 4=Delisted, 5=Rejected' })),
  stage: t.Optional(t.Numeric({ description: 'Filter by stage: 0=MVP, 1=Growth' })),
  q: t.Optional(t.String({ description: 'Keyword search on project name and tagline' })),
  offset: t.Optional(t.Numeric({ description: 'Number of records to skip (default: 0)' })),
  limit: t.Optional(t.Numeric({ description: 'Page size (default: 20)' })),
})
export type FounderProjectQuery = typeof FounderProjectQuery.static

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

export const StatsResponse = t.Object({
  totalProjects: t.Number({ description: 'Total number of projects owned by the founder' }),
  liveProjects: t.Number({ description: 'Number of Live (status=3) projects' }),
  pendingReviewProjects: t.Number({ description: 'Number of Pending Review (status=1) projects' }),
})
export type StatsResponse = typeof StatsResponse.static

export const AuditReasonResponse = t.Pick(SelectAuditRecord, ['action', 'reason', 'createdAt'])
export type AuditReasonResponse = typeof AuditReasonResponse.static

export class AuditReasonNotFoundError extends DomainError {
  constructor(projectId: number) {
    super('AUDIT_REASON_NOT_FOUND', `No audit reason found for project ${projectId}`)
  }
}
