import { afterAll, describe, expect, it } from 'bun:test'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { auditRecords, projectEditProposals, projects, userIdentities } from '../../../src/db/schema'
import { ProjectService } from '../../../src/modules/project/service'
import { ProposalService } from '../../../src/modules/proposal/service'
import { OperatorService } from '../../../src/modules/operator/service'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { UserProfileService } from '../../../src/modules/user/service'
import {
  InvalidTransitionError,
  ProjectNotFoundError,
  ProjectStatus,
} from '../../../src/modules/project/model'
import {
  DuplicateProposalError,
  ProposalStatus,
  ValidationError,
} from '../../../src/modules/proposal/model'

const TEST_FOUNDER = `test-founder-${crypto.randomUUID()}`
const TEST_OPERATOR = `test-operator-${crypto.randomUUID()}`
const NONEXISTENT_ID = 2_000_000_000

const VALID_PROJECT: Record<string, unknown> = {
  name: 'Test Project',
  tagline: 'original tagline',
  categories: ['效率工具'],
  stage: 0,
  coverUrl: 'https://example.com/cover.png',
  description: 'original description',
  targetUsers: '目标用户说明，至少二十个字的内容。',
  userProblem: '用户遇到的问题说明，至少二十个字。',
  progress: '当前进展说明，至少二十个字的内容。',
  messageToUsers: '对用户说的话',
  isOpenForBeta: false,
  contactName: 'Tester',
  contactPhone: '13800138000',
}

describe('ProposalService', () => {
  const userIdentity = new UserIdentityService(db)
  const userProfile = new UserProfileService(db)
  const projectService = new ProjectService(db, userIdentity, userProfile)
  const service = new ProposalService(db, userIdentity)
  const operatorService = new OperatorService(db)
  const projectIds: number[] = []
  const founderIds: string[] = [TEST_FOUNDER]

  async function createLive(overrides: Record<string, unknown> = {}) {
    const project = await projectService.createProject(TEST_FOUNDER, { ...VALID_PROJECT, ...overrides })
    projectIds.push(project.id)
    await projectService.submitForReview(project.id)
    await operatorService.approveProject(TEST_OPERATOR, project.id)
    return (await projectService.getProject(project.id))!
  }

  afterAll(async () => {
    if (projectIds.length > 0) {
      await db.delete(auditRecords).where(inArray(auditRecords.projectId, projectIds))
      await db.delete(projectEditProposals).where(inArray(projectEditProposals.projectId, projectIds))
      await db.delete(projects).where(inArray(projects.id, projectIds))
    }
    if (founderIds.length > 0) {
      await db.delete(userIdentities).where(inArray(userIdentities.userId, founderIds))
    }
  })

  describe('proposal lifecycle (founder side)', () => {
    it('creates a pending proposal on a live project, leaving the project row untouched', async () => {
      const project = await createLive()
      const before = await projectService.getProject(project.id)
      const proposal = await service.createProposal(project.id, { description: 'proposed change' })
      expect(proposal).not.toBeInstanceOf(InvalidTransitionError)
      const row = proposal as { status: number; projectId: number; changes: Record<string, unknown> }
      expect(row.status).toBe(ProposalStatus.Pending)
      expect(row.projectId).toBe(project.id)
      expect(row.changes).toEqual({ description: 'proposed change' })
      const after = await projectService.getProject(project.id)
      expect(after!.description).toBe(before!.description)
      expect(after!.status).toBe(ProjectStatus.Live)
    })

    it('rejects creating a proposal on a non-live project', async () => {
      const project = await projectService.createProject(TEST_FOUNDER, { name: 'Draft' })
      projectIds.push(project.id)
      const result = await service.createProposal(project.id, { description: 'x' })
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects creating a proposal on a missing project', async () => {
      const result = await service.createProposal(NONEXISTENT_ID, { description: 'x' })
      expect(result).toBeInstanceOf(ProjectNotFoundError)
    })

    it('resubmit (3 → 0) updates the diff and returns to Pending', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'v1' })
      const proposalId = (proposal as { id: number }).id
      await operatorService.requireProposalRevision(TEST_OPERATOR, proposalId, 'clarify')
      const result = await service.updateProposal(proposalId, { description: 'v2' })
      const row = result as { status: number; changes: Record<string, unknown> }
      expect(row.status).toBe(ProposalStatus.Pending)
      expect(row.changes).toEqual({ description: 'v2' })
    })

    it('rejects updating a proposal that is not Revision Required', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'v1' })
      const result = await service.updateProposal((proposal as { id: number }).id, { description: 'v2' })
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })
  })

  describe('single pending/revision-required proposal constraint', () => {
    it('rejects a second proposal while one is Pending', async () => {
      const project = await createLive()
      await service.createProposal(project.id, { description: 'first' })
      const result = await service.createProposal(project.id, { description: 'second' })
      expect(result).toBeInstanceOf(DuplicateProposalError)
    })

    it('rejects a new proposal while one is Revision Required', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'first' })
      await operatorService.requireProposalRevision(TEST_OPERATOR, (proposal as { id: number }).id, 'fix')
      const result = await service.createProposal(project.id, { description: 'second' })
      expect(result).toBeInstanceOf(DuplicateProposalError)
    })

    it('allows a new proposal after the previous one is Approved', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'first' })
      await operatorService.approveProposal(TEST_OPERATOR, (proposal as { id: number }).id)
      const result = await service.createProposal(project.id, { description: 'second' })
      expect(result).not.toBeInstanceOf(DuplicateProposalError)
    })

    it('allows a new proposal after the previous one is Rejected', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'first' })
      await operatorService.rejectProposal(TEST_OPERATOR, (proposal as { id: number }).id, 'no')
      const result = await service.createProposal(project.id, { description: 'second' })
      expect(result).not.toBeInstanceOf(DuplicateProposalError)
    })
  })

  describe('diff key validation', () => {
    it('rejects an empty changes object', async () => {
      const project = await createLive()
      const result = await service.createProposal(project.id, {})
      expect(result).toBeInstanceOf(ValidationError)
    })

    it('rejects unknown fields', async () => {
      const project = await createLive()
      const result = await service.createProposal(project.id, { notAField: 'x' })
      expect(result).toBeInstanceOf(ValidationError)
    })

    it('rejects lifecycle fields (status is not editable)', async () => {
      const project = await createLive()
      const result = await service.createProposal(project.id, { status: ProjectStatus.Draft })
      expect(result).toBeInstanceOf(ValidationError)
    })

    it('rejects unknown fields on resubmit', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'v1' })
      const proposalId = (proposal as { id: number }).id
      await operatorService.requireProposalRevision(TEST_OPERATOR, proposalId, 'fix')
      const result = await service.updateProposal(proposalId, { bogus: 'x' })
      expect(result).toBeInstanceOf(ValidationError)
    })
  })
})
