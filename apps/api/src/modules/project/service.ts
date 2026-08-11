import { and, count, desc, eq, like, or, sql } from 'drizzle-orm'
import { follows, projects } from '../../db/schema'
import type { Database } from '../../db'
import { UserIdentityService } from '../user-identity/service'
import { Role } from '../user-identity/model'
import { UserProfileService } from '../user/service'
import type { PublicFounder } from '../user/model'
import {
  EDITABLE_PROJECT_FIELD_SET,
  InvalidTransitionError,
  MissingRequiredFieldError,
  ProjectNotFoundError,
  ProjectStatus,
  SUBMISSION_REQUIRED_FIELDS,
  type ProjectListQuery,
  type SubmissionRequiredField,
} from './model'

type ProjectRow = typeof projects.$inferSelect
type ProjectUpdate = Partial<typeof projects.$inferInsert>

export type ProjectDetail = ProjectRow & { founder: PublicFounder | null }

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function clampLimit(raw: number | undefined): number {
  const value = raw ?? DEFAULT_LIMIT
  return Math.max(1, Math.min(value, MAX_LIMIT))
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
  constructor(
    private db: Database,
    private userIdentity: UserIdentityService,
    private userProfile: UserProfileService,
  ) {}

  async getProject(projectId: number): Promise<ProjectRow | null> {
    const rows = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1)
    return rows[0] ?? null
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

  // Public detail view: the visible project enriched with the founder's public
  // profile (null when the founder has none).
  async getProjectDetail(userId: string | null, projectId: number): Promise<ProjectDetail | ProjectNotFoundError> {
    const project = await this.getVisibleProject(userId, projectId)
    if (project instanceof ProjectNotFoundError) return project
    const [profile, followerRows] = await Promise.all([
      this.userProfile.getPublicProfile(project.userId),
      this.db.select({ value: count() }).from(follows).where(eq(follows.followeeUserId, project.userId)),
    ])
    const founder = profile ? { ...profile, userId: project.userId, followerCount: followerRows[0]?.value ?? 0 } : null
    return { ...project, founder }
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
    if (project.status !== ProjectStatus.Draft && project.status !== ProjectStatus.PendingReview && project.status !== ProjectStatus.RevisionRequired) {
      return new InvalidTransitionError(`Cannot edit draft: project is in status ${project.status}, expected Draft, Pending Review, or Revision Required`)
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
}
