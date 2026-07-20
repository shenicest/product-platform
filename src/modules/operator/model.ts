import { t } from 'elysia'
import { SelectAuditRecord, SelectProject, SelectProjectEditProposal } from '../../db/schema'

export const ProposalResponse = SelectProjectEditProposal
export type ProposalResponse = typeof ProposalResponse.static

export const ReviewReasonBody = t.Object({
  reason: t.String({ minLength: 1 }),
})
export type ReviewReasonBody = typeof ReviewReasonBody.static

export const ProposalIdParams = t.Object({
  proposalId: t.Numeric(),
})
export type ProposalIdParams = typeof ProposalIdParams.static

export const OperatorProjectQuery = t.Object({
  status: t.Optional(t.Numeric()),
  stage: t.Optional(t.Numeric()),
  category: t.Optional(t.String()),
  q: t.Optional(t.String()),
  sort: t.Optional(t.Union([t.Literal('created_at'), t.Literal('updated_at')])),
  order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
  offset: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
})
export type OperatorProjectQuery = typeof OperatorProjectQuery.static

export const OperatorProposalQuery = t.Object({
  projectId: t.Optional(t.Numeric()),
  stage: t.Optional(t.Numeric()),
  category: t.Optional(t.String()),
  offset: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
})
export type OperatorProposalQuery = typeof OperatorProposalQuery.static

export const AuditRecordQuery = t.Object({
  projectId: t.Optional(t.Numeric()),
  from: t.Optional(t.String()),
  to: t.Optional(t.String()),
  offset: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
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

export const StatsResponse = t.Object({
  totalProjects: t.Number(),
  byStatus: t.Record(t.String(), t.Number()),
  byStage: t.Record(t.String(), t.Number()),
  byCategory: t.Record(t.String(), t.Number()),
})
export type StatsResponse = typeof StatsResponse.static
