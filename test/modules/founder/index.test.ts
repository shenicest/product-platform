import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { auditRecords, projectEditProposals, projects, userIdentities } from '../../../src/db/schema'
import { founderModule } from '../../../src/modules/founder'
import { projectService } from '../../../src/modules/project'
import { OperatorService } from '../../../src/modules/operator/service'
import { ProjectStatus, ProposalStatus } from '../../../src/modules/project/model'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { Role } from '../../../src/modules/user-identity/model'

const TEST_SECRET = 'dev-secret-change-in-production'
const FOUNDER = `test-founder-${crypto.randomUUID()}`
const OTHER_FOUNDER = `test-founder-${crypto.randomUUID()}`
const NON_FOUNDER = `test-user-${crypto.randomUUID()}`
const OPERATOR = `test-operator-${crypto.randomUUID()}`
const NONEXISTENT_ID = 2_000_000_000

const VALID_PROJECT: Record<string, unknown> = {
  name: 'Founder Test Project',
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

function createApp() {
  return new Elysia().use(founderModule)
}

async function signToken(payload: Record<string, unknown>) {
  const app = new Elysia().use(jwt({ name: 'jwt', secret: TEST_SECRET }))
  const { jwt: jwtInstance } = app.decorator
  return jwtInstance.sign(payload)
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` }
}

describe('Founder routes', () => {
  const app = createApp()
  const userIdentity = new UserIdentityService(db)
  const operatorService = new OperatorService(db)
  const projectIds: number[] = []
  const userIds = [FOUNDER, OTHER_FOUNDER, NON_FOUNDER, OPERATOR]
  let founderToken: string
  let otherToken: string
  let nonFounderToken: string

  async function createDraftAs(userId: string, data: Record<string, unknown> = { name: 'Test' }) {
    const project = await projectService.createProject(userId, data)
    projectIds.push(project.id)
    return project
  }

  async function createDraft(data: Record<string, unknown> = { name: 'Test' }) {
    return createDraftAs(FOUNDER, data)
  }

  async function createPending(data: Record<string, unknown> = VALID_PROJECT) {
    const project = await createDraft(data)
    await projectService.submitForReview(project.id)
    return (await projectService.getProject(project.id))!
  }

  async function createLive(overrides: Record<string, unknown> = {}) {
    const project = await createPending({ ...VALID_PROJECT, ...overrides })
    await operatorService.approveProject(OPERATOR, project.id)
    return (await projectService.getProject(project.id))!
  }

  async function founderGet(path: string, token: string = founderToken) {
    return app.handle(
      new Request(`http://localhost/founder${path}`, {
        headers: authHeaders(token),
      }),
    )
  }

  beforeAll(async () => {
    // FOUNDER and OTHER_FOUNDER hold the founder role so the founderOnly guard passes
    // and the cross-founder tests exercise ownership (not the role guard). NON_FOUNDER
    // deliberately has no role, to verify the guard rejects non-founders with 403.
    await userIdentity.grantRole(FOUNDER, Role.Founder)
    await userIdentity.grantRole(OTHER_FOUNDER, Role.Founder)
    founderToken = await signToken({ user_id: FOUNDER })
    otherToken = await signToken({ user_id: OTHER_FOUNDER })
    nonFounderToken = await signToken({ user_id: NON_FOUNDER })
  })

  afterAll(async () => {
    if (projectIds.length > 0) {
      await db.delete(auditRecords).where(inArray(auditRecords.projectId, projectIds))
      await db.delete(projectEditProposals).where(inArray(projectEditProposals.projectId, projectIds))
      await db.delete(projects).where(inArray(projects.id, projectIds))
    }
    if (userIds.length > 0) {
      await db.delete(userIdentities).where(inArray(userIdentities.userId, userIds))
    }
  })

  // ── Access control ───────────────────────────────────────────────────

  describe('access control', () => {
    it('returns 401 without a token', async () => {
      const res = await app.handle(new Request('http://localhost/founder/projects'))
      expect(res.status).toBe(401)
    })

    it('returns 401 on stats without a token', async () => {
      const res = await app.handle(new Request('http://localhost/founder/stats'))
      expect(res.status).toBe(401)
    })

    it('returns 403 for a non-founder on the project list', async () => {
      const res = await founderGet('/projects', nonFounderToken)
      expect(res.status).toBe(403)
    })

    it('returns 403 for a non-founder on stats', async () => {
      const res = await founderGet('/stats', nonFounderToken)
      expect(res.status).toBe(403)
    })

    it('returns 403 for a non-founder on audit-reason', async () => {
      const res = await founderGet('/projects/1/audit-reason', nonFounderToken)
      expect(res.status).toBe(403)
    })

    it('returns 403 for a non-founder on proposals', async () => {
      const res = await founderGet('/projects/1/proposals', nonFounderToken)
      expect(res.status).toBe(403)
    })
  })

  // ── GET /founder/projects ────────────────────────────────────────────

  describe('GET /founder/projects', () => {
    it('lists only the caller\'s own projects', async () => {
      const mine = await createDraft({ name: 'Mine Only' })
      const theirs = await createDraftAs(OTHER_FOUNDER, { name: 'Theirs Only' })

      const res = await founderGet('/projects')
      expect(res.status).toBe(200)
      const body = await res.json()
      const ids = body.data.map((p: { id: number }) => p.id)
      expect(ids).toContain(mine.id)
      expect(ids).not.toContain(theirs.id)
      for (const p of body.data) {
        expect(p.userId).toBe(FOUNDER)
      }
    })

    it('filters by status', async () => {
      const pending = await createPending({ ...VALID_PROJECT, name: 'Status Filter Pending' })
      const res = await founderGet(`/projects?status=${ProjectStatus.PendingReview}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      const found = body.data.find((p: { id: number }) => p.id === pending.id)
      expect(found).toBeDefined()
      for (const p of body.data) {
        expect(p.status).toBe(ProjectStatus.PendingReview)
      }
    })

    it('filters by stage', async () => {
      const project = await createDraft({ ...VALID_PROJECT, name: 'Stage Filter', stage: 1 })
      const res = await founderGet('/projects?stage=1')
      expect(res.status).toBe(200)
      const body = await res.json()
      const found = body.data.find((p: { id: number }) => p.id === project.id)
      expect(found).toBeDefined()
      for (const p of body.data) {
        expect(p.stage).toBe(1)
      }
    })

    it('searches by name', async () => {
      const unique = `name-${crypto.randomUUID().slice(0, 8)}`
      await createDraft({ name: `Findable ${unique}` })
      const res = await founderGet(`/projects?q=${unique}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      expect(body.data[0].name).toContain(unique)
    })

    it('searches by tagline', async () => {
      const unique = `tag-${crypto.randomUUID().slice(0, 8)}`
      await createDraft({ name: 'Generic Name', tagline: `Catchy ${unique}` })
      const res = await founderGet(`/projects?q=${unique}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      expect(body.data[0].tagline).toContain(unique)
    })

    it('paginates with offset and limit', async () => {
      await createDraft({ name: 'Page A' })
      await createDraft({ name: 'Page B' })
      await createDraft({ name: 'Page C' })

      const page1 = await (await founderGet('/projects?limit=2&offset=0')).json()
      const page2 = await (await founderGet('/projects?limit=2&offset=2')).json()
      expect(page1.data.length).toBeLessThanOrEqual(2)
      const page1Ids = new Set(page1.data.map((p: { id: number }) => p.id))
      for (const p of page2.data) {
        expect(page1Ids.has(p.id)).toBe(false)
      }
    })

    it('returns an empty list for a founder with no matching projects', async () => {
      const res = await founderGet('/projects?status=99')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual([])
      expect(body.total).toBe(0)
    })
  })

  // ── GET /founder/stats ───────────────────────────────────────────────

  describe('GET /founder/stats', () => {
    it('counts total, live, and pending review projects accurately', async () => {
      const before = await (await founderGet('/stats')).json()

      await createDraft({ name: 'Stats Draft' })
      await createPending({ ...VALID_PROJECT, name: 'Stats Pending' })
      await createLive({ name: 'Stats Live' })

      const after = await (await founderGet('/stats')).json()
      expect(after.totalProjects).toBe(before.totalProjects + 3)
      expect(after.pendingReviewProjects).toBe(before.pendingReviewProjects + 1)
      expect(after.liveProjects).toBe(before.liveProjects + 1)
    })

    it('scopes counts to the caller only', async () => {
      // OTHER_FOUNDER has projects from earlier tests; FOUNDER's stats must not include them.
      const mine = await (await founderGet('/stats', founderToken)).json()
      const theirs = await (await founderGet('/stats', otherToken)).json()
      await createDraftAs(OTHER_FOUNDER, { name: 'Theirs Stats' })
      const theirsAfter = await (await founderGet('/stats', otherToken)).json()
      const mineAfter = await (await founderGet('/stats', founderToken)).json()
      expect(theirsAfter.totalProjects).toBe(theirs.totalProjects + 1)
      expect(mineAfter.totalProjects).toBe(mine.totalProjects)
    })
  })

  // ── GET /founder/projects/:id/audit-reason ───────────────────────────

  describe('GET /founder/projects/:id/audit-reason', () => {
    it('returns the reason for a revision-required project', async () => {
      const project = await createPending({ ...VALID_PROJECT, name: 'Reason Revision' })
      await operatorService.requireProjectRevision(OPERATOR, project.id, 'please fix the description')

      const res = await founderGet(`/projects/${project.id}/audit-reason`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.action).toBe('require_revision')
      expect(body.reason).toBe('please fix the description')
      expect(body.createdAt).toBeDefined()
    })

    it('returns the reason for a rejected project', async () => {
      const project = await createPending({ ...VALID_PROJECT, name: 'Reason Reject' })
      await operatorService.rejectProject(OPERATOR, project.id, 'not a fit for the platform')

      const res = await founderGet(`/projects/${project.id}/audit-reason`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.action).toBe('reject')
      expect(body.reason).toBe('not a fit for the platform')
    })

    it('returns the reason for a delisted project', async () => {
      const project = await createLive({ name: 'Reason Delist' })
      await operatorService.delistProject(OPERATOR, project.id, 'policy violation')

      const res = await founderGet(`/projects/${project.id}/audit-reason`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.action).toBe('delist')
      expect(body.reason).toBe('policy violation')
    })

    it('returns the latest reason when there are multiple', async () => {
      const project = await createPending({ ...VALID_PROJECT, name: 'Reason Latest' })
      await operatorService.requireProjectRevision(OPERATOR, project.id, 'first reason')
      // Founder reworks and resubmits, operator requires revision again.
      await projectService.saveDraft(project.id, { description: 'improved description' })
      await projectService.submitForReview(project.id)
      await operatorService.requireProjectRevision(OPERATOR, project.id, 'second reason')

      const res = await founderGet(`/projects/${project.id}/audit-reason`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.reason).toBe('second reason')
    })

    it('returns 404 for a live project with no relevant audit record', async () => {
      const project = await createLive({ name: 'No Reason' })
      const res = await founderGet(`/projects/${project.id}/audit-reason`)
      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('AUDIT_REASON_NOT_FOUND')
    })

    it('returns 404 for a draft with no audit record', async () => {
      const project = await createDraft({ name: 'Draft No Reason' })
      const res = await founderGet(`/projects/${project.id}/audit-reason`)
      expect(res.status).toBe(404)
    })

    it('returns 403 for another founder\'s project', async () => {
      const project = await createPending({ ...VALID_PROJECT, name: 'Owned By Founder' })
      await operatorService.rejectProject(OPERATOR, project.id, 'nope')
      const res = await founderGet(`/projects/${project.id}/audit-reason`, otherToken)
      expect(res.status).toBe(403)
    })

    it('returns 404 for a missing project', async () => {
      const res = await founderGet(`/projects/${NONEXISTENT_ID}/audit-reason`)
      expect(res.status).toBe(404)
    })

    it('returns 401 without a token', async () => {
      const res = await app.handle(new Request('http://localhost/founder/projects/1/audit-reason'))
      expect(res.status).toBe(401)
    })
  })

  // ── GET /founder/projects/:id/proposals ──────────────────────────────

  describe('GET /founder/projects/:id/proposals', () => {
    it('lists the founder\'s own proposals with status, changes, reason, reviewed_at', async () => {
      const project = await createLive({ name: 'Proposal List', description: 'original description' })
      const proposal = await projectService.createProposal(project.id, { description: 'updated' })
      const proposalId = (proposal as { id: number }).id
      await operatorService.approveProposal(OPERATOR, proposalId)

      const res = await founderGet(`/projects/${project.id}/proposals`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].id).toBe(proposalId)
      expect(body.data[0].status).toBe(ProposalStatus.Approved)
      expect(body.data[0].changes).toEqual({ description: 'updated' })
      expect(body.data[0].reviewedAt).toBeDefined()
    })

    it('returns 403 for another founder\'s project', async () => {
      const project = await createLive({ name: 'Proposal Owned' })
      await projectService.createProposal(project.id, { description: 'x' })
      const res = await founderGet(`/projects/${project.id}/proposals`, otherToken)
      expect(res.status).toBe(403)
    })

    it('returns 404 for a missing project', async () => {
      const res = await founderGet(`/projects/${NONEXISTENT_ID}/proposals`)
      expect(res.status).toBe(404)
    })

    it('returns 401 without a token', async () => {
      const res = await app.handle(new Request('http://localhost/founder/projects/1/proposals'))
      expect(res.status).toBe(401)
    })
  })
})
