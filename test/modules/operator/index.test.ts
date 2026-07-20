import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { auditRecords, projectEditProposals, projects, userIdentities } from '../../../src/db/schema'
import { operatorModule } from '../../../src/modules/operator'
import { projectService } from '../../../src/modules/project'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { Role } from '../../../src/modules/user-identity/model'
import { ProjectStatus, ProposalStatus } from '../../../src/modules/project/model'

const TEST_SECRET = 'dev-secret-change-in-production'
const OPERATOR = `test-operator-${crypto.randomUUID()}`
const REGULAR_USER = `test-user-${crypto.randomUUID()}`
const FOUNDER = `test-founder-${crypto.randomUUID()}`
const NONEXISTENT_ID = 2_000_000_000

const VALID_PROJECT: Record<string, unknown> = {
  name: 'Operator Test Project',
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
  return new Elysia().use(operatorModule)
}

async function signToken(payload: Record<string, unknown>) {
  const app = new Elysia().use(jwt({ name: 'jwt', secret: TEST_SECRET }))
  const { jwt: jwtInstance } = app.decorator
  return jwtInstance.sign(payload)
}

function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` }
}

function jsonHeaders(token: string) {
  return { ...authHeaders(token), 'content-type': 'application/json' }
}

describe('Operator routes', () => {
  const app = createApp()
  const userIdentity = new UserIdentityService(db)
  const projectIds: number[] = []
  const userIds = [OPERATOR, REGULAR_USER, FOUNDER]
  let operatorToken: string
  let regularToken: string

  async function createDraft(data: Record<string, unknown> = { name: 'Test' }) {
    const project = await projectService.createProject(FOUNDER, data)
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
    await projectService.approveProject(OPERATOR, project.id)
    return (await projectService.getProject(project.id))!
  }

  async function operatorPost(path: string, body?: Record<string, unknown>) {
    return app.handle(
      new Request(`http://localhost/operator${path}`, {
        method: 'POST',
        headers: body ? jsonHeaders(operatorToken) : authHeaders(operatorToken),
        body: body ? JSON.stringify(body) : undefined,
      }),
    )
  }

  async function operatorGet(path: string) {
    return app.handle(
      new Request(`http://localhost/operator${path}`, {
        headers: authHeaders(operatorToken),
      }),
    )
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    operatorToken = await signToken({ user_id: OPERATOR })
    regularToken = await signToken({ user_id: REGULAR_USER })
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
      const res = await app.handle(new Request('http://localhost/operator/projects'))
      expect(res.status).toBe(401)
    })

    it('returns 403 for a non-operator user', async () => {
      const res = await app.handle(
        new Request('http://localhost/operator/projects', {
          headers: authHeaders(regularToken),
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 403 for a non-operator on review actions', async () => {
      const project = await createPending()
      const res = await app.handle(
        new Request(`http://localhost/operator/projects/${project.id}/approve`, {
          method: 'POST',
          headers: authHeaders(regularToken),
        }),
      )
      expect(res.status).toBe(403)
    })
  })

  // ── Project-level review ─────────────────────────────────────────────

  describe('POST /operator/projects/:id/approve', () => {
    it('approves a pending project (1 → 3)', async () => {
      const project = await createPending()
      const res = await operatorPost(`/projects/${project.id}/approve`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe(ProjectStatus.Live)
    })

    it('returns 400 when approving a draft', async () => {
      const project = await createDraft()
      const res = await operatorPost(`/projects/${project.id}/approve`)
      expect(res.status).toBe(400)
    })

    it('returns 404 for a missing project', async () => {
      const res = await operatorPost(`/projects/${NONEXISTENT_ID}/approve`)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /operator/projects/:id/require-revision', () => {
    it('requires revision on a pending project (1 → 2)', async () => {
      const project = await createPending()
      const res = await operatorPost(`/projects/${project.id}/require-revision`, { reason: 'needs work' })
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe(ProjectStatus.RevisionRequired)
    })

    it('returns 400 when requiring revision on a draft', async () => {
      const project = await createDraft()
      const res = await operatorPost(`/projects/${project.id}/require-revision`, { reason: 'x' })
      expect(res.status).toBe(400)
    })

    it('returns 422 without a reason', async () => {
      const project = await createPending()
      const res = await operatorPost(`/projects/${project.id}/require-revision`, {})
      expect(res.status).toBe(422)
    })
  })

  describe('POST /operator/projects/:id/reject', () => {
    it('rejects a pending project (1 → 5, terminal)', async () => {
      const project = await createPending()
      const res = await operatorPost(`/projects/${project.id}/reject`, { reason: 'not a fit' })
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe(ProjectStatus.Rejected)
    })

    it('returns 400 when rejecting a live project', async () => {
      const project = await createLive()
      const res = await operatorPost(`/projects/${project.id}/reject`, { reason: 'x' })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /operator/projects/:id/delist', () => {
    it('delists a live project (3 → 4)', async () => {
      const project = await createLive()
      const res = await operatorPost(`/projects/${project.id}/delist`, { reason: 'policy violation' })
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe(ProjectStatus.Delisted)
    })

    it('returns 400 when delisting a non-live project', async () => {
      const project = await createPending()
      const res = await operatorPost(`/projects/${project.id}/delist`, { reason: 'x' })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /operator/projects/:id/restore', () => {
    it('restores a delisted project (4 → 3)', async () => {
      const project = await createLive()
      await operatorPost(`/projects/${project.id}/delist`, { reason: 'policy violation' })
      const res = await operatorPost(`/projects/${project.id}/restore`)
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe(ProjectStatus.Live)
    })

    it('returns 400 when restoring a non-delisted project', async () => {
      const project = await createLive()
      const res = await operatorPost(`/projects/${project.id}/restore`)
      expect(res.status).toBe(400)
    })
  })

  // ── Proposal-level review ────────────────────────────────────────────

  describe('POST /operator/proposals/:proposalId/approve', () => {
    it('approves a pending proposal and applies the diff (0 → 1)', async () => {
      const project = await createLive({ description: 'original description' })
      const proposal = await projectService.createProposal(project.id, { description: 'updated' })
      const proposalId = (proposal as { id: number }).id
      const res = await operatorPost(`/proposals/${proposalId}/approve`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe(ProposalStatus.Approved)
      const updated = await projectService.getProject(project.id)
      expect(updated!.description).toBe('updated')
      expect(updated!.status).toBe(ProjectStatus.Live)
    })

    it('returns 400 when approving an already-approved proposal', async () => {
      const project = await createLive()
      const proposal = await projectService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await operatorPost(`/proposals/${proposalId}/approve`)
      const res = await operatorPost(`/proposals/${proposalId}/approve`)
      expect(res.status).toBe(400)
    })

    it('returns 404 for a missing proposal', async () => {
      const res = await operatorPost(`/proposals/${NONEXISTENT_ID}/approve`)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /operator/proposals/:proposalId/reject', () => {
    it('rejects a pending proposal (0 → 2), project unchanged', async () => {
      const project = await createLive({ description: 'original description' })
      const proposal = await projectService.createProposal(project.id, { description: 'updated' })
      const proposalId = (proposal as { id: number }).id
      const res = await operatorPost(`/proposals/${proposalId}/reject`, { reason: 'no thanks' })
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe(ProposalStatus.Rejected)
      const unchanged = await projectService.getProject(project.id)
      expect(unchanged!.description).toBe('original description')
    })

    it('returns 400 when rejecting an already-rejected proposal', async () => {
      const project = await createLive()
      const proposal = await projectService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await operatorPost(`/proposals/${proposalId}/reject`, { reason: 'no' })
      const res = await operatorPost(`/proposals/${proposalId}/reject`, { reason: 'no again' })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /operator/proposals/:proposalId/require-revision', () => {
    it('requires revision on a pending proposal (0 → 3)', async () => {
      const project = await createLive()
      const proposal = await projectService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      const res = await operatorPost(`/proposals/${proposalId}/require-revision`, { reason: 'clarify' })
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe(ProposalStatus.RevisionRequired)
    })

    it('returns 400 when requiring revision on an approved proposal', async () => {
      const project = await createLive()
      const proposal = await projectService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await operatorPost(`/proposals/${proposalId}/approve`)
      const res = await operatorPost(`/proposals/${proposalId}/require-revision`, { reason: 'x' })
      expect(res.status).toBe(400)
    })
  })

  // ── Audit records ────────────────────────────────────────────────────

  describe('audit record creation', () => {
    it('project-level approve creates an audit record with null proposalId', async () => {
      const project = await createPending()
      await operatorPost(`/projects/${project.id}/approve`)
      const rows = await db.select().from(auditRecords).where(eq(auditRecords.projectId, project.id))
      const approve = rows.find((r) => r.action === 'approve')
      expect(approve).toBeDefined()
      expect(approve!.proposalId).toBeNull()
      expect(approve!.operatorId).toBe(OPERATOR)
    })

    it('project-level reject records the reason', async () => {
      const project = await createPending()
      await operatorPost(`/projects/${project.id}/reject`, { reason: 'not a fit' })
      const rows = await db.select().from(auditRecords).where(eq(auditRecords.projectId, project.id))
      const reject = rows.find((r) => r.action === 'reject')
      expect(reject!.reason).toBe('not a fit')
      expect(reject!.proposalId).toBeNull()
    })

    it('proposal-level approve sets proposalId', async () => {
      const project = await createLive()
      const proposal = await projectService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await operatorPost(`/proposals/${proposalId}/approve`)
      const rows = await db.select().from(auditRecords).where(eq(auditRecords.projectId, project.id))
      const approve = rows.find((r) => r.action === 'approve' && r.proposalId === proposalId)
      expect(approve).toBeDefined()
      expect(approve!.proposalId).toBe(proposalId)
    })

    it('proposal-level reject records reason and proposalId', async () => {
      const project = await createLive()
      const proposal = await projectService.createProposal(project.id, { description: 'x' })
      const proposalId = (proposal as { id: number }).id
      await operatorPost(`/proposals/${proposalId}/reject`, { reason: 'nope' })
      const rows = await db.select().from(auditRecords).where(eq(auditRecords.projectId, project.id))
      const reject = rows.find((r) => r.action === 'reject' && r.proposalId === proposalId)
      expect(reject!.reason).toBe('nope')
      expect(reject!.proposalId).toBe(proposalId)
    })
  })

  // ── Management lists ─────────────────────────────────────────────────

  describe('GET /operator/projects', () => {
    it('lists projects with pagination', async () => {
      await createPending({ ...VALID_PROJECT, name: 'List Test A' })
      const res = await operatorGet('/projects?limit=5')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeArray()
      expect(body.total).toBeGreaterThanOrEqual(1)
      expect(body.data.length).toBeLessThanOrEqual(5)
    })

    it('filters by status', async () => {
      const project = await createPending({ ...VALID_PROJECT, name: 'Status Filter' })
      const res = await operatorGet(`/projects?status=${ProjectStatus.PendingReview}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      const found = body.data.find((p: { id: number }) => p.id === project.id)
      expect(found).toBeDefined()
      expect(found.status).toBe(ProjectStatus.PendingReview)
    })

    it('filters by stage', async () => {
      const project = await createDraft({ ...VALID_PROJECT, name: 'Stage Filter', stage: 1 })
      const res = await operatorGet('/projects?stage=1')
      expect(res.status).toBe(200)
      const body = await res.json()
      const found = body.data.find((p: { id: number }) => p.id === project.id)
      expect(found).toBeDefined()
    })

    it('filters by category', async () => {
      const project = await createDraft({ ...VALID_PROJECT, name: 'Category Filter', categories: ['医疗健康'] })
      const res = await operatorGet('/projects?category=医疗健康')
      expect(res.status).toBe(200)
      const body = await res.json()
      const found = body.data.find((p: { id: number }) => p.id === project.id)
      expect(found).toBeDefined()
    })

    it('searches by name', async () => {
      const unique = `search-${crypto.randomUUID().slice(0, 8)}`
      await createDraft({ name: `Findable ${unique}` })
      const res = await operatorGet(`/projects?q=${unique}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      expect(body.data[0].name).toContain(unique)
    })

    it('sorts by updated_at ascending', async () => {
      const res = await operatorGet('/projects?sort=updated_at&order=asc&limit=5')
      expect(res.status).toBe(200)
      const body = await res.json()
      if (body.data.length >= 2) {
        const first = new Date(body.data[0].updatedAt).getTime()
        const last = new Date(body.data[body.data.length - 1].updatedAt).getTime()
        expect(first).toBeLessThanOrEqual(last)
      }
    })
  })

  describe('GET /operator/proposals', () => {
    it('lists only pending proposals', async () => {
      const project = await createLive()
      const proposal = await projectService.createProposal(project.id, { description: 'pending one' })
      const proposalId = (proposal as { id: number }).id

      const project2 = await createLive()
      const proposal2 = await projectService.createProposal(project2.id, { description: 'approved one' })
      await projectService.approveProposal(OPERATOR, (proposal2 as { id: number }).id)

      const res = await operatorGet('/proposals')
      expect(res.status).toBe(200)
      const body = await res.json()
      const pendingIds = body.data.map((p: { id: number }) => p.id)
      expect(pendingIds).toContain(proposalId)
      expect(pendingIds).not.toContain((proposal2 as { id: number }).id)
    })

    it('filters by projectId', async () => {
      const project = await createLive()
      const proposal = await projectService.createProposal(project.id, { description: 'filtered' })
      const proposalId = (proposal as { id: number }).id
      const res = await operatorGet(`/proposals?projectId=${project.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBe(1)
      expect(body.data[0].id).toBe(proposalId)
    })
  })

  describe('GET /operator/projects/:id/proposals', () => {
    it('lists all proposals for a project (any status)', async () => {
      const project = await createLive()
      const p1 = await projectService.createProposal(project.id, { description: 'first' })
      await projectService.approveProposal(OPERATOR, (p1 as { id: number }).id)
      const p2 = await projectService.createProposal(project.id, { description: 'second' })

      const res = await operatorGet(`/projects/${project.id}/proposals`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBe(2)
      expect(body.total).toBe(2)
    })

    it('returns 404 for a missing project', async () => {
      const res = await operatorGet(`/projects/${NONEXISTENT_ID}/proposals`)
      expect(res.status).toBe(404)
    })
  })

  // ── Audit record queries ─────────────────────────────────────────────

  describe('GET /operator/audit-records', () => {
    it('lists audit records', async () => {
      const project = await createPending()
      await operatorPost(`/projects/${project.id}/approve`)
      const res = await operatorGet(`/audit-records?projectId=${project.id}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      expect(body.data[0].projectId).toBe(project.id)
    })

    it('filters by time range', async () => {
      const project = await createPending()
      await operatorPost(`/projects/${project.id}/approve`)
      const params = new URLSearchParams({
        projectId: String(project.id),
        from: new Date(Date.now() - 60_000).toISOString(),
        to: new Date(Date.now() + 60_000).toISOString(),
      })
      const res = await operatorGet(`/audit-records?${params}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('returns empty for a future time range', async () => {
      const from = new Date(Date.now() + 86_400_000).toISOString()
      const to = new Date(Date.now() + 172_800_000).toISOString()
      const res = await operatorGet(`/audit-records?from=${from}&to=${to}`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data.length).toBe(0)
    })
  })

  // ── Statistics ───────────────────────────────────────────────────────

  describe('GET /operator/stats', () => {
    it('returns aggregated counts', async () => {
      await createPending({ ...VALID_PROJECT, name: 'Stats Project' })
      const res = await operatorGet('/stats')
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.totalProjects).toBeGreaterThanOrEqual(1)
      expect(body.byStatus).toBeObject()
      expect(body.byStage).toBeObject()
      expect(body.byCategory).toBeObject()
    })

    it('counts by status correctly', async () => {
      const before = await (await operatorGet('/stats')).json()
      await createLive({ ...VALID_PROJECT, name: 'Stats Live' })
      const after = await (await operatorGet('/stats')).json()
      const liveBefore = before.byStatus[String(ProjectStatus.Live)] ?? 0
      const liveAfter = after.byStatus[String(ProjectStatus.Live)] ?? 0
      expect(liveAfter).toBe(liveBefore + 1)
    })
  })
})
