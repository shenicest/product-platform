import { afterAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { projectEditProposals, projects, userIdentities } from '../../../src/db/schema'
import { projectModule } from '../../../src/modules/project'
import { proposalService } from '../../../src/modules/proposal'
import { OperatorService } from '../../../src/modules/operator/service'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { Role } from '../../../src/modules/user-identity/model'
import { ProjectStatus } from '../../../src/modules/project/model'

const TEST_SECRET = 'dev-secret-change-in-production'
const FOUNDER = `test-founder-${crypto.randomUUID()}`
const OTHER_FOUNDER = `test-founder-${crypto.randomUUID()}`
const OPERATOR = `test-operator-${crypto.randomUUID()}`
const NONEXISTENT_ID = 2_000_000_000

// A complete project body that passes submitForReview's required-field validation.
const VALID_BODY = {
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

function createApp() {
  return new Elysia().use(projectModule)
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

describe('Project routes', () => {
  const app = createApp()
  const userIdentity = new UserIdentityService(db)
  const operatorService = new OperatorService(db)
  const projectIds: number[] = []
  const proposalIds: number[] = []
  const userIds = [FOUNDER, OTHER_FOUNDER, OPERATOR]

  async function createProjectAs(userId: string, body: Record<string, unknown>) {
    const token = await signToken({ user_id: userId })
    return app.handle(
      new Request('http://localhost/projects', {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify(body),
      }),
    )
  }

  async function draftAs(userId: string, projectId: number, body: Record<string, unknown>) {
    const token = await signToken({ user_id: userId })
    return app.handle(
      new Request(`http://localhost/projects/${projectId}/draft`, {
        method: 'PUT',
        headers: jsonHeaders(token),
        body: JSON.stringify(body),
      }),
    )
  }

  async function submitAs(userId: string, projectId: number) {
    const token = await signToken({ user_id: userId })
    return app.handle(
      new Request(`http://localhost/projects/${projectId}/submit`, {
        method: 'PUT',
        headers: authHeaders(token),
      }),
    )
  }

  afterAll(async () => {
    if (proposalIds.length > 0) {
      await db.delete(projectEditProposals).where(inArray(projectEditProposals.id, proposalIds))
    }
    if (projectIds.length > 0) {
      await db.delete(projects).where(inArray(projects.id, projectIds))
    }
    if (userIds.length > 0) {
      await db.delete(userIdentities).where(inArray(userIdentities.userId, userIds))
    }
  })

  describe('POST /projects', () => {
    it('returns 401 without a token', async () => {
      const res = await app.handle(
        new Request('http://localhost/projects', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'X' }),
        }),
      )
      expect(res.status).toBe(401)
    })

    it('creates a Draft project owned by the caller and grants the founder role', async () => {
      const res = await createProjectAs(FOUNDER, { name: 'My Idea' })
      expect(res.status).toBe(200)
      const body = await res.json()
      projectIds.push(body.id)
      expect(body.status).toBe(ProjectStatus.Draft)
      expect(body.userId).toBe(FOUNDER)
      expect(body.name).toBe('My Idea')
      expect(await userIdentity.hasRole(FOUNDER, Role.Founder)).toBe(true)
    })

    it('rejects a body without the minimum field (name)', async () => {
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request('http://localhost/projects', {
          method: 'POST',
          headers: jsonHeaders(token),
          body: JSON.stringify({ tagline: 'no name provided' }),
        }),
      )
      expect(res.status).toBe(422)
    })
  })

  describe('PUT /projects/:id/draft', () => {
    it('returns 401 without a token', async () => {
      const res = await app.handle(
        new Request('http://localhost/projects/1/draft', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'X' }),
        }),
      )
      expect(res.status).toBe(401)
    })

    it('updates the project in place across multiple saves (same row, no new records)', async () => {
      const created = await (await createProjectAs(FOUNDER, { name: 'v1' })).json()
      projectIds.push(created.id)

      const res1 = await draftAs(FOUNDER, created.id, { name: 'v2', tagline: 'tagline' })
      expect(res1.status).toBe(200)
      const res2 = await draftAs(FOUNDER, created.id, { name: 'v3', description: 'body' })
      expect(res2.status).toBe(200)

      const updated = await res2.json()
      expect(updated.id).toBe(created.id)
      expect(updated.name).toBe('v3')
      expect(updated.tagline).toBe('tagline')
      expect(updated.description).toBe('body')

      const rows = await db.select().from(projects).where(eq(projects.id, created.id))
      expect(rows).toHaveLength(1)
    })

    it('returns 403 when editing another founder\'s project', async () => {
      const created = await (await createProjectAs(FOUNDER, { name: 'Owned' })).json()
      projectIds.push(created.id)
      const res = await draftAs(OTHER_FOUNDER, created.id, { name: 'hijack' })
      expect(res.status).toBe(403)
    })

    it('returns 404 for a missing project', async () => {
      const res = await draftAs(FOUNDER, NONEXISTENT_ID, { name: 'X' })
      expect(res.status).toBe(404)
    })

    it('returns 400 when editing after status leaves Draft/Revision Required', async () => {
      const created = await (await createProjectAs(FOUNDER, VALID_BODY)).json()
      projectIds.push(created.id)
      const submitted = await submitAs(FOUNDER, created.id)
      expect(submitted.status).toBe(200)
      expect((await submitted.json()).status).toBe(ProjectStatus.PendingReview)

      const res = await draftAs(FOUNDER, created.id, { name: 'too late' })
      expect(res.status).toBe(400)
    })
  })

  describe('PUT /projects/:id/submit', () => {
    it('returns 401 without a token', async () => {
      const res = await app.handle(
        new Request('http://localhost/projects/1/submit', { method: 'PUT' }),
      )
      expect(res.status).toBe(401)
    })

    it('submits a complete project, transitioning to Pending Review', async () => {
      const created = await (await createProjectAs(FOUNDER, VALID_BODY)).json()
      projectIds.push(created.id)
      const res = await submitAs(FOUNDER, created.id)
      expect(res.status).toBe(200)
      expect((await res.json()).status).toBe(ProjectStatus.PendingReview)
    })

    it('returns 422 pointing to the first missing required field', async () => {
      const created = await (await createProjectAs(FOUNDER, { name: 'Only Name' })).json()
      projectIds.push(created.id)
      const res = await submitAs(FOUNDER, created.id)
      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error.code).toBe('MISSING_REQUIRED_FIELD')
      expect(body.error.field).toBe('tagline')
    })

    it('returns 403 when submitting another founder\'s project', async () => {
      const created = await (await createProjectAs(FOUNDER, VALID_BODY)).json()
      projectIds.push(created.id)
      const res = await submitAs(OTHER_FOUNDER, created.id)
      expect(res.status).toBe(403)
    })

    it('returns 404 for a missing project', async () => {
      const res = await submitAs(FOUNDER, NONEXISTENT_ID)
      expect(res.status).toBe(404)
    })
  })

  describe('GET /projects/:id', () => {
    async function createLiveProject(userId: string) {
      const created = await (await createProjectAs(userId, VALID_BODY)).json()
      projectIds.push(created.id)
      await submitAs(userId, created.id)
      await operatorService.approveProject(OPERATOR, created.id)
      return created
    }

    it('returns a Live project without authentication', async () => {
      const created = await createLiveProject(FOUNDER)
      const res = await app.handle(
        new Request(`http://localhost/projects/${created.id}`),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(created.id)
      expect(body.status).toBe(ProjectStatus.Live)
      expect(body.name).toBe(VALID_BODY.name)
    })

    it('returns 404 for a non-Live project without authentication', async () => {
      const created = await (await createProjectAs(FOUNDER, { name: 'Draft' })).json()
      projectIds.push(created.id)
      const res = await app.handle(
        new Request(`http://localhost/projects/${created.id}`),
      )
      expect(res.status).toBe(404)
    })

    it('returns 404 for a non-Live project as a non-owner authenticated user', async () => {
      const created = await (await createProjectAs(FOUNDER, { name: 'Draft' })).json()
      projectIds.push(created.id)
      const token = await signToken({ user_id: OTHER_FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${created.id}`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns a non-Live project to the owning founder', async () => {
      const created = await (await createProjectAs(FOUNDER, { name: 'My Draft' })).json()
      projectIds.push(created.id)
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${created.id}`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(created.id)
      expect(body.status).toBe(ProjectStatus.Draft)
    })

    it('returns any project to an operator', async () => {
      const created = await (await createProjectAs(FOUNDER, { name: 'Draft' })).json()
      projectIds.push(created.id)
      await userIdentity.grantRole(OPERATOR, Role.Operator)
      const token = await signToken({ user_id: OPERATOR })
      const res = await app.handle(
        new Request(`http://localhost/projects/${created.id}`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(created.id)
    })

    it('returns 404 for a non-existent project', async () => {
      const res = await app.handle(
        new Request(`http://localhost/projects/${NONEXISTENT_ID}`),
      )
      expect(res.status).toBe(404)
    })
  })

  describe('GET /projects', () => {
    async function createLiveProject(userId: string, overrides: Record<string, unknown> = {}) {
      const body = { ...VALID_BODY, ...overrides }
      const created = await (await createProjectAs(userId, body)).json()
      projectIds.push(created.id)
      await submitAs(userId, created.id)
      await operatorService.approveProject(OPERATOR, created.id)
      return created
    }

    it('is public — works without authentication', async () => {
      const res = await app.handle(new Request('http://localhost/projects'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toBeArray()
      expect(body.total).toBeNumber()
    })

    it('returns only Live projects', async () => {
      const draft = await (await createProjectAs(FOUNDER, { name: 'Draft Only' })).json()
      projectIds.push(draft.id)
      const live = await createLiveProject(FOUNDER, { name: 'Live Project' })

      const res = await app.handle(new Request('http://localhost/projects'))
      const body = await res.json()
      const ids = body.data.map((p: { id: number }) => p.id)
      expect(ids).toContain(live.id)
      expect(ids).not.toContain(draft.id)
      for (const p of body.data) {
        expect(p.status).toBe(ProjectStatus.Live)
      }
    })

    it('filters by category', async () => {
      const unique = `cat-${crypto.randomUUID().slice(0, 8)}`
      await createLiveProject(FOUNDER, { name: 'Cat Filter', categories: [unique] })
      await createLiveProject(FOUNDER, { name: 'No Cat', categories: ['其他'] })

      const res = await app.handle(new Request(`http://localhost/projects?category=${unique}`))
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      for (const p of body.data) {
        expect(p.categories).toContain(unique)
      }
    })

    it('filters by stage', async () => {
      await createLiveProject(FOUNDER, { name: 'Stage MVP', stage: 0 })
      await createLiveProject(FOUNDER, { name: 'Stage Growth', stage: 1 })

      const res = await app.handle(new Request('http://localhost/projects?stage=1'))
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      for (const p of body.data) {
        expect(p.stage).toBe(1)
      }
    })

    it('searches by project name', async () => {
      const unique = `findme-${crypto.randomUUID().slice(0, 8)}`
      await createLiveProject(FOUNDER, { name: `Findable ${unique}` })

      const res = await app.handle(new Request(`http://localhost/projects?q=${unique}`))
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      expect(body.data[0].name).toContain(unique)
    })

    it('searches by contact name', async () => {
      const unique = `contact-${crypto.randomUUID().slice(0, 8)}`
      await createLiveProject(FOUNDER, { name: 'Contact Search', contactName: unique })

      const res = await app.handle(new Request(`http://localhost/projects?q=${unique}`))
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      expect(body.data[0].contactName).toContain(unique)
    })

    it('searches by team name', async () => {
      const unique = `team-${crypto.randomUUID().slice(0, 8)}`
      await createLiveProject(FOUNDER, { name: 'Team Search', teamName: unique })

      const res = await app.handle(new Request(`http://localhost/projects?q=${unique}`))
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      expect(body.data[0].teamName).toContain(unique)
    })

    it('combines filters with AND logic', async () => {
      const unique = `combo-${crypto.randomUUID().slice(0, 8)}`
      await createLiveProject(FOUNDER, { name: `Combo ${unique}`, stage: 1, categories: [unique] })
      await createLiveProject(FOUNDER, { name: `Combo Other ${unique}`, stage: 0, categories: [unique] })

      const res = await app.handle(new Request(`http://localhost/projects?q=${unique}&stage=1`))
      const body = await res.json()
      expect(body.data.length).toBe(1)
      expect(body.data[0].stage).toBe(1)
      expect(body.data[0].name).toContain(unique)
    })

    it('sorts by latest (created_at desc) by default', async () => {
      await createLiveProject(FOUNDER, { name: 'Sort First' })
      await createLiveProject(FOUNDER, { name: 'Sort Second' })

      const res = await app.handle(new Request('http://localhost/projects?limit=100'))
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < body.data.length; i++) {
        const prev = new Date(body.data[i - 1].createdAt).getTime()
        const curr = new Date(body.data[i].createdAt).getTime()
        expect(prev).toBeGreaterThanOrEqual(curr)
      }
    })

    it('sorts by recently_updated', async () => {
      const project = await createLiveProject(FOUNDER, { name: 'Updated Sort' })
      const proposal = await proposalService.createProposal(project.id, { tagline: 'updated tagline' })
      expect(proposal).not.toBeInstanceOf(Error)
      proposalIds.push((proposal as { id: number }).id)
      await operatorService.approveProposal(OPERATOR, (proposal as { id: number }).id)

      const res = await app.handle(new Request('http://localhost/projects?sort=recently_updated&limit=5'))
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(2)
      for (let i = 1; i < body.data.length; i++) {
        const prev = new Date(body.data[i - 1].updatedAt).getTime()
        const curr = new Date(body.data[i].updatedAt).getTime()
        expect(prev).toBeGreaterThanOrEqual(curr)
      }
    })

    it('paginates with offset and limit', async () => {
      await createLiveProject(FOUNDER, { name: 'Page A' })
      await createLiveProject(FOUNDER, { name: 'Page B' })
      await createLiveProject(FOUNDER, { name: 'Page C' })

      const page1 = await (await app.handle(new Request('http://localhost/projects?limit=2&offset=0'))).json()
      const page2 = await (await app.handle(new Request('http://localhost/projects?limit=2&offset=2'))).json()

      expect(page1.data.length).toBeLessThanOrEqual(2)
      expect(page2.data.length).toBeLessThanOrEqual(2)
      const page1Ids = new Set(page1.data.map((p: { id: number }) => p.id))
      for (const p of page2.data) {
        expect(page1Ids.has(p.id)).toBe(false)
      }
    })

    it('returns empty array when no projects match', async () => {
      const res = await app.handle(new Request('http://localhost/projects?q=zzz-nonexistent-zzz'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.data).toEqual([])
      expect(body.total).toBe(0)
    })

    it('includes expected fields in each list item', async () => {
      await createLiveProject(FOUNDER, {
        name: 'Fields Check',
        tagline: 'a tagline',
        coverUrl: 'https://example.com/cover.png',
        stage: 0,
        categories: ['效率工具'],
        contactName: 'Founder Nick',
      })

      const res = await app.handle(new Request('http://localhost/projects?q=Fields Check'))
      const body = await res.json()
      expect(body.data.length).toBeGreaterThanOrEqual(1)
      const item = body.data.find((p: { name: string }) => p.name === 'Fields Check')
      expect(item).toBeDefined()
      expect(item.coverUrl).toBe('https://example.com/cover.png')
      expect(item.tagline).toBe('a tagline')
      expect(item.stage).toBe(0)
      expect(item.categories).toContain('效率工具')
      expect(item.contactName).toBe('Founder Nick')
    })
  })
})
