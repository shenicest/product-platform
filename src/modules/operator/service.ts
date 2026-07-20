import { and, asc, count, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm'
import { auditRecords, projectEditProposals, projects } from '../../db/schema'
import type { Database } from '../../db'
import { ProposalStatus } from '../project/model'
import type { AuditRecordQuery, OperatorProjectQuery, OperatorProposalQuery } from './model'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function clampLimit(raw: number | undefined): number {
  const value = raw ?? DEFAULT_LIMIT
  return Math.max(1, Math.min(value, MAX_LIMIT))
}

export class OperatorService {
  constructor(private db: Database) {}

  async listProjects(query: OperatorProjectQuery) {
    const conditions = []
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
    for (const row of statusRows) byStatus[String(row.status)] = row.value

    const byStage: Record<string, number> = {}
    for (const row of stageRows) byStage[String(row.stage)] = row.value

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
