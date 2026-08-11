import { afterAll, describe, expect, it } from 'bun:test'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { auditRecords, projects, userIdentities } from '../../../src/db/schema'
import { ProjectService } from '../../../src/modules/project/service'
import { OperatorService } from '../../../src/modules/operator/service'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { UserProfileService } from '../../../src/modules/user/service'
import { Role } from '../../../src/modules/user-identity/model'
import {
  InvalidTransitionError,
  MissingRequiredFieldError,
  ProjectNotFoundError,
  ProjectStatus,
} from '../../../src/modules/project/model'
import { validProjectBody } from '../../fixtures/project'

const TEST_FOUNDER = `test-founder-${crypto.randomUUID()}`
const TEST_OPERATOR = `test-operator-${crypto.randomUUID()}`
const NONEXISTENT_ID = 2_000_000_000

describe('ProjectService', () => {
  const userIdentity = new UserIdentityService(db)
  const userProfile = new UserProfileService(db)
  const service = new ProjectService(db, userIdentity, userProfile)
  const operatorService = new OperatorService(db)
  const projectIds: number[] = []
  const founderIds: string[] = [TEST_FOUNDER]

  async function createDraft(data: Record<string, unknown> = { name: 'Test Project' }) {
    const project = await service.createProject(TEST_FOUNDER, data)
    projectIds.push(project.id)
    return project
  }

  async function createPending(data: Record<string, unknown> = validProjectBody()) {
    const project = await createDraft(data)
    await service.submitForReview(project.id)
    return (await service.getProject(project.id))!
  }

  async function createLive(overrides: Record<string, unknown> = {}) {
    const project = await createPending(validProjectBody(overrides))
    await operatorService.approveProject(TEST_OPERATOR, project.id)
    return (await service.getProject(project.id))!
  }

  async function auditRowsFor(projectId: number) {
    return db.select().from(auditRecords).where(eq(auditRecords.projectId, projectId))
  }

  afterAll(async () => {
    if (projectIds.length > 0) {
      await db.delete(auditRecords).where(inArray(auditRecords.projectId, projectIds))
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

  describe('founder status transitions', () => {
    it('0 → 1: submit a draft for review', async () => {
      const project = await createDraft(validProjectBody())
      const result = await service.submitForReview(project.id)
      expect(result).not.toBeInstanceOf(InvalidTransitionError)
      expect(result).not.toBeInstanceOf(MissingRequiredFieldError)
      expect((result as { status: number }).status).toBe(ProjectStatus.PendingReview)
    })

    it('2 → 1: founder resubmits after revision', async () => {
      const project = await createPending()
      await operatorService.requireProjectRevision(TEST_OPERATOR, project.id, 'needs work')
      const result = await service.submitForReview(project.id)
      expect((result as { status: number }).status).toBe(ProjectStatus.PendingReview)
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
  })

  describe('not found', () => {
    it('submitForReview returns ProjectNotFoundError for missing project', async () => {
      const result = await service.submitForReview(NONEXISTENT_ID)
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
      await operatorService.requireProjectRevision(TEST_OPERATOR, project.id, 'fix it')
      const result = await service.saveDraft(project.id, { description: 'reworked' })
      expect(result).not.toBeInstanceOf(InvalidTransitionError)
      expect((result as { description: string }).description).toBe('reworked')
    })

    it('allows editing while Pending Review', async () => {
      const project = await createPending()
      const result = await service.saveDraft(project.id, { description: 'x' })
      expect(result).not.toBeInstanceOf(InvalidTransitionError)
      expect((result as { description: string }).description).toBe('x')
      expect((result as { status: number }).status).toBe(ProjectStatus.PendingReview)
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
      const project = await createDraft(validProjectBody({ categories: [] }))
      const result = await service.submitForReview(project.id)
      expect(result).toBeInstanceOf(MissingRequiredFieldError)
      expect((result as MissingRequiredFieldError).field).toBe('categories')
    })

    it('treats whitespace-only strings as empty', async () => {
      const project = await createDraft(validProjectBody({ description: '   ' }))
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
      const project = await createDraft(validProjectBody({ isOpenForBeta: true }))
      const result = await service.submitForReview(project.id)
      expect(result).toBeInstanceOf(MissingRequiredFieldError)
      expect((result as MissingRequiredFieldError).field).toBe('betaDescription')
    })

    it('submits when open for beta with betaDescription filled', async () => {
      const project = await createDraft(validProjectBody({ isOpenForBeta: true, betaDescription: 'beta details' }))
      const result = await service.submitForReview(project.id)
      expect((result as { status: number }).status).toBe(ProjectStatus.PendingReview)
    })

    it('submits a fully valid project', async () => {
      const project = await createDraft(validProjectBody())
      const result = await service.submitForReview(project.id)
      expect((result as { status: number }).status).toBe(ProjectStatus.PendingReview)
    })
  })

  describe('audit records', () => {
    it('founder actions (create, submit, create proposal) create no audit records', async () => {
      const project = await createDraft()
      await service.submitForReview(project.id)
      expect(await auditRowsFor(project.id)).toHaveLength(0)
    })
  })
})
