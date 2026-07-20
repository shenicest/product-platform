import { t } from 'elysia'
import { InsertProject, SelectProject, SelectProjectEditProposal } from '../../db/schema'

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

export const AuditAction = {
  Approve: 'approve',
  RequireRevision: 'require_revision',
  Reject: 'reject',
  Delist: 'delist',
  Restore: 'restore',
} as const
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction]

// Content fields a Founder may edit. Pre-live these are written directly on the
// Project row; post-live they are the only keys allowed in a proposal `changes` diff.
// Lifecycle fields (id, userId, status, timestamps) are deliberately excluded.
export const EDITABLE_PROJECT_FIELDS = [
  'name',
  'tagline',
  'description',
  'coverUrl',
  'demoImages',
  'demoVideoUrl',
  'demoLink',
  'stage',
  'categories',
  'targetUsers',
  'userProblem',
  'progress',
  'nextSteps',
  'messageToUsers',
  'isOpenForBeta',
  'betaDescription',
  'contactName',
  'contactPhone',
  'contactEmail',
  'contactWechat',
  'teamName',
] as const
export type EditableProjectField = (typeof EDITABLE_PROJECT_FIELDS)[number]

export const EDITABLE_PROJECT_FIELD_SET = new Set<string>(EDITABLE_PROJECT_FIELDS)

export const ProjectChanges = t.Partial(t.Pick(InsertProject, [...EDITABLE_PROJECT_FIELDS]))
export type ProjectChanges = Partial<Pick<SelectProject, EditableProjectField>>

// Fields that must be filled before a Project can be submitted for review, ordered
// as the submission form displays them so the first missing field reported matches
// what the Founder sees. `betaDescription` is conditionally required when
// `isOpenForBeta` is true and is checked separately in the service.
export const SUBMISSION_REQUIRED_FIELDS = [
  'name',
  'tagline',
  'categories',
  'stage',
  'coverUrl',
  'description',
  'targetUsers',
  'userProblem',
  'progress',
  'messageToUsers',
  'isOpenForBeta',
  'contactName',
  'contactPhone',
] as const
export type SubmissionRequiredField = (typeof SUBMISSION_REQUIRED_FIELDS)[number]

// Create + save-draft body: `name` is required (the minimum field), every other
// editable field is optional so a Founder can fill the project in incrementally.
// `name` stays required because InsertProject marks the not-null column required.
export const ProjectDraftBody = t.Pick(InsertProject, [...EDITABLE_PROJECT_FIELDS])
export type ProjectDraftBody = typeof ProjectDraftBody.static

export const ProjectIdParams = t.Object({
  id: t.Numeric(),
})
export type ProjectIdParams = typeof ProjectIdParams.static

export const ProjectResponse = SelectProject
export type ProjectResponse = typeof ProjectResponse.static

export const FieldErrorResponse = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
    field: t.String(),
  }),
})
export type FieldErrorResponse = typeof FieldErrorResponse.static

export const ProposalListResponse = t.Object({
  data: t.Array(SelectProjectEditProposal),
  total: t.Number(),
})
export type ProposalListResponse = typeof ProposalListResponse.static

export class DomainError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = new.target.name
    this.code = code
  }
}

export class ProjectNotFoundError extends DomainError {
  constructor(projectId: number) {
    super('PROJECT_NOT_FOUND', `Project ${projectId} not found`)
  }
}

export class ProposalNotFoundError extends DomainError {
  constructor(proposalId: number) {
    super('PROPOSAL_NOT_FOUND', `Proposal ${proposalId} not found`)
  }
}

export class InvalidTransitionError extends DomainError {
  constructor(message: string) {
    super('INVALID_TRANSITION', message)
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message)
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION_ERROR', message)
  }
}

export class MissingRequiredFieldError extends DomainError {
  readonly field: string

  constructor(field: string) {
    super('MISSING_REQUIRED_FIELD', `Missing required field: ${field}`)
    this.field = field
  }
}

export class DuplicateProposalError extends DomainError {
  constructor(projectId: number) {
    super('DUPLICATE_PROPOSAL', `Project ${projectId} already has a pending or revision-required proposal`)
  }
}
