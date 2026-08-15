import { and, desc, eq, inArray } from 'drizzle-orm'
import { projectEditProposals, projects } from '../../db/schema'
import type { Database } from '../../db'
import { UserIdentityService } from '../user-identity/service'
import { Role } from '../user-identity/model'
import {
  PROPOSAL_EDITABLE_PROJECT_FIELD_SET,
  ForbiddenError,
  InvalidTransitionError,
  ProjectNotFoundError,
  ProjectStatus,
} from '../project/model'
import {
  DuplicateProposalError,
  ProposalNotFoundError,
  ProposalStatus,
  ValidationError,
} from './model'

type ProposalRow = typeof projectEditProposals.$inferSelect

function validateChanges(changes: Record<string, unknown>): ValidationError | null {
  const keys = Object.keys(changes)
  if (keys.length === 0) return new ValidationError('changes must not be empty')
  const unknown = keys.filter((key) => !PROPOSAL_EDITABLE_PROJECT_FIELD_SET.has(key))
  if (unknown.length > 0) return new ValidationError(`Unknown field(s) in changes: ${unknown.join(', ')}`)
  if ('description' in changes) {
    const length = typeof changes.description === 'string' ? [...changes.description.trim()].length : 0
    if (length < 100 || length > 2000) return new ValidationError('项目介绍至少100字，至多2000字')
  }
  if ('demoLink' in changes && changes.demoLink !== null && changes.demoLink !== '') {
    try {
      const url = new URL(String(changes.demoLink))
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return new ValidationError('请输入正确的链接')
    } catch {
      return new ValidationError('请输入正确的链接')
    }
  }
  if ('betaDescription' in changes && typeof changes.betaDescription !== 'string') {
    return new ValidationError('内测说明格式不正确')
  }
  return null
}

export class ProposalService {
  constructor(private db: Database, private userIdentity: UserIdentityService) {}

  async getProject(projectId: number) {
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

  async getProjectForProposals(userId: string, projectId: number) {
    const project = await this.getProject(projectId)
    if (!project) return new ProjectNotFoundError(projectId)
    if (project.userId === userId) return project
    if (await this.userIdentity.hasRole(userId, Role.Operator)) return project
    return new ForbiddenError()
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
}
