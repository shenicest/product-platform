import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../src/db'
import { auditRecords, projectEditProposals, projects, userIdentities } from '../../src/db/schema'
import { app } from '../../src/app'
import { UserIdentityService } from '../../src/modules/user-identity/service'
import { Role } from '../../src/modules/user-identity/model'
import { ProjectStatus } from '../../src/modules/project/model'
import { ProposalStatus } from '../../src/modules/proposal/model'
import { authHeaders, jsonHeaders, signToken } from '../fixtures/auth'
import { validProjectBody } from '../fixtures/project'

const FOUNDER = `test-founder-${crypto.randomUUID()}`
const OTHER_FOUNDER = `test-founder-${crypto.randomUUID()}`
const OPERATOR = `test-operator-${crypto.randomUUID()}`
const REGULAR_USER = `test-regular-${crypto.randomUUID()}`

let founderToken: string
let otherFounderToken: string
let operatorToken: string
let regularToken: string

describe('Composed app flows', () => {
  const userIdentity = new UserIdentityService(db)
  const projectIds: number[] = []
  const proposalIds: number[] = []
  const userIds = [FOUNDER, OTHER_FOUNDER, OPERATOR, REGULAR_USER]

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    founderToken = await signToken({ user_id: FOUNDER })
    otherFounderToken = await signToken({ user_id: OTHER_FOUNDER })
    operatorToken = await signToken({ user_id: OPERATOR })
    regularToken = await signToken({ user_id: REGULAR_USER })
  })

  afterAll(async () => {
    if (proposalIds.length > 0) {
      await db.delete(projectEditProposals).where(inArray(projectEditProposals.id, proposalIds))
    }
    if (projectIds.length > 0) {
      await db.delete(auditRecords).where(inArray(auditRecords.projectId, projectIds))
      await db.delete(projects).where(inArray(projects.id, projectIds))
    }
    if (userIds.length > 0) {
      await db.delete(userIdentities).where(inArray(userIdentities.userId, userIds))
    }
  })

  async function createProjectAsFounder(body: Record<string, unknown> = validProjectBody()) {
    const res = await app.handle(
      new Request('http://localhost/projects', {
        method: 'POST',
        headers: jsonHeaders(founderToken),
        body: JSON.stringify(body),
      }),
    )
    expect(res.status).toBe(200)
    const project = await res.json()
    projectIds.push(project.id)
    return project
  }

  async function submitProject(projectId: number) {
    const res = await app.handle(
      new Request(`http://localhost/projects/${projectId}/submit`, {
        method: 'PUT',
        headers: authHeaders(founderToken),
      }),
    )
    expect(res.status).toBe(200)
    return res.json()
  }

  async function approveProject(projectId: number) {
    const res = await app.handle(
      new Request(`http://localhost/operator/projects/${projectId}/approve`, {
        method: 'POST',
        headers: authHeaders(operatorToken),
      }),
    )
    expect(res.status).toBe(200)
    return res.json()
  }

  describe('Flow A: founder submits → operator approves → public visibility', () => {
    it('completes the full submission and approval flow', async () => {
      const draft = await createProjectAsFounder()
      expect(draft.status).toBe(ProjectStatus.Draft)
      expect(draft.userId).toBe(FOUNDER)

      const pending = await submitProject(draft.id)
      expect(pending.status).toBe(ProjectStatus.PendingReview)

      const live = await approveProject(draft.id)
      expect(live.status).toBe(ProjectStatus.Live)

      const publicRes = await app.handle(
        new Request(`http://localhost/projects/${draft.id}`),
      )
      expect(publicRes.status).toBe(200)
      const publicProject = await publicRes.json()
      expect(publicProject.id).toBe(draft.id)
      expect(publicProject.status).toBe(ProjectStatus.Live)

      const listRes = await app.handle(
        new Request('http://localhost/projects'),
      )
      expect(listRes.status).toBe(200)
      const list = await listRes.json()
      const found = list.data.find((p: { id: number }) => p.id === draft.id)
      expect(found).toBeDefined()
      expect(found.status).toBe(ProjectStatus.Live)

      const founderListRes = await app.handle(
        new Request('http://localhost/founder/projects', {
          headers: authHeaders(founderToken),
        }),
      )
      expect(founderListRes.status).toBe(200)
      const founderList = await founderListRes.json()
      const founderFound = founderList.data.find((p: { id: number }) => p.id === draft.id)
      expect(founderFound).toBeDefined()
    })
  })

  describe('Flow B: proposal lifecycle', () => {
    it('founder creates proposal → operator requires revision → founder revises → operator approves', async () => {
      const draft = await createProjectAsFounder()
      await submitProject(draft.id)
      const live = await approveProject(draft.id)
      expect(live.status).toBe(ProjectStatus.Live)

      const proposalRes = await app.handle(
        new Request(`http://localhost/projects/${draft.id}/proposals`, {
          method: 'POST',
          headers: jsonHeaders(founderToken),
          body: JSON.stringify({ changes: { tagline: 'Updated tagline' } }),
        }),
      )
      expect(proposalRes.status).toBe(200)
      const proposal = await proposalRes.json()
      proposalIds.push(proposal.id)
      expect(proposal.status).toBe(ProposalStatus.Pending)
      expect(proposal.changes.tagline).toBe('Updated tagline')

      const revisionRes = await app.handle(
        new Request(`http://localhost/operator/proposals/${proposal.id}/require-revision`, {
          method: 'POST',
          headers: { ...jsonHeaders(operatorToken), 'content-type': 'application/json' },
          body: JSON.stringify({ reason: 'Needs more detail' }),
        }),
      )
      expect(revisionRes.status).toBe(200)
      const revised = await revisionRes.json()
      expect(revised.status).toBe(ProposalStatus.RevisionRequired)

      const updateRes = await app.handle(
        new Request(`http://localhost/projects/${draft.id}/proposals/${proposal.id}`, {
          method: 'PUT',
          headers: jsonHeaders(founderToken),
          body: JSON.stringify({ changes: { tagline: 'Updated tagline v2' } }),
        }),
      )
      expect(updateRes.status).toBe(200)
      const updated = await updateRes.json()
      expect(updated.changes.tagline).toBe('Updated tagline v2')

      const approveProposalRes = await app.handle(
        new Request(`http://localhost/operator/proposals/${proposal.id}/approve`, {
          method: 'POST',
          headers: authHeaders(operatorToken),
        }),
      )
      expect(approveProposalRes.status).toBe(200)
      const approved = await approveProposalRes.json()
      expect(approved.status).toBe(ProposalStatus.Approved)

      const projectRes = await app.handle(
        new Request(`http://localhost/projects/${draft.id}`),
      )
      expect(projectRes.status).toBe(200)
      const project = await projectRes.json()
      expect(project.tagline).toBe('Updated tagline v2')
    })
  })

  describe('Flow C: authorization matrix', () => {
    it('GET /founder/projects requires founder role', async () => {
      const noTokenRes = await app.handle(
        new Request('http://localhost/founder/projects'),
      )
      expect(noTokenRes.status).toBe(401)

      const regularRes = await app.handle(
        new Request('http://localhost/founder/projects', {
          headers: authHeaders(regularToken),
        }),
      )
      expect(regularRes.status).toBe(403)

      const operatorRes = await app.handle(
        new Request('http://localhost/founder/projects', {
          headers: authHeaders(operatorToken),
        }),
      )
      expect(operatorRes.status).toBe(403)

      const founderRes = await app.handle(
        new Request('http://localhost/founder/projects', {
          headers: authHeaders(founderToken),
        }),
      )
      expect(founderRes.status).toBe(200)
    })

    it('GET /operator/projects requires operator role', async () => {
      const noTokenRes = await app.handle(
        new Request('http://localhost/operator/projects'),
      )
      expect(noTokenRes.status).toBe(401)

      const founderRes = await app.handle(
        new Request('http://localhost/operator/projects', {
          headers: authHeaders(founderToken),
        }),
      )
      expect(founderRes.status).toBe(403)

      const operatorRes = await app.handle(
        new Request('http://localhost/operator/projects', {
          headers: authHeaders(operatorToken),
        }),
      )
      expect(operatorRes.status).toBe(200)
    })

    it('GET /identity/roles requires authentication only', async () => {
      const noTokenRes = await app.handle(
        new Request('http://localhost/identity/roles'),
      )
      expect(noTokenRes.status).toBe(401)

      const regularRes = await app.handle(
        new Request('http://localhost/identity/roles', {
          headers: authHeaders(regularToken),
        }),
      )
      expect(regularRes.status).toBe(200)

      const founderRes = await app.handle(
        new Request('http://localhost/identity/roles', {
          headers: authHeaders(founderToken),
        }),
      )
      expect(founderRes.status).toBe(200)
    })

    it('POST /projects requires authentication', async () => {
      const noTokenRes = await app.handle(
        new Request('http://localhost/projects', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Test' }),
        }),
      )
      expect(noTokenRes.status).toBe(401)
    })

    it('GET /me/bearer requires authentication', async () => {
      const noTokenRes = await app.handle(
        new Request('http://localhost/me/bearer'),
      )
      expect(noTokenRes.status).toBe(401)

      const authRes = await app.handle(
        new Request('http://localhost/me/bearer', {
          headers: authHeaders(regularToken),
        }),
      )
      expect(authRes.status).toBe(200)
    })
  })
})
