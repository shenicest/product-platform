import { and, count, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import { auditRecords, projectEditProposals, projects } from '../../db/schema'
import type { Database } from '../../db'
import { UserIdentityService } from '../user-identity/service'
import { Role } from '../user-identity/model'
import {
  AuditAction,
  DuplicateProposalError,
  EDITABLE_PROJECT_FIELD_SET,
  ForbiddenError,
  InvalidTransitionError,
  MissingRequiredFieldError,
  ProjectNotFoundError,
  ProjectStatus,
  ProposalNotFoundError,
  ProposalStatus,
  SUBMISSION_REQUIRED_FIELDS,
  ValidationError,
  type ProjectListQuery,
  type SubmissionRequiredField,
} from './model'

type ProjectRow = typeof projects.$inferSelect
type ProposalRow = typeof projectEditProposals.$inferSelect
type ProjectUpdate = Partial<typeof projects.$inferInsert>

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function clampLimit(raw: number | undefined): number {
  const value = raw ?? DEFAULT_LIMIT
  return Math.max(1, Math.min(value, MAX_LIMIT))
}

function validateChanges(changes: Record<string, unknown>): ValidationError | null {
  const keys = Object.keys(changes)
  if (keys.length === 0) return new ValidationError('changes must not be empty')
  const unknown = keys.filter((key) => !EDITABLE_PROJECT_FIELD_SET.has(key))
  if (unknown.length > 0) return new ValidationError(`Unknown field(s) in changes: ${unknown.join(', ')}`)
  return null
}

// Keeps only editable content fields so a direct write can never touch lifecycle
// columns (id, userId, status, timestamps) and bypass the state machine.
function pickEditable(data: Record<string, unknown>): ProjectUpdate {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(data)) {
    if (EDITABLE_PROJECT_FIELD_SET.has(key)) result[key] = data[key]
  }
  return result as ProjectUpdate
}

function isFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

// Returns the first required field that is empty (in form-display order), or null
// when the project is complete enough to submit. `betaDescription` is only required
// when the project is open for beta.
function findMissingRequiredField(project: ProjectRow): SubmissionRequiredField | 'betaDescription' | null {
  for (const field of SUBMISSION_REQUIRED_FIELDS) {
    if (isFieldEmpty(project[field])) return field
  }
  if (project.isOpenForBeta === true && isFieldEmpty(project.betaDescription)) return 'betaDescription'
  return null
}

export class ProjectService {
  constructor(private db: Database, private userIdentity: UserIdentityService) {}

  async getProject(projectId: number): Promise<ProjectRow | null> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
    return rows[0] ?? null
  }

  async getProposal(proposalId: number): Promise<ProposalRow | null> {
    const rows = await this.db.select().from(projectEditProposals).where(eq(projectEditProposals.id, proposalId)).limit(1)
    return rows[0] ?? null
  }

  async listProposals(projectId: number): Promise<ProposalRow[]> {
    return this.db
      .select()
      .from(projectEditProposals)
      .where(eq(projectEditProposals.projectId, projectId))
      .orderBy(desc(projectEditProposals.createdAt))
  }

  async listLiveProjects(query: ProjectListQuery) {
    const conditions = [eq(projects.status, ProjectStatus.Live)]
    if (query.stage !== undefined) conditions.push(eq(projects.stage, query.stage))
    if (query.category) {
      conditions.push(sql`JSON_CONTAINS(${projects.categories}, ${JSON.stringify(query.category)})`)
    }
    if (query.q) {
      const pattern = `%${query.q}%`
      conditions.push(or(like(projects.name, pattern), like(projects.contactName, pattern), like(projects.teamName, pattern))!)
    }
    const where = and(...conditions)

    const sortColumn = query.sort === 'recently_updated' ? projects.updatedAt : projects.createdAt
    const limit = clampLimit(query.limit)
    const offset = query.offset ?? 0

    const [data, totalRows] = await Promise.all([
      this.db.select().from(projects).where(where).orderBy(desc(sortColumn)).limit(limit).offset(offset),
      this.db.select({ value: count() }).from(projects).where(where),
    ])
    return { data, total: totalRows[0]?.value ?? 0 }
  }

  async getVisibleProject(userId: string | null, projectId: number): Promise<ProjectRow | ProjectNotFoundError> {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.status === ProjectStatus.Live) return project
    if (userId && project.userId === userId) return project
    if (userId && await this.userIdentity.hasRole(userId, Role.Operator)) return project
    return new ProjectNotFoundError(projectId)
  }

  async getProjectForProposals(userId: string, projectId: number): Promise<ProjectRow | ProjectNotFoundError | ForbiddenError> {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.userId === userId) return project
    if (await this.userIdentity.hasRole(userId, Role.Operator)) return project
    return new ForbiddenError()
  }

  async createProject(userId: string, data: Record<string, unknown>): Promise<ProjectRow> {
    const [result] = await this.db.insert(projects).values({
      ...pickEditable(data),
      userId,
      status: ProjectStatus.Draft,
    } as typeof projects.$inferInsert)
    // Creating a project makes the user a Founder. grantRole is an idempotent
    // upsert, so repeat creations by the same user are no-ops.
    await this.userIdentity.grantRole(userId, Role.Founder)
    return (await this.getProject(result.insertId))!
  }

  async saveDraft(projectId: number, data: Record<string, unknown>): Promise<ProjectRow | ProjectNotFoundError | InvalidTransitionError> {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.status !== ProjectStatus.Draft && project.status !== ProjectStatus.RevisionRequired) {
      return new InvalidTransitionError(`Cannot edit draft: project is in status ${project.status}, expected Draft or Revision Required`)
    }
    const updates = pickEditable(data)
    if (Object.keys(updates).length > 0) {
      await this.db.update(projects).set(updates).where(eq(projects.id, projectId))
    }
    return (await this.getProject(projectId))!
  }

  async submitForReview(projectId: number): Promise<ProjectRow | ProjectNotFoundError | InvalidTransitionError | MissingRequiredFieldError> {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.status !== ProjectStatus.Draft && project.status !== ProjectStatus.RevisionRequired) {
      return new InvalidTransitionError(`Cannot submit: project is in status ${project.status}, expected Draft or Revision Required`)
    }
    const missing = findMissingRequiredField(project)
    if (missing) return new MissingRequiredFieldError(missing)
    await this.db.update(projects).set({ status: ProjectStatus.PendingReview }).where(eq(projects.id, projectId))
    return (await this.getProject(projectId))!
  }

  async approveProject(operatorId: string, projectId: number): Promise<ProjectRow | ProjectNotFoundError | InvalidTransitionError> {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.status !== ProjectStatus.PendingReview) {
      return new InvalidTransitionError(`Cannot approve: project is in status ${project.status}, expected Pending Review`)
    }
    await this.db.transaction(async (tx) => {
      await tx.update(projects).set({ status: ProjectStatus.Live }).where(eq(projects.id, projectId))
      await tx.insert(auditRecords).values({
        projectId,
        operatorId,
        action: AuditAction.Approve,
        proposalId: null,
      })
    })
    return (await this.getProject(projectId))!
  }

  async requireProjectRevision(operatorId: string, projectId: number, reason: string): Promise<ProjectRow | ProjectNotFoundError | InvalidTransitionError> {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.status !== ProjectStatus.PendingReview) {
      return new InvalidTransitionError(`Cannot require revision: project is in status ${project.status}, expected Pending Review`)
    }
    await this.db.transaction(async (tx) => {
      await tx.update(projects).set({ status: ProjectStatus.RevisionRequired }).where(eq(projects.id, projectId))
      await tx.insert(auditRecords).values({
        projectId,
        operatorId,
        action: AuditAction.RequireRevision,
        proposalId: null,
        reason,
      })
    })
    return (await this.getProject(projectId))!
  }

  async rejectProject(operatorId: string, projectId: number, reason: string): Promise<ProjectRow | ProjectNotFoundError | InvalidTransitionError> {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.status !== ProjectStatus.PendingReview) {
      return new InvalidTransitionError(`Cannot reject: project is in status ${project.status}, expected Pending Review`)
    }
    await this.db.transaction(async (tx) => {
      await tx.update(projects).set({ status: ProjectStatus.Rejected }).where(eq(projects.id, projectId))
      await tx.insert(auditRecords).values({
        projectId,
        operatorId,
        action: AuditAction.Reject,
        proposalId: null,
        reason,
      })
    })
    return (await this.getProject(projectId))!
  }

  async delistProject(operatorId: string, projectId: number, reason: string): Promise<ProjectRow | ProjectNotFoundError | InvalidTransitionError> {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.status !== ProjectStatus.Live) {
      return new InvalidTransitionError(`Cannot delist: project is in status ${project.status}, expected Live`)
    }
    await this.db.transaction(async (tx) => {
      await tx.update(projects).set({ status: ProjectStatus.Delisted }).where(eq(projects.id, projectId))
      await tx.insert(auditRecords).values({
        projectId,
        operatorId,
        action: AuditAction.Delist,
        proposalId: null,
        reason,
      })
    })
    return (await this.getProject(projectId))!
  }

  async restoreProject(operatorId: string, projectId: number): Promise<ProjectRow | ProjectNotFoundError | InvalidTransitionError> {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.status !== ProjectStatus.Delisted) {
      return new InvalidTransitionError(`Cannot restore: project is in status ${project.status}, expected Delisted`)
    }
    await this.db.transaction(async (tx) => {
      await tx.update(projects).set({ status: ProjectStatus.Live }).where(eq(projects.id, projectId))
      await tx.insert(auditRecords).values({
        projectId,
        operatorId,
        action: AuditAction.Restore,
        proposalId: null,
      })
    })
    return (await this.getProject(projectId))!
  }

  async createProposal(projectId: number, changes: Record<string, unknown>): Promise<ProposalRow | ProjectNotFoundError | InvalidTransitionError | ValidationError | DuplicateProposalError> {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.status !== ProjectStatus.Live) {
      return new InvalidTransitionError(`Cannot create proposal: project is in status ${project.status}, expected Live`)
    }
    const invalid = validateChanges(changes)
    if (invalid) return invalid
    const existing = await this.db
      .select({ id: projectEditProposals.id })
      .from(projectEditProposals)
      .where(
        and(
          eq(projectEditProposals.projectId, projectId),
          inArray(projectEditProposals.status, [ProposalStatus.Pending, ProposalStatus.RevisionRequired]),
        ),
      )
      .limit(1)
    if (existing.length > 0) return new DuplicateProposalError(projectId)
    const [result] = await this.db.insert(projectEditProposals).values({
      projectId,
      changes,
      status: ProposalStatus.Pending,
    })
    return (await this.getProposal(result.insertId))!
  }

  async updateProposal(proposalId: number, changes: Record<string, unknown>): Promise<ProposalRow | ProposalNotFoundError | InvalidTransitionError | ValidationError> {
    const proposal = await this.getProposal(proposalId)
    if (!proposal) return new ProposalNotFoundError(proposalId)
    if (proposal.status !== ProposalStatus.RevisionRequired) {
      return new InvalidTransitionError(`Cannot update proposal: status is ${proposal.status}, expected Revision Required`)
    }
    const invalid = validateChanges(changes)
    if (invalid) return invalid
    await this.db
      .update(projectEditProposals)
      .set({ changes, status: ProposalStatus.Pending, reason: null })
      .where(eq(projectEditProposals.id, proposalId))
    return (await this.getProposal(proposalId))!
  }

  async approveProposal(operatorId: string, proposalId: number): Promise<ProposalRow | ProposalNotFoundError | InvalidTransitionError> {
    const proposal = await this.getProposal(proposalId)
    if (!proposal) return new ProposalNotFoundError(proposalId)
    if (proposal.status !== ProposalStatus.Pending) {
      return new InvalidTransitionError(`Cannot approve proposal: status is ${proposal.status}, expected Pending`)
    }
    const reviewedAt = new Date()
    await this.db.transaction(async (tx) => {
      await tx.update(projects).set(proposal.changes as ProjectUpdate).where(eq(projects.id, proposal.projectId))
      await tx
        .update(projectEditProposals)
        .set({ status: ProposalStatus.Approved, reviewedBy: operatorId, reviewedAt })
        .where(eq(projectEditProposals.id, proposalId))
      await tx.insert(auditRecords).values({
        projectId: proposal.projectId,
        operatorId,
        action: AuditAction.Approve,
        proposalId,
      })
    })
    return (await this.getProposal(proposalId))!
  }

  async rejectProposal(operatorId: string, proposalId: number, reason: string): Promise<ProposalRow | ProposalNotFoundError | InvalidTransitionError> {
    const proposal = await this.getProposal(proposalId)
    if (!proposal) return new ProposalNotFoundError(proposalId)
    if (proposal.status !== ProposalStatus.Pending) {
      return new InvalidTransitionError(`Cannot reject proposal: status is ${proposal.status}, expected Pending`)
    }
    const reviewedAt = new Date()
    await this.db.transaction(async (tx) => {
      await tx
        .update(projectEditProposals)
        .set({ status: ProposalStatus.Rejected, reviewedBy: operatorId, reviewedAt, reason })
        .where(eq(projectEditProposals.id, proposalId))
      await tx.insert(auditRecords).values({
        projectId: proposal.projectId,
        operatorId,
        action: AuditAction.Reject,
        proposalId,
        reason,
      })
    })
    return (await this.getProposal(proposalId))!
  }

  async requireProposalRevision(operatorId: string, proposalId: number, reason: string): Promise<ProposalRow | ProposalNotFoundError | InvalidTransitionError> {
    const proposal = await this.getProposal(proposalId)
    if (!proposal) return new ProposalNotFoundError(proposalId)
    if (proposal.status !== ProposalStatus.Pending) {
      return new InvalidTransitionError(`Cannot require revision on proposal: status is ${proposal.status}, expected Pending`)
    }
    const reviewedAt = new Date()
    await this.db.transaction(async (tx) => {
      await tx
        .update(projectEditProposals)
        .set({ status: ProposalStatus.RevisionRequired, reviewedBy: operatorId, reviewedAt, reason })
        .where(eq(projectEditProposals.id, proposalId))
      await tx.insert(auditRecords).values({
        projectId: proposal.projectId,
        operatorId,
        action: AuditAction.RequireRevision,
        proposalId,
        reason,
      })
    })
    return (await this.getProposal(proposalId))!
  }
}
