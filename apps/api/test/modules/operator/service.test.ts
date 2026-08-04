import { afterAll, describe, expect, it } from 'bun:test'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { auditRecords, projectEditProposals, projects, userIdentities } from '../../../src/db/schema'
import { OperatorService } from '../../../src/modules/operator/service'
import { ProjectService } from '../../../src/modules/project/service'
import { ProposalService } from '../../../src/modules/proposal/service'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import {
  InvalidTransitionError,
  ProjectNotFoundError,
  ProjectStatus,
} from '../../../src/modules/project/model'
import { ProposalNotFoundError, ProposalStatus } from '../../../src/modules/proposal/model'

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

describe('OperatorService', () => {
  const userIdentity = new UserIdentityService(db)
  const projectService = new ProjectService(db, userIdentity)
  const proposalService = new ProposalService(db, userIdentity)
  const service = new OperatorService(db)
  const projectIds: number[] = []
  const founderIds: string[] = [TEST_FOUNDER]

  async function createDraft(data: Record<string, unknown> = { name: 'Test Project' }) {
    const project = await projectService.createProject(TEST_FOUNDER, data)
    projectIds.push(project.id)
    return project
  }

  async function createPending(data: Record<string, unknown> = VALID_PROJECT) {
    const project = await createDraft(data)
    await projectService.submitForReview(project.id)
    return (await projectService.getProject(project.id))!
  }

  async function createLive(overrides: Record<string, unknown> = {}) {
    const project = await createPending({ ...VALID_PROJECT, ...overrides })
    await service.approveProject(TEST_OPERATOR, project.id)
    return (await projectService.getProject(project.id))!
  }

  async function auditRowsFor(projectId: number) {
    return db.select().from(auditRecords).where(eq(auditRecords.projectId, projectId))
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

  describe('valid project status transitions', () => {
    it('1 → 3: approve a pending project', async () => {
      const project = await createPending()
      const result = await service.approveProject(TEST_OPERATOR, project.id)
      expect((result as { status: number }).status).toBe(ProjectStatus.Live)
    })

    it('1 → 2: require revision on a pending project', async () => {
      const project = await createPending()
      const result = await service.requireProjectRevision(TEST_OPERATOR, project.id, 'needs work')
      expect((result as { status: number }).status).toBe(ProjectStatus.RevisionRequired)
    })

    it('1 → 5: reject a pending project (terminal)', async () => {
      const project = await createPending()
      const result = await service.rejectProject(TEST_OPERATOR, project.id, 'not a fit')
      expect((result as { status: number }).status).toBe(ProjectStatus.Rejected)
    })

    it('3 → 4: delist a live project', async () => {
      const project = await createLive()
      const result = await service.delistProject(TEST_OPERATOR, project.id, 'policy violation')
      expect((result as { status: number }).status).toBe(ProjectStatus.Delisted)
    })

    it('4 → 3: restore a delisted project', async () => {
      const project = await createLive()
      await service.delistProject(TEST_OPERATOR, project.id, 'policy violation')
      const result = await service.restoreProject(TEST_OPERATOR, project.id)
      expect((result as { status: number }).status).toBe(ProjectStatus.Live)
    })
  })

  describe('invalid project status transitions', () => {
    it('rejects approving a draft', async () => {
      const project = await createDraft()
      const result = await service.approveProject(TEST_OPERATOR, project.id)
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects rejecting a draft', async () => {
      const project = await createDraft()
      const result = await service.rejectProject(TEST_OPERATOR, project.id, 'no')
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects requiring revision on a draft', async () => {
      const project = await createDraft()
      const result = await service.requireProjectRevision(TEST_OPERATOR, project.id, 'x')
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects approving a terminally rejected project', async () => {
      const project = await createPending()
      await service.rejectProject(TEST_OPERATOR, project.id, 'not a fit')
      const result = await service.approveProject(TEST_OPERATOR, project.id)
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects delisting a non-live project', async () => {
      const project = await createDraft()
      const result = await service.delistProject(TEST_OPERATOR, project.id, 'x')
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects restoring a project that is not delisted', async () => {
      const project = await createLive()
      const result = await service.restoreProject(TEST_OPERATOR, project.id)
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })
  })

  describe('not found', () => {
    it('approveProject returns ProjectNotFoundError for missing project', async () => {
      const result = await service.approveProject(TEST_OPERATOR, NONEXISTENT_ID)
      expect(result).toBeInstanceOf(ProjectNotFoundError)
    })

    it('approveProposal returns ProposalNotFoundError for missing proposal', async () => {
      const result = await service.approveProposal(TEST_OPERATOR, NONEXISTENT_ID)
      expect(result).toBeInstanceOf(ProposalNotFoundError)
    })
  })

  describe('proposal transitions', () => {
    it('approve applies the diff and keeps the project Live (0 → 1)', async () => {
      const project = await createLive()
      const proposal = await proposalService.createProposal(project.id, { description: 'updated' })
      const result = await service.approveProposal(TEST_OPERATOR, (proposal as { id: number }).id)
      expect((result as { status: number }).status).toBe(ProposalStatus.Approved)
      const updatedProject = await projectService.getProject(project.id)
      expect(updatedProject!.status).toBe(ProjectStatus.Live)
      expect(updatedProject!.description).toBe('updated')
    })

    it('reject leaves the project row unchanged (0 → 2)', async () => {
      const project = await createLive()
      const proposal = await proposalService.createProposal(project.id, { description: 'updated' })
      const result = await service.rejectProposal(TEST_OPERATOR, (proposal as { id: number }).id, 'no thanks')
      expect((result as { status: number }).status).toBe(ProposalStatus.Rejected)
      const unchanged = await projectService.getProject(project.id)
      expect(unchanged!.description).toBe('original description')
      expect(unchanged!.status).toBe(ProjectStatus.Live)
    })

    it('require-revision moves the proposal to Revision Required (0 → 3)', async () => {
      const project = await createLive()
      const proposal = await proposalService.createProposal(project.id, { description: 'updated' })
      const result = await service.requireProposalRevision(TEST_OPERATOR, (proposal as { id: number }).id, 'clarify')
      expect((result as { status: number }).status).toBe(ProposalStatus.RevisionRequired)
    })

    it('rejects approving an already-approved proposal', async () => {
      const project = await createLive()
      const proposal = await proposalService.createProposal(project.id, { description: 'updated' })
      const proposalId = (proposal as { id: number }).id
      await service.approveProposal(TEST_OPERATOR, proposalId)
      const result = await service.approveProposal(TEST_OPERATOR, proposalId)
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects rejecting an already-rejected proposal', async () => {
      const project = await createLive()
      const proposal = await proposalService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await service.rejectProposal(TEST_OPERATOR, proposalId, 'no')
      const result = await service.rejectProposal(TEST_OPERATOR, proposalId, 'no again')
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects requiring revision on an approved proposal', async () => {
      const project = await createLive()
      const proposal = await proposalService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await service.approveProposal(TEST_OPERATOR, proposalId)
      const result = await service.requireProposalRevision(TEST_OPERATOR, proposalId, 'x')
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })
  })

  describe('diff application (partial PATCH)', () => {
    it('overwrites only the changed fields, preserving the rest', async () => {
      const project = await createLive({
        name: 'Product',
        description: 'original description',
        tagline: 'original tagline',
      })
      const proposal = await proposalService.createProposal(project.id, { description: 'only this changes' })
      await service.approveProposal(TEST_OPERATOR, (proposal as { id: number }).id)
      const updated = await projectService.getProject(project.id)
      expect(updated!.description).toBe('only this changes')
      expect(updated!.tagline).toBe('original tagline')
      expect(updated!.name).toBe('Product')
    })
  })

  describe('audit records', () => {
    it('project-level approve creates an audit record with null proposalId', async () => {
      const project = await createPending()
      await service.approveProject(TEST_OPERATOR, project.id)
      const rows = await auditRowsFor(project.id)
      const approve = rows.find((r) => r.action === 'approve')
      expect(approve).toBeDefined()
      expect(approve!.operatorId).toBe(TEST_OPERATOR)
      expect(approve!.proposalId).toBeNull()
    })

    it('project-level reject records the reason', async () => {
      const project = await createPending()
      await service.rejectProject(TEST_OPERATOR, project.id, 'not a fit')
      const rows = await auditRowsFor(project.id)
      const reject = rows.find((r) => r.action === 'reject')
      expect(reject!.reason).toBe('not a fit')
      expect(reject!.proposalId).toBeNull()
    })

    it('project-level require-revision records the reason', async () => {
      const project = await createPending()
      await service.requireProjectRevision(TEST_OPERATOR, project.id, 'fix it')
      const rows = await auditRowsFor(project.id)
      const revision = rows.find((r) => r.action === 'require_revision')
      expect(revision!.reason).toBe('fix it')
      expect(revision!.proposalId).toBeNull()
    })

    it('project-level delist records the reason', async () => {
      const project = await createLive()
      await service.delistProject(TEST_OPERATOR, project.id, 'policy violation')
      const rows = await auditRowsFor(project.id)
      const delist = rows.find((r) => r.action === 'delist')
      expect(delist!.reason).toBe('policy violation')
      expect(delist!.proposalId).toBeNull()
    })

    it('project-level restore creates an audit record', async () => {
      const project = await createLive()
      await service.delistProject(TEST_OPERATOR, project.id, 'policy violation')
      await service.restoreProject(TEST_OPERATOR, project.id)
      const rows = await auditRowsFor(project.id)
      const restore = rows.find((r) => r.action === 'restore')
      expect(restore).toBeDefined()
      expect(restore!.proposalId).toBeNull()
    })

    it('proposal-level approve sets proposalId', async () => {
      const project = await createLive()
      const proposal = await proposalService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await service.approveProposal(TEST_OPERATOR, proposalId)
      const rows = await auditRowsFor(project.id)
      const approve = rows.find((r) => r.action === 'approve' && r.proposalId === proposalId)
      expect(approve).toBeDefined()
      expect(approve!.proposalId).toBe(proposalId)
    })

    it('proposal-level reject records reason and proposalId', async () => {
      const project = await createLive()
      const proposal = await proposalService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await service.rejectProposal(TEST_OPERATOR, proposalId, 'nope')
      const rows = await auditRowsFor(project.id)
      const reject = rows.find((r) => r.action === 'reject' && r.proposalId === proposalId)
      expect(reject!.reason).toBe('nope')
      expect(reject!.proposalId).toBe(proposalId)
    })

    it('proposal-level require-revision records reason and proposalId', async () => {
      const project = await createLive()
      const proposal = await proposalService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await service.requireProposalRevision(TEST_OPERATOR, proposalId, 'clarify')
      const rows = await auditRowsFor(project.id)
      const revision = rows.find((r) => r.action === 'require_revision' && r.proposalId === proposalId)
      expect(revision!.reason).toBe('clarify')
      expect(revision!.proposalId).toBe(proposalId)
    })
  })
})
