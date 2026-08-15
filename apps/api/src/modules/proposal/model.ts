import { t } from 'elysia'
import { InsertProject, SelectProject, SelectProjectEditProposal } from '../../db/schema'
import { DomainError, PROPOSAL_EDITABLE_PROJECT_FIELDS } from '../project/model'

export const ProposalStatus = {
  Pending: 0,
  Approved: 1,
  Rejected: 2,
  RevisionRequired: 3,
} as const
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus]

export const ProjectChanges = t.Partial(t.Pick(InsertProject, [...PROPOSAL_EDITABLE_PROJECT_FIELDS]))
export type ProjectChanges = Partial<Pick<SelectProject, (typeof PROPOSAL_EDITABLE_PROJECT_FIELDS)[number]>>

export const ProposalBody = t.Object({
  changes: ProjectChanges,
}, { description: 'Request body for creating or updating a proposal' })
export type ProposalBody = typeof ProposalBody.static

export const ProjectIdParams = t.Object({
  id: t.Numeric({ description: 'Project ID' }),
})
export type ProjectIdParams = typeof ProjectIdParams.static

export const ProposalIdParams = t.Object({
  id: t.Numeric({ description: 'Project ID' }),
  proposalId: t.Numeric({ description: 'Proposal ID' }),
})
export type ProposalIdParams = typeof ProposalIdParams.static

export const ProposalResponse = SelectProjectEditProposal
export type ProposalResponse = typeof ProposalResponse.static

export const ProposalListResponse = t.Object({
  data: t.Array(SelectProjectEditProposal),
  total: t.Number(),
})
export type ProposalListResponse = typeof ProposalListResponse.static

export class ProposalNotFoundError extends DomainError {
  constructor(proposalId: number) {
    super('PROPOSAL_NOT_FOUND', `Proposal ${proposalId} not found`)
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message)
  }
}

export class DuplicateProposalError extends DomainError {
  constructor(projectId: number) {
    super('DUPLICATE_PROPOSAL', `Project ${projectId} already has a pending or revision-required proposal`)
  }
}
