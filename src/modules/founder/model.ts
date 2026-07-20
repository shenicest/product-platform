import { t } from 'elysia'
import { SelectAuditRecord, SelectProject, SelectProjectEditProposal } from '../../db/schema'
import { DomainError } from '../project/model'

export const FounderProjectQuery = t.Object({
  status: t.Optional(t.Numeric()),
  stage: t.Optional(t.Numeric()),
  q: t.Optional(t.String()),
  offset: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
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
  totalProjects: t.Number(),
  liveProjects: t.Number(),
  pendingReviewProjects: t.Number(),
})
export type StatsResponse = typeof StatsResponse.static

export const AuditReasonResponse = t.Pick(SelectAuditRecord, ['action', 'reason', 'createdAt'])
export type AuditReasonResponse = typeof AuditReasonResponse.static

export class AuditReasonNotFoundError extends DomainError {
  constructor(projectId: number) {
    super('AUDIT_REASON_NOT_FOUND', `No audit reason found for project ${projectId}`)
  }
}
