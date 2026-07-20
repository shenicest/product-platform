import { t } from 'elysia'
import { InsertProject, SelectProject } from '../../db/schema'

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

export class DuplicateProposalError extends DomainError {
  constructor(projectId: number) {
    super('DUPLICATE_PROPOSAL', `Project ${projectId} already has a pending or revision-required proposal`)
  }
}
