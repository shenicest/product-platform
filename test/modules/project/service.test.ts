import { afterAll, describe, expect, it } from 'bun:test'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { auditRecords, projectEditProposals, projects, userIdentities } from '../../../src/db/schema'
import { ProjectService } from '../../../src/modules/project/service'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { Role } from '../../../src/modules/user-identity/model'
import {
  DuplicateProposalError,
  InvalidTransitionError,
  MissingRequiredFieldError,
  ProjectNotFoundError,
  ProjectStatus,
  ProposalNotFoundError,
  ProposalStatus,
  ValidationError,
} from '../../../src/modules/project/model'

const TEST_FOUNDER = `test-founder-${crypto.randomUUID()}`
const TEST_OPERATOR = `test-operator-${crypto.randomUUID()}`
const NONEXISTENT_ID = 2_000_000_000

// A complete project that passes submitForReview's required-field validation.
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

describe('ProjectService', () => {
  const userIdentity = new UserIdentityService(db)
  const service = new ProjectService(db, userIdentity)
  const projectIds: number[] = []
  const founderIds: string[] = [TEST_FOUNDER]

  async function createDraft(data: Record<string, unknown> = { name: 'Test Project' }) {
    const project = await service.createProject(TEST_FOUNDER, data)
    projectIds.push(project.id)
    return project
  }

  async function createPending(data: Record<string, unknown> = VALID_PROJECT) {
    const project = await createDraft(data)
    await service.submitForReview(project.id)
    return (await service.getProject(project.id))!
  }

  async function createLive(overrides: Record<string, unknown> = {}) {
    const project = await createPending({ ...VALID_PROJECT, ...overrides })
    await service.approveProject(TEST_OPERATOR, project.id)
    return (await service.getProject(project.id))!
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

  describe('createProject', () => {
    it('inserts a Draft row owned by the founder', async () => {
      const project = await createDraft({ name: 'My Idea' })
      expect(project.status).toBe(ProjectStatus.Draft)
      expect(project.userId).toBe(TEST_FOUNDER)
      expect(project.name).toBe('My Idea')
    })

    it('ignores lifecycle fields passed in data (always Draft, always owned by caller)', async () => {
      const project = await service.createProject(TEST_FOUNDER, {
        name: 'Sneaky',
        status: ProjectStatus.Live,
        userId: 'someone-else',
      })
      projectIds.push(project.id)
      expect(project.status).toBe(ProjectStatus.Draft)
      expect(project.userId).toBe(TEST_FOUNDER)
    })

    it('grants the founder role when a project is created', async () => {
      const founder = `test-founder-${crypto.randomUUID()}`
      founderIds.push(founder)
      expect(await userIdentity.hasRole(founder, Role.Founder)).toBe(false)
      const project = await service.createProject(founder, { name: 'First Project' })
      projectIds.push(project.id)
      expect(await userIdentity.hasRole(founder, Role.Founder)).toBe(true)
    })

    it('grants the founder role idempotently across multiple projects', async () => {
      const founder = `test-founder-${crypto.randomUUID()}`
      founderIds.push(founder)
      const first = await service.createProject(founder, { name: 'One' })
      const second = await service.createProject(founder, { name: 'Two' })
      projectIds.push(first.id, second.id)
      const roles = await userIdentity.getRoles(founder)
      expect(roles.filter((r) => r === Role.Founder)).toHaveLength(1)
    })
  })

  describe('valid project status transitions', () => {
    it('0 → 1: submit a draft for review', async () => {
      const project = await createDraft(VALID_PROJECT)
      const result = await service.submitForReview(project.id)
      expect(result).not.toBeInstanceOf(InvalidTransitionError)
      expect(result).not.toBeInstanceOf(MissingRequiredFieldError)
      expect((result as { status: number }).status).toBe(ProjectStatus.PendingReview)
    })

    it('1 → 2: operator requires revision', async () => {
      const project = await createPending()
      const result = await service.requireProjectRevision(TEST_OPERATOR, project.id, 'needs work')
      expect((result as { status: number }).status).toBe(ProjectStatus.RevisionRequired)
    })

    it('2 → 1: founder resubmits after revision', async () => {
      const project = await createPending()
      await service.requireProjectRevision(TEST_OPERATOR, project.id, 'needs work')
      const result = await service.submitForReview(project.id)
      expect((result as { status: number }).status).toBe(ProjectStatus.PendingReview)
    })

    it('1 → 3: operator approves first submission', async () => {
      const project = await createPending()
      const result = await service.approveProject(TEST_OPERATOR, project.id)
      expect((result as { status: number }).status).toBe(ProjectStatus.Live)
    })

    it('1 → 5: operator rejects first submission (terminal)', async () => {
      const project = await createPending()
      const result = await service.rejectProject(TEST_OPERATOR, project.id, 'not a fit')
      expect((result as { status: number }).status).toBe(ProjectStatus.Rejected)
    })

    it('3 → 4: operator delists a live project', async () => {
      const project = await createLive()
      const result = await service.delistProject(TEST_OPERATOR, project.id, 'policy violation')
      expect((result as { status: number }).status).toBe(ProjectStatus.Delisted)
    })

    it('4 → 3: operator restores a delisted project', async () => {
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

    it('rejects submitting an already-pending project', async () => {
      const project = await createPending()
      const result = await service.submitForReview(project.id)
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects submitting a live project', async () => {
      const project = await createLive()
      const result = await service.submitForReview(project.id)
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
    it('submitForReview returns ProjectNotFoundError for missing project', async () => {
      const result = await service.submitForReview(NONEXISTENT_ID)
      expect(result).toBeInstanceOf(ProjectNotFoundError)
    })

    it('approveProject returns ProjectNotFoundError for missing project', async () => {
      const result = await service.approveProject(TEST_OPERATOR, NONEXISTENT_ID)
      expect(result).toBeInstanceOf(ProjectNotFoundError)
    })
  })

  describe('saveDraft', () => {
    it('updates a draft row in place (same id, still Draft)', async () => {
      const project = await createDraft({ name: 'Before' })
      const result = await service.saveDraft(project.id, { name: 'After', description: 'draft body' })
      expect(result).not.toBeInstanceOf(InvalidTransitionError)
      const updated = result as { id: number; status: number; name: string; description: string | null }
      expect(updated.id).toBe(project.id)
      expect(updated.status).toBe(ProjectStatus.Draft)
      expect(updated.name).toBe('After')
      expect(updated.description).toBe('draft body')
    })

    it('saves draft multiple times on the same row (no new records)', async () => {
      const project = await createDraft({ name: 'v1' })
      await service.saveDraft(project.id, { name: 'v2', tagline: 'tagline' })
      await service.saveDraft(project.id, { name: 'v3', description: 'body' })
      const rows = await db
        .select()
        .from(projects)
        .where(and(eq(projects.id, project.id), eq(projects.userId, TEST_FOUNDER)))
      expect(rows).toHaveLength(1)
      const after = await service.getProject(project.id)
      expect(after!.id).toBe(project.id)
      expect(after!.name).toBe('v3')
      expect(after!.tagline).toBe('tagline')
      expect(after!.description).toBe('body')
    })

    it('allows editing while Revision Required', async () => {
      const project = await createPending()
      await service.requireProjectRevision(TEST_OPERATOR, project.id, 'fix it')
      const result = await service.saveDraft(project.id, { description: 'reworked' })
      expect(result).not.toBeInstanceOf(InvalidTransitionError)
      expect((result as { description: string }).description).toBe('reworked')
    })

    it('rejects editing a pending project', async () => {
      const project = await createPending()
      const result = await service.saveDraft(project.id, { description: 'x' })
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects editing a live project', async () => {
      const project = await createLive()
      const result = await service.saveDraft(project.id, { description: 'x' })
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('cannot change status via draft data (state machine is not bypassed)', async () => {
      const project = await createDraft({ name: 'Before' })
      await service.saveDraft(project.id, { status: ProjectStatus.Live })
      const after = await service.getProject(project.id)
      expect(after!.status).toBe(ProjectStatus.Draft)
    })
  })

  describe('submitForReview required-field validation', () => {
    it('rejects submission with missing required fields, pointing to the first missing field', async () => {
      const project = await createDraft({ name: 'Only Name' })
      const result = await service.submitForReview(project.id)
      expect(result).toBeInstanceOf(MissingRequiredFieldError)
      expect((result as MissingRequiredFieldError).field).toBe('tagline')
    })

    it('reports the first missing field in form-display order', async () => {
      const project = await createDraft({ ...VALID_PROJECT, categories: [] })
      const result = await service.submitForReview(project.id)
      expect(result).toBeInstanceOf(MissingRequiredFieldError)
      expect((result as MissingRequiredFieldError).field).toBe('categories')
    })

    it('treats whitespace-only strings as empty', async () => {
      const project = await createDraft({ ...VALID_PROJECT, description: '   ' })
      const result = await service.submitForReview(project.id)
      expect(result).toBeInstanceOf(MissingRequiredFieldError)
      expect((result as MissingRequiredFieldError).field).toBe('description')
    })

    it('does not transition status when a required field is missing', async () => {
      const project = await createDraft({ name: 'Only Name' })
      await service.submitForReview(project.id)
      const after = await service.getProject(project.id)
      expect(after!.status).toBe(ProjectStatus.Draft)
    })

    it('requires betaDescription when open for beta', async () => {
      const project = await createDraft({ ...VALID_PROJECT, isOpenForBeta: true })
      const result = await service.submitForReview(project.id)
      expect(result).toBeInstanceOf(MissingRequiredFieldError)
      expect((result as MissingRequiredFieldError).field).toBe('betaDescription')
    })

    it('submits when open for beta with betaDescription filled', async () => {
      const project = await createDraft({ ...VALID_PROJECT, isOpenForBeta: true, betaDescription: 'beta details' })
      const result = await service.submitForReview(project.id)
      expect((result as { status: number }).status).toBe(ProjectStatus.PendingReview)
    })

    it('submits a fully valid project', async () => {
      const project = await createDraft(VALID_PROJECT)
      const result = await service.submitForReview(project.id)
      expect((result as { status: number }).status).toBe(ProjectStatus.PendingReview)
    })
  })

  describe('proposal lifecycle', () => {
    it('creates a pending proposal on a live project, leaving the project row untouched', async () => {
      const project = await createLive()
      const before = await service.getProject(project.id)
      const proposal = await service.createProposal(project.id, { description: 'proposed change' })
      expect(proposal).not.toBeInstanceOf(InvalidTransitionError)
      const row = proposal as { status: number; projectId: number; changes: Record<string, unknown> }
      expect(row.status).toBe(ProposalStatus.Pending)
      expect(row.projectId).toBe(project.id)
      expect(row.changes).toEqual({ description: 'proposed change' })
      const after = await service.getProject(project.id)
      expect(after!.description).toBe(before!.description)
      expect(after!.status).toBe(ProjectStatus.Live)
    })

    it('rejects creating a proposal on a non-live project', async () => {
      const project = await createDraft()
      const result = await service.createProposal(project.id, { description: 'x' })
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects creating a proposal on a missing project', async () => {
      const result = await service.createProposal(NONEXISTENT_ID, { description: 'x' })
      expect(result).toBeInstanceOf(ProjectNotFoundError)
    })

    it('approve applies the diff and keeps the project Live', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'updated' })
      const result = await service.approveProposal(TEST_OPERATOR, (proposal as { id: number }).id)
      expect((result as { status: number }).status).toBe(ProposalStatus.Approved)
      const updatedProject = await service.getProject(project.id)
      expect(updatedProject!.status).toBe(ProjectStatus.Live)
      expect(updatedProject!.description).toBe('updated')
    })

    it('reject leaves the project row unchanged', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'updated' })
      const result = await service.rejectProposal(TEST_OPERATOR, (proposal as { id: number }).id, 'no thanks')
      expect((result as { status: number }).status).toBe(ProposalStatus.Rejected)
      const unchanged = await service.getProject(project.id)
      expect(unchanged!.description).toBe('original description')
      expect(unchanged!.status).toBe(ProjectStatus.Live)
    })

    it('require-revision moves the proposal to Revision Required', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'updated' })
      const result = await service.requireProposalRevision(TEST_OPERATOR, (proposal as { id: number }).id, 'clarify')
      expect((result as { status: number }).status).toBe(ProposalStatus.RevisionRequired)
    })

    it('resubmit (3 → 0) updates the diff and returns to Pending', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'v1' })
      const proposalId = (proposal as { id: number }).id
      await service.requireProposalRevision(TEST_OPERATOR, proposalId, 'clarify')
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

    it('rejects approving an already-approved proposal', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'updated' })
      const proposalId = (proposal as { id: number }).id
      await service.approveProposal(TEST_OPERATOR, proposalId)
      const result = await service.approveProposal(TEST_OPERATOR, proposalId)
      expect(result).toBeInstanceOf(InvalidTransitionError)
    })

    it('rejects acting on a missing proposal', async () => {
      const result = await service.approveProposal(TEST_OPERATOR, NONEXISTENT_ID)
      expect(result).toBeInstanceOf(ProposalNotFoundError)
    })
  })

  describe('diff application (partial PATCH)', () => {
    it('overwrites only the changed fields, preserving the rest', async () => {
      const project = await createLive({
        name: 'Product',
        description: 'original description',
        tagline: 'original tagline',
      })
      const proposal = await service.createProposal(project.id, { description: 'only this changes' })
      await service.approveProposal(TEST_OPERATOR, (proposal as { id: number }).id)
      const updated = await service.getProject(project.id)
      expect(updated!.description).toBe('only this changes')
      expect(updated!.tagline).toBe('original tagline')
      expect(updated!.name).toBe('Product')
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
      await service.requireProposalRevision(TEST_OPERATOR, (proposal as { id: number }).id, 'fix')
      const result = await service.createProposal(project.id, { description: 'second' })
      expect(result).toBeInstanceOf(DuplicateProposalError)
    })

    it('allows a new proposal after the previous one is Approved', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'first' })
      await service.approveProposal(TEST_OPERATOR, (proposal as { id: number }).id)
      const result = await service.createProposal(project.id, { description: 'second' })
      expect(result).not.toBeInstanceOf(DuplicateProposalError)
    })

    it('allows a new proposal after the previous one is Rejected', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'first' })
      await service.rejectProposal(TEST_OPERATOR, (proposal as { id: number }).id, 'no')
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
      await service.requireProposalRevision(TEST_OPERATOR, proposalId, 'fix')
      const result = await service.updateProposal(proposalId, { bogus: 'x' })
      expect(result).toBeInstanceOf(ValidationError)
    })
  })

  describe('audit records', () => {
    it('project-level approve creates an audit record with null proposal_id', async () => {
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

    it('proposal-level approve sets proposal_id', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await service.approveProposal(TEST_OPERATOR, proposalId)
      const rows = await auditRowsFor(project.id)
      const approve = rows.find((r) => r.action === 'approve' && r.proposalId === proposalId)
      expect(approve).toBeDefined()
      expect(approve!.proposalId).toBe(proposalId)
    })

    it('proposal-level reject records reason and proposal_id', async () => {
      const project = await createLive()
      const proposal = await service.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await service.rejectProposal(TEST_OPERATOR, proposalId, 'nope')
      const rows = await auditRowsFor(project.id)
      const reject = rows.find((r) => r.action === 'reject' && r.proposalId === proposalId)
      expect(reject!.reason).toBe('nope')
      expect(reject!.proposalId).toBe(proposalId)
    })

    it('founder actions (create, submit, create proposal) create no audit records', async () => {
      const project = await createDraft()
      await service.submitForReview(project.id)
      expect(await auditRowsFor(project.id)).toHaveLength(0)
    })
  })
})
