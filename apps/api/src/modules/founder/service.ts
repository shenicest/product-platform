import { and, count, desc, eq, inArray, isNull, like, or } from 'drizzle-orm'
import { auditRecords, projectEditProposals, projects } from '../../db/schema'
import type { Database } from '../../db'
import { AuditAction, ForbiddenError, ProjectNotFoundError, ProjectStatus } from '../project/model'
import { AuditReasonNotFoundError, type FounderProjectQuery } from './model'

type ProjectRow = typeof projects.$inferSelect

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function clampLimit(raw: number | undefined): number {
  const value = raw ?? DEFAULT_LIMIT
  return Math.max(1, Math.min(value, MAX_LIMIT))
}

// Project-level operator actions that carry a founder-facing reason for a project's
// current state (revision required / rejected / delisted). Proposal-level records
// (proposalId set) are excluded — those don't change the project's own status.
const REASON_ACTIONS: AuditAction[] = [AuditAction.RequireRevision, AuditAction.Reject, AuditAction.Delist]

export class FounderService {
  constructor(private db: Database) {}

  async listProjects(userId: string, query: FounderProjectQuery) {
    const conditions = [eq(projects.userId, userId)]
    if (query.status !== undefined) conditions.push(eq(projects.status, query.status))
    if (query.stage !== undefined) conditions.push(eq(projects.stage, query.stage))
    if (query.q) {
      const pattern = `%${query.q}%`
      conditions.push(or(like(projects.name, pattern), like(projects.tagline, pattern))!)
    }
    const where = and(...conditions)
    const limit = clampLimit(query.limit)
    const offset = query.offset ?? 0

    const [data, totalRows] = await Promise.all([
      this.db.select().from(projects).where(where).orderBy(desc(projects.updatedAt)).limit(limit).offset(offset),
      this.db.select({ value: count() }).from(projects).where(where),
    ])
    return { data, total: totalRows[0]?.value ?? 0 }
  }

  async getStats(userId: string) {
    const rows = await this.db
      .select({ status: projects.status, value: count() })
      .from(projects)
      .where(eq(projects.userId, userId))
      .groupBy(projects.status)

    let totalProjects = 0
    let liveProjects = 0
    let pendingReviewProjects = 0
    for (const row of rows) {
      totalProjects += row.value
      if (row.status === ProjectStatus.Live) liveProjects = row.value
      else if (row.status === ProjectStatus.PendingReview) pendingReviewProjects = row.value
    }
    return { totalProjects, liveProjects, pendingReviewProjects }
  }

  async getOwnedProject(userId: string, projectId: number): Promise<ProjectRow | ProjectNotFoundError | ForbiddenError> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
    const project = rows[0]
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.userId !== userId) return new ForbiddenError()
    return project
  }

  async getAuditReason(userId: string, projectId: number) {
    const owned = await this.getOwnedProject(userId, projectId)
    if (owned instanceof ProjectNotFoundError) return owned
    if (owned instanceof ForbiddenError) return owned

    const rows = await this.db
      .select({
        action: auditRecords.action,
        reason: auditRecords.reason,
        createdAt: auditRecords.createdAt,
      })
      .from(auditRecords)
      .where(
        and(
          eq(auditRecords.projectId, projectId),
          isNull(auditRecords.proposalId),
          inArray(auditRecords.action, REASON_ACTIONS),
        ),
      )
      // `id` breaks ties when multiple records share the same second-precision timestamp.
      .orderBy(desc(auditRecords.createdAt), desc(auditRecords.id))
      .limit(1)
    const record = rows[0]
    if (!record) return new AuditReasonNotFoundError(projectId)
    return record
  }

  async listProposals(userId: string, projectId: number) {
    const owned = await this.getOwnedProject(userId, projectId)
    if (owned instanceof ProjectNotFoundError) return owned
    if (owned instanceof ForbiddenError) return owned

    const data = await this.db
      .select()
      .from(projectEditProposals)
      .where(eq(projectEditProposals.projectId, projectId))
      .orderBy(desc(projectEditProposals.createdAt))
    return { data, total: data.length }
  }
}
