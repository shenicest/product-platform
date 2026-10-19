import { t } from 'elysia'
import { InsertProject, SelectProject } from '../../db/schema'
import { PublicFounder, PublicProfile } from '../user/model'
import { CATEGORIES, MAX_SEEKING_SKILLS, ProjectStage, TALENT_SKILLS } from '@shenicest/shared'

// Domain enum lives in @shenicest/shared (single source of truth); re-exported
// here so module-internal consumers keep a stable import path.
export { ProjectStage }

export const ProjectStatus = {
  Draft: 0,
  PendingReview: 1,
  RevisionRequired: 2,
  Live: 3,
  Delisted: 4,
  Rejected: 5,
} as const
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus]

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
  'coverUrl',
  'demoImages',
  'demoVideoUrl',
  'demoLink',
  'stage',
  'categories',
  'problemStatement',
  'progress',
  'nextSteps',
  'differentiation',
  'businessModel',
  'userCount',
  'monthlyRevenue',
  'retentionRate',
  'seekingSkills',
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

// Private contact fields: visible only to the Owner and Operators. The service
// nulls these out in public list/detail responses for any other viewer (ADR-0012).
export const PRIVATE_CONTACT_FIELDS = [
  'contactName',
  'contactPhone',
  'contactEmail',
  'contactWechat',
] as const

// Post-live proposals may only touch these four fields (ADR-0012).
export const PROPOSAL_EDITABLE_PROJECT_FIELDS = [
  'problemStatement',
  'nextSteps',
  'demoLink',
  'betaDescription',
] as const
export const PROPOSAL_EDITABLE_PROJECT_FIELD_SET = new Set<string>(PROPOSAL_EDITABLE_PROJECT_FIELDS)

// Fields that must be filled before a Project can be submitted for review, ordered
// as the submission form displays them so the first missing field reported matches
// what the Founder sees. `betaDescription` is conditionally required when
// `isOpenForBeta` is true and is checked separately in the service; the contact
// at-least-one rule (phone/email/wechat) is also checked separately.
export const SUBMISSION_REQUIRED_FIELDS = [
  'name',
  'tagline',
  'categories',
  'stage',
  'problemStatement',
  'nextSteps',
  'coverUrl',
  'contactName',
] as const
export type SubmissionRequiredField = (typeof SUBMISSION_REQUIRED_FIELDS)[number]

// Create + save-draft body: `name` is required (the minimum field), every other
// editable field is optional so a Founder can fill the project in incrementally.
// `name` stays required because InsertProject marks the not-null column required.
const ProjectDraftBase = t.Omit(t.Pick(InsertProject, [...EDITABLE_PROJECT_FIELDS]), ['stage', 'categories', 'seekingSkills'])
export const ProjectDraftBody = t.Intersect([
  ProjectDraftBase,
  t.Object({
    stage: t.Optional(t.Union([
      t.Literal(ProjectStage.Idea),
      t.Literal(ProjectStage.Prototype),
      t.Literal(ProjectStage.Mvp),
      t.Literal(ProjectStage.Launched),
      t.Literal(ProjectStage.Revenue),
      t.Null(),
    ])),
    categories: t.Optional(t.Union([
      t.Array(t.Union(CATEGORIES.map((category) => t.Literal(category))), { uniqueItems: true }),
      t.Null(),
    ])),
    seekingSkills: t.Optional(t.Union([
      t.Array(t.Union(TALENT_SKILLS.map((skill) => t.Literal(skill))), { uniqueItems: true, maxItems: MAX_SEEKING_SKILLS }),
      t.Null(),
    ])),
  }),
])
export type ProjectDraftBody = typeof ProjectDraftBody.static

export const ProjectIdParams = t.Object({
  id: t.Numeric({ description: 'Project ID' }),
})
export type ProjectIdParams = typeof ProjectIdParams.static

export const ProjectResponse = SelectProject
export type ProjectResponse = typeof ProjectResponse.static

// Public detail view: the project row plus the founder's public profile from
// the shared users table (null when the founder has no profile there).
// t.Composite (not t.Intersect): Elysia's response serializer only understands
// plain object schemas, and Composite merges into one.
export const ProjectDetailResponse = t.Composite([
  SelectProject,
  t.Object({
    founder: t.Union([PublicFounder, t.Null()], { description: 'Founder public profile; null when unavailable' }),
  }),
])
export type ProjectDetailResponse = typeof ProjectDetailResponse.static

export const FieldErrorResponse = t.Object({
  error: t.Object({
    code: t.String({ description: 'Error code, e.g. MISSING_REQUIRED_FIELD' }),
    message: t.String({ description: 'Human-readable error message' }),
    field: t.String({ description: 'Name of the first missing required field' }),
  }),
})
export type FieldErrorResponse = typeof FieldErrorResponse.static

export const ProjectListQuery = t.Object({
  category: t.Optional(t.String({ description: 'Filter by category name' })),
  stage: t.Optional(t.Numeric({ description: 'Filter by stage: 0=Idea, 1=Prototype, 2=Mvp, 3=Launched, 4=Revenue' })),
  q: t.Optional(t.String({ description: 'Keyword search on project name and tagline' })),
  sort: t.Optional(t.Union([t.Literal('latest'), t.Literal('recently_updated')], { description: 'Sort order (default: latest)' })),
  offset: t.Optional(t.Numeric({ minimum: 0, description: 'Number of records to skip (default: 0)' })),
  limit: t.Optional(t.Numeric({ minimum: 1, description: 'Page size (default: 20)' })),
})
export type ProjectListQuery = typeof ProjectListQuery.static

export const ProjectListResponse = t.Object({
  data: t.Array(t.Composite([
    SelectProject,
    t.Object({
      founder: t.Union([PublicProfile, t.Null()], { description: 'Founder public profile for list cards; null when unavailable' }),
    }),
  ])),
  total: t.Number(),
})
export type ProjectListResponse = typeof ProjectListResponse.static

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

export class MissingRequiredFieldError extends DomainError {
  readonly field: string

  constructor(field: string, message = `Missing required field: ${field}`, code = 'MISSING_REQUIRED_FIELD') {
    super(code, message)
    this.field = field
  }
}
