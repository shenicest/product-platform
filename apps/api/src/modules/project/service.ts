import { and, asc, count, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import { featuredProjects, follows, projects } from '../../db/schema'
import type { Database } from '../../db'
import { UserIdentityService } from '../user-identity/service'
import { Role } from '../user-identity/model'
import { CATEGORIES, ProjectStage } from '@shenicest/shared'
import { UserProfileService } from '../user/service'
import type { PublicFounder } from '../user/model'
import {
  EDITABLE_PROJECT_FIELD_SET,
  InvalidTransitionError,
  MissingRequiredFieldError,
  PRIVATE_CONTACT_FIELDS,
  ProjectNotFoundError,
  ProjectStatus,
  SUBMISSION_REQUIRED_FIELDS,
  type ProjectListQuery,
  type SubmissionRequiredField,
} from './model'

type ProjectRow = typeof projects.$inferSelect
type ProjectUpdate = Partial<typeof projects.$inferInsert>

export type ProjectDetail = ProjectRow & { founder: PublicFounder | null }
export type ProjectListItem = ProjectRow & { founder: Awaited<ReturnType<UserProfileService['getPublicProfile']>> }

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

// Contact fields are private (ADR-0012): returns a copy of the row with the
// contact fields nulled out. Used for public list/detail responses whenever the
// viewer is neither the Owner nor an Operator.
function hideContacts<T extends ProjectRow>(project: T): T {
  const hidden = { ...project }
  for (const field of PRIVATE_CONTACT_FIELDS) hidden[field] = null
  return hidden
}

function isFieldEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

function isValidUrl(value: unknown): boolean {
  if (isFieldEmpty(value)) return true
  try {
    const url = new URL(String(value))
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function invalidField(field: string, message: string) {
  return new MissingRequiredFieldError(field, message, 'INVALID_FIELD')
}

// Returns the first submission-blocking problem (in form-display order), or null
// when the project is complete enough to submit. Length rules live in the
// frontend; the backend only enforces required fields, the contact at-least-one
// rule, enum membership, and http(s) URL format (an XSS boundary for rendered
// links, not a length rule). `betaDescription` is only required when the project
// is open for beta.
export function validateProjectForSubmission(project: ProjectRow): MissingRequiredFieldError | null {
  for (const field of SUBMISSION_REQUIRED_FIELDS) {
    if (isFieldEmpty(project[field])) return new MissingRequiredFieldError(field)
  }

  if (!Object.values(ProjectStage).includes(project.stage as ProjectStage)) {
    return invalidField('stage', '请选择正确的项目阶段')
  }
  if (!project.categories?.every((category) => CATEGORIES.includes(category as typeof CATEGORIES[number]))) {
    return invalidField('categories', '请选择正确的项目品类')
  }
  if (
    isFieldEmpty(project.contactPhone) &&
    isFieldEmpty(project.contactEmail) &&
    isFieldEmpty(project.contactWechat)
  ) {
    // Reported against the first contact channel so the form can map the error
    // back to a concrete field.
    return new MissingRequiredFieldError('contactPhone', '请至少填写一种联系方式（电话/邮箱/微信）')
  }
  for (const field of ['coverUrl', 'demoVideoUrl', 'demoLink'] as const) {
    if (!isValidUrl(project[field])) return invalidField(field, '请输入正确的链接')
  }
  if (project.demoImages && (project.demoImages.length > 5 || project.demoImages.some((url) => !isValidUrl(url)))) {
    return invalidField('demoImages', 'Demo图片最多上传5张，且地址必须有效')
  }
  if (project.isOpenForBeta === true && isFieldEmpty(project.betaDescription)) {
    return new MissingRequiredFieldError('betaDescription')
  }
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
    return this.listLiveProjectsForFounders(query)
  }

  // Operator-curated homepage list. Entries whose project is no longer Live
  // are skipped (not deleted) so the config survives a temporary delist.
  async listFeaturedLiveProjects() {
    const rows = await this.db
      .select({ project: projects })
      .from(featuredProjects)
      .innerJoin(projects, eq(featuredProjects.projectId, projects.id))
      .where(eq(projects.status, ProjectStatus.Live))
      .orderBy(asc(featuredProjects.sortOrder), asc(featuredProjects.id))
    const data = await Promise.all(rows.map(async ({ project }): Promise<ProjectListItem> => ({
      ...hideContacts(project),
      founder: await this.userProfile.getPublicProfile(project.userId),
    })))
    return { data, total: data.length }
  }

  async listFollowingLiveProjects(followerUserId: string, query: ProjectListQuery) {
    const followedFounders = await this.db.select({ userId: follows.followeeUserId }).from(follows)
      .where(eq(follows.followerUserId, followerUserId))
    return this.listLiveProjectsForFounders(query, followedFounders.map(({ userId }) => userId))
  }

  private async listLiveProjectsForFounders(query: ProjectListQuery, founderUserIds?: string[]) {
    if (founderUserIds?.length === 0) return { data: [], total: 0 }

    const conditions = [eq(projects.status, ProjectStatus.Live)]
    if (founderUserIds) conditions.push(inArray(projects.userId, founderUserIds))
    if (query.stage !== undefined) conditions.push(eq(projects.stage, query.stage))
    if (query.category) {
      conditions.push(sql`JSON_CONTAINS(${projects.categories}, ${JSON.stringify(query.category)})`)
    }
    if (query.q) {
      const pattern = `%${query.q}%`
      // contactName is private (ADR-0012), so the public keyword search only
      // covers name and teamName.
      conditions.push(or(like(projects.name, pattern), like(projects.teamName, pattern))!)
    }
    const where = and(...conditions)

    const sortColumn = query.sort === 'recently_updated' ? projects.updatedAt : projects.createdAt
    const limit = clampLimit(query.limit)
    const offset = query.offset ?? 0

    const [projectsList, totalRows] = await Promise.all([
      this.db.select().from(projects).where(where).orderBy(desc(sortColumn)).limit(limit).offset(offset),
      this.db.select({ value: count() }).from(projects).where(where),
    ])
    const data = await Promise.all(projectsList.map(async (project): Promise<ProjectListItem> => ({
      ...hideContacts(project),
      founder: await this.userProfile.getPublicProfile(project.userId),
    })))
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
  // profile (null when the founder has none). Contact fields stay visible only
  // to the Owner and Operators; everyone else gets them nulled out (ADR-0012).
  async getProjectDetail(userId: string | null, projectId: number): Promise<ProjectDetail | ProjectNotFoundError> {
    const project = await this.getVisibleProject(userId, projectId)
    if (project instanceof ProjectNotFoundError) return project
    const viewerIsPrivileged =
      (userId !== null && project.userId === userId) ||
      (userId !== null && await this.userIdentity.hasRole(userId, Role.Operator))
    const [profile, followerRows] = await Promise.all([
      this.userProfile.getPublicProfile(project.userId),
      this.db.select({ value: count() }).from(follows).where(eq(follows.followeeUserId, project.userId)),
    ])
    const founder = profile ? { ...profile, userId: project.userId, followerCount: followerRows[0]?.value ?? 0 } : null
    return { ...(!viewerIsPrivileged ? hideContacts(project) : project), founder }
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
    const validationError = validateProjectForSubmission(project)
    if (validationError) return validationError
    await this.db.update(projects).set({ status: ProjectStatus.PendingReview }).where(eq(projects.id, projectId))
    return (await this.getProject(projectId))!
  }
}
