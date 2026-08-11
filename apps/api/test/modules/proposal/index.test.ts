import { afterAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { projectEditProposals, projects, userIdentities } from '../../../src/db/schema'
import { proposalModule, proposalService } from '../../../src/modules/proposal'
import { ProjectService } from '../../../src/modules/project/service'
import { OperatorService } from '../../../src/modules/operator/service'
import { UserIdentityService } from '../../../src/modules/user-identity/service'
import { UserProfileService } from '../../../src/modules/user/service'
import { Role } from '../../../src/modules/user-identity/model'
import { ProjectStatus } from '../../../src/modules/project/model'
import { ProposalStatus } from '../../../src/modules/proposal/model'
import { authHeaders, jsonHeaders, signToken } from '../../fixtures/auth'
import { validProjectBody } from '../../fixtures/project'

const FOUNDER = `test-founder-${crypto.randomUUID()}`
const OTHER_FOUNDER = `test-founder-${crypto.randomUUID()}`
const OPERATOR = `test-operator-${crypto.randomUUID()}`
const NONEXISTENT_ID = 2_000_000_000

function createApp() {
  return new Elysia().use(proposalModule)
}

describe('Proposal routes', () => {
  const app = createApp()
  const userIdentity = new UserIdentityService(db)
  const userProfile = new UserProfileService(db)
  const projectService = new ProjectService(db, userIdentity, userProfile)
  const operatorService = new OperatorService(db)
  const projectIds: number[] = []
  const proposalIds: number[] = []
  const userIds = [FOUNDER, OTHER_FOUNDER, OPERATOR]

  async function createLiveProject(userId: string) {
    const project = await projectService.createProject(userId, validProjectBody())
    projectIds.push(project.id)
    await projectService.submitForReview(project.id)
    await operatorService.approveProject(OPERATOR, project.id)
    return (await projectService.getProject(project.id))!
  }

  async function createLiveProjectWithProposal(userId: string) {
    const project = await createLiveProject(userId)
    const proposal = await proposalService.createProposal(project.id, { name: 'Updated Name' })
    if ('id' in proposal) proposalIds.push(proposal.id)
    return { project, proposal }
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

  describe('POST /projects/:id/proposals', () => {
    it('returns 401 without a token', async () => {
      const project = await createLiveProject(FOUNDER)
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ changes: { name: 'New' } }),
        }),
      )
      expect(res.status).toBe(401)
    })

    it('creates a pending proposal on a live project', async () => {
      const project = await createLiveProject(FOUNDER)
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`, {
          method: 'POST',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { description: 'proposed change' } }),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      proposalIds.push(body.id)
      expect(body.status).toBe(ProposalStatus.Pending)
      expect(body.projectId).toBe(project.id)
      expect(body.changes).toEqual({ description: 'proposed change' })
    })

    it('returns 403 when creating a proposal on another founder\'s project', async () => {
      const project = await createLiveProject(FOUNDER)
      const token = await signToken({ user_id: OTHER_FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`, {
          method: 'POST',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { name: 'hijack' } }),
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 404 for a non-existent project', async () => {
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${NONEXISTENT_ID}/proposals`, {
          method: 'POST',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { name: 'X' } }),
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 400 when the project is not Live', async () => {
      const project = await projectService.createProject(FOUNDER, { name: 'Draft' })
      projectIds.push(project.id)
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`, {
          method: 'POST',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { name: 'X' } }),
        }),
      )
      expect(res.status).toBe(400)
    })

    it('returns 422 for empty changes', async () => {
      const project = await createLiveProject(FOUNDER)
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`, {
          method: 'POST',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: {} }),
        }),
      )
      expect(res.status).toBe(422)
    })

    it('returns 409 when a pending proposal already exists', async () => {
      const project = await createLiveProject(FOUNDER)
      const token = await signToken({ user_id: FOUNDER })
      const first = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`, {
          method: 'POST',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { name: 'first' } }),
        }),
      )
      expect(first.status).toBe(200)
      proposalIds.push((await first.json()).id)

      const second = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`, {
          method: 'POST',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { name: 'second' } }),
        }),
      )
      expect(second.status).toBe(409)
    })
  })

  describe('PUT /projects/:id/proposals/:proposalId', () => {
    it('returns 401 without a token', async () => {
      const { project, proposal } = await createLiveProjectWithProposal(FOUNDER)
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals/${(proposal as { id: number }).id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ changes: { name: 'X' } }),
        }),
      )
      expect(res.status).toBe(401)
    })

    it('updates a Revision Required proposal and returns it as Pending', async () => {
      const { project, proposal } = await createLiveProjectWithProposal(FOUNDER)
      const proposalId = (proposal as { id: number }).id
      await operatorService.requireProposalRevision(OPERATOR, proposalId, 'fix it')

      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals/${proposalId}`, {
          method: 'PUT',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { name: 'Revised Name' } }),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe(ProposalStatus.Pending)
      expect(body.changes).toEqual({ name: 'Revised Name' })
    })

    it('returns 400 when the proposal is not Revision Required', async () => {
      const { project, proposal } = await createLiveProjectWithProposal(FOUNDER)
      const proposalId = (proposal as { id: number }).id
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals/${proposalId}`, {
          method: 'PUT',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { name: 'X' } }),
        }),
      )
      expect(res.status).toBe(400)
    })

    it('returns 403 when editing another founder\'s proposal', async () => {
      const { project, proposal } = await createLiveProjectWithProposal(FOUNDER)
      const proposalId = (proposal as { id: number }).id
      await operatorService.requireProposalRevision(OPERATOR, proposalId, 'fix')

      const token = await signToken({ user_id: OTHER_FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals/${proposalId}`, {
          method: 'PUT',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { name: 'hijack' } }),
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 404 for a non-existent proposal', async () => {
      const project = await createLiveProject(FOUNDER)
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals/${NONEXISTENT_ID}`, {
          method: 'PUT',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { name: 'X' } }),
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 404 when the proposal belongs to a different project', async () => {
      const { proposal } = await createLiveProjectWithProposal(FOUNDER)
      const otherProject = await createLiveProject(FOUNDER)
      const proposalId = (proposal as { id: number }).id

      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${otherProject.id}/proposals/${proposalId}`, {
          method: 'PUT',
          headers: jsonHeaders(token),
          body: JSON.stringify({ changes: { name: 'X' } }),
        }),
      )
      expect(res.status).toBe(404)
    })
  })

  describe('GET /projects/:id/proposals', () => {
    it('returns 401 without authentication', async () => {
      const { project } = await createLiveProjectWithProposal(FOUNDER)
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`),
      )
      expect(res.status).toBe(401)
    })

    it('returns proposals to the owning founder', async () => {
      const { project, proposal } = await createLiveProjectWithProposal(FOUNDER)
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.total).toBe(1)
      expect(body.data[0].id).toBe((proposal as { id: number }).id)
      expect(body.data[0].changes).toEqual({ name: 'Updated Name' })
    })

    it('returns proposals to an operator', async () => {
      const { project } = await createLiveProjectWithProposal(FOUNDER)
      await userIdentity.grantRole(OPERATOR, Role.Operator)
      const token = await signToken({ user_id: OPERATOR })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.total).toBeGreaterThanOrEqual(1)
    })

    it('returns 403 for a non-owner non-operator', async () => {
      const { project } = await createLiveProjectWithProposal(FOUNDER)
      const token = await signToken({ user_id: OTHER_FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 404 for a non-existent project', async () => {
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${NONEXISTENT_ID}/proposals`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(404)
    })
  })

  describe('GET /projects/:id/proposals/:proposalId', () => {
    it('returns 401 without authentication', async () => {
      const { project, proposal } = await createLiveProjectWithProposal(FOUNDER)
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals/${(proposal as { id: number }).id}`),
      )
      expect(res.status).toBe(401)
    })

    it('returns the proposal to the owning founder', async () => {
      const { project, proposal } = await createLiveProjectWithProposal(FOUNDER)
      const proposalId = (proposal as { id: number }).id
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals/${proposalId}`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(proposalId)
      expect(body.changes).toEqual({ name: 'Updated Name' })
      expect(body.status).toBe(ProposalStatus.Pending)
    })

    it('returns the proposal to an operator', async () => {
      const { project, proposal } = await createLiveProjectWithProposal(FOUNDER)
      const proposalId = (proposal as { id: number }).id
      await userIdentity.grantRole(OPERATOR, Role.Operator)
      const token = await signToken({ user_id: OPERATOR })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals/${proposalId}`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(proposalId)
    })

    it('returns 403 for a non-owner non-operator', async () => {
      const { project, proposal } = await createLiveProjectWithProposal(FOUNDER)
      const proposalId = (proposal as { id: number }).id
      const token = await signToken({ user_id: OTHER_FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals/${proposalId}`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 404 for a non-existent proposal', async () => {
      const project = await createLiveProject(FOUNDER)
      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${project.id}/proposals/${NONEXISTENT_ID}`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 404 when the proposal belongs to a different project', async () => {
      const { proposal } = await createLiveProjectWithProposal(FOUNDER)
      const otherProject = await createLiveProject(FOUNDER)
      const proposalId = (proposal as { id: number }).id

      const token = await signToken({ user_id: FOUNDER })
      const res = await app.handle(
        new Request(`http://localhost/projects/${otherProject.id}/proposals/${proposalId}`, {
          headers: authHeaders(token),
        }),
      )
      expect(res.status).toBe(404)
    })
  })
})
