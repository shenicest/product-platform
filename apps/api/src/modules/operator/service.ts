import { and, asc, count, desc, eq, gte, like, lte, ne, or, sql } from 'drizzle-orm'
import { auditRecords, projectEditProposals, projects } from '../../db/schema'
import type { Database } from '../../db'
import {
  AuditAction,
  InvalidTransitionError,
  ProjectNotFoundError,
  ProjectStage,
  ProjectStatus,
} from '../project/model'
import { ProposalNotFoundError, ProposalStatus } from '../proposal/model'
import type { AuditRecordQuery, OperatorProjectQuery, OperatorProposalQuery } from './model'

type ProjectRow = typeof projects.$inferSelect
type ProposalRow = typeof projectEditProposals.$inferSelect
type ProjectUpdate = Partial<typeof projects.$inferInsert>

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function clampLimit(raw: number | undefined): number {
  const value = raw ?? DEFAULT_LIMIT
  return Math.max(1, Math.min(value, MAX_LIMIT))
}

const statusNameByValue = new Map<number, string>(
  Object.entries(ProjectStatus).map(([name, value]) => [value, name]),
)
const stageNameByValue = new Map<number, string>(
  Object.entries(ProjectStage).map(([name, value]) => [value, name]),
)

export class OperatorService {
  constructor(private db: Database) {}

  async getProject(projectId: number): Promise<ProjectRow | null> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
    return rows[0] ?? null
  }

  async getProposal(proposalId: number): Promise<ProposalRow | null> {
    const rows = await this.db.select().from(projectEditProposals).where(eq(projectEditProposals.id, proposalId)).limit(1)
    return rows[0] ?? null
  }

  // ── Project-level transitions ──────────────────────────────────────

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

  // ── Proposal-level transitions ─────────────────────────────────────

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

  // ── Management queries ─────────────────────────────────────────────

  async listProjects(query: OperatorProjectQuery) {
    const conditions = [ne(projects.status, ProjectStatus.Draft)]
    if (query.status !== undefined) conditions.push(eq(projects.status, query.status))
    if (query.stage !== undefined) conditions.push(eq(projects.stage, query.stage))
    if (query.category) {
      conditions.push(sql`JSON_CONTAINS(${projects.categories}, ${JSON.stringify(query.category)})`)
    }
    if (query.q) {
      const pattern = `%${query.q}%`
      conditions.push(or(like(projects.name, pattern), like(projects.contactName, pattern), like(projects.teamName, pattern)))
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined

    const sortColumn = query.sort === 'updated_at' ? projects.updatedAt : projects.createdAt
    const direction = query.order === 'asc' ? asc : desc
    const limit = clampLimit(query.limit)
    const offset = query.offset ?? 0

    const [data, totalRows] = await Promise.all([
      this.db.select().from(projects).where(where).orderBy(direction(sortColumn)).limit(limit).offset(offset),
      this.db.select({ value: count() }).from(projects).where(where),
    ])
    return { data, total: totalRows[0]?.value ?? 0 }
  }

  async listPendingProposals(query: OperatorProposalQuery) {
    const conditions = [eq(projectEditProposals.status, ProposalStatus.Pending)]
    if (query.projectId !== undefined) conditions.push(eq(projectEditProposals.projectId, query.projectId))

    const needsJoin = query.stage !== undefined || query.category !== undefined
    if (query.stage !== undefined) conditions.push(eq(projects.stage, query.stage))
    if (query.category) {
      conditions.push(sql`JSON_CONTAINS(${projects.categories}, ${JSON.stringify(query.category)})`)
    }

    const where = and(...conditions)
    const limit = clampLimit(query.limit)
    const offset = query.offset ?? 0

    if (needsJoin) {
      const [data, totalRows] = await Promise.all([
        this.db
          .select({
            id: projectEditProposals.id,
            projectId: projectEditProposals.projectId,
            changes: projectEditProposals.changes,
            status: projectEditProposals.status,
            reason: projectEditProposals.reason,
            reviewedBy: projectEditProposals.reviewedBy,
            reviewedAt: projectEditProposals.reviewedAt,
            createdAt: projectEditProposals.createdAt,
            updatedAt: projectEditProposals.updatedAt,
          })
          .from(projectEditProposals)
          .innerJoin(projects, eq(projectEditProposals.projectId, projects.id))
          .where(where)
          .orderBy(desc(projectEditProposals.createdAt))
          .limit(limit)
          .offset(offset),
        this.db
          .select({ value: count() })
          .from(projectEditProposals)
          .innerJoin(projects, eq(projectEditProposals.projectId, projects.id))
          .where(where),
      ])
      return { data, total: totalRows[0]?.value ?? 0 }
    }

    const [data, totalRows] = await Promise.all([
      this.db
        .select()
        .from(projectEditProposals)
        .where(where)
        .orderBy(desc(projectEditProposals.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(projectEditProposals).where(where),
    ])
    return { data, total: totalRows[0]?.value ?? 0 }
  }

  async listProjectProposals(projectId: number) {
    return this.db
      .select()
      .from(projectEditProposals)
      .where(eq(projectEditProposals.projectId, projectId))
      .orderBy(desc(projectEditProposals.createdAt))
  }

  async listAuditRecords(query: AuditRecordQuery) {
    const conditions = []
    if (query.projectId !== undefined) conditions.push(eq(auditRecords.projectId, query.projectId))
    if (query.from) conditions.push(gte(auditRecords.createdAt, new Date(query.from)))
    if (query.to) conditions.push(lte(auditRecords.createdAt, new Date(query.to)))
    const where = conditions.length > 0 ? and(...conditions) : undefined
    const limit = clampLimit(query.limit)
    const offset = query.offset ?? 0

    const [data, totalRows] = await Promise.all([
      this.db.select().from(auditRecords).where(where).orderBy(desc(auditRecords.createdAt)).limit(limit).offset(offset),
      this.db.select({ value: count() }).from(auditRecords).where(where),
    ])
    return { data, total: totalRows[0]?.value ?? 0 }
  }

  async getStats() {
    const [totalRows, statusRows, stageRows, categoryRows] = await Promise.all([
      this.db.select({ value: count() }).from(projects),
      this.db.select({ status: projects.status, value: count() }).from(projects).groupBy(projects.status),
      this.db.select({ stage: projects.stage, value: count() }).from(projects).groupBy(projects.stage),
      this.db.select({ categories: projects.categories }).from(projects),
    ])

    const byStatus: Record<string, number> = {}
    for (const row of statusRows) {
      byStatus[statusNameByValue.get(row.status) ?? String(row.status)] = row.value
    }

    const byStage: Record<string, number> = {}
    for (const row of stageRows) {
      if (row.stage === null) continue
      byStage[stageNameByValue.get(row.stage) ?? String(row.stage)] = row.value
    }

    const byCategory: Record<string, number> = {}
    for (const row of categoryRows) {
      if (!row.categories) continue
      for (const category of row.categories) {
        byCategory[category] = (byCategory[category] ?? 0) + 1
      }
    }

    return {
      totalProjects: totalRows[0]?.value ?? 0,
      byStatus,
      byStage,
      byCategory,
    }
  }
}
