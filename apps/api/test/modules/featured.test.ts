import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../src/db'
import { auditRecords, featuredProjects, projects, userIdentities } from '../../src/db/schema'
import { projectModule, projectService } from '../../src/modules/project'
import { operatorModule } from '../../src/modules/operator'
import { OperatorService } from '../../src/modules/operator/service'
import { UserIdentityService } from '../../src/modules/user-identity/service'
import { Role } from '../../src/modules/user-identity/model'
import { ProjectStatus } from '../../src/modules/project/model'
import { authHeaders, jsonHeaders, signToken } from '../fixtures/auth'
import { validProjectBody } from '../fixtures/project'

const FOUNDER = `test-founder-${crypto.randomUUID()}`
const OPERATOR = `test-operator-${crypto.randomUUID()}`

function createApp() {
  return new Elysia().use(projectModule).use(operatorModule)
}

describe('Featured projects', () => {
  const app = createApp()
  const userIdentity = new UserIdentityService(db)
  const operatorService = new OperatorService(db)
  const projectIds: number[] = []
  const userIds = [FOUNDER, OPERATOR]
  let operatorToken: string

  async function createLive(name: string) {
    const project = await projectService.createProject(FOUNDER, validProjectBody({ name }))
    projectIds.push(project.id)
    await projectService.submitForReview(project.id)
    await operatorService.approveProject(OPERATOR, project.id)
    return (await projectService.getProject(project.id))!
  }

  async function putFeatured(projectIdsBody: number[], token = operatorToken) {
    return app.handle(
      new Request('http://localhost/operator/featured-projects', {
        method: 'PUT',
        headers: jsonHeaders(token),
        body: JSON.stringify({ projectIds: projectIdsBody }),
      }),
    )
  }

  async function getFeatured() {
    return app.handle(new Request('http://localhost/projects/featured'))
  }

  beforeAll(async () => {
    await userIdentity.grantRole(OPERATOR, Role.Operator)
    operatorToken = await signToken({ user_id: OPERATOR })
  })

  beforeEach(async () => {
    await db.delete(featuredProjects)
  })

  afterAll(async () => {
    await db.delete(featuredProjects)
    if (projectIds.length > 0) {
      await db.delete(auditRecords).where(inArray(auditRecords.projectId, projectIds))
      await db.delete(projects).where(inArray(projects.id, projectIds))
    }
    await db.delete(userIdentities).where(inArray(userIdentities.userId, userIds))
  })

  it('returns an empty public list when nothing is configured', async () => {
    const res = await getFeatured()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: [], total: 0 })
  })

  it('saves the operator-configured order and exposes it publicly', async () => {
    const first = await createLive('First featured')
    const second = await createLive('Second featured')

    const save = await putFeatured([second.id, first.id])
    expect(save.status).toBe(200)
    const saved = await save.json()
    expect(saved.data.map((project: { id: number }) => project.id)).toEqual([second.id, first.id])
    expect(saved.data.map((project: { sortOrder: number }) => project.sortOrder)).toEqual([0, 1])

    const publicRes = await getFeatured()
    expect(publicRes.status).toBe(200)
    const body = await publicRes.json()
    expect(body.total).toBe(2)
    expect(body.data.map((project: { id: number }) => project.id)).toEqual([second.id, first.id])
  })

  it('hides the section content when the operator clears the list', async () => {
    const project = await createLive('Only featured')
    await putFeatured([project.id])

    const clear = await putFeatured([])
    expect(clear.status).toBe(200)
    expect((await clear.json()).data).toEqual([])

    expect(await (await getFeatured()).json()).toEqual({ data: [], total: 0 })
  })

  it('rejects non-live projects', async () => {
    const draft = await projectService.createProject(FOUNDER, { name: 'Still a draft' })
    projectIds.push(draft.id)

    const res = await putFeatured([draft.id])
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_FEATURED_PROJECT')
  })

  it('rejects non-operators', async () => {
    const project = await createLive('Guarded')
    const founderToken = await signToken({ user_id: FOUNDER })
    const res = await putFeatured([project.id], founderToken)
    expect(res.status).toBe(403)
  })

  it('omits a configured project once it is delisted', async () => {
    const kept = await createLive('Kept')
    const delisted = await createLive('Delisted')
    await putFeatured([delisted.id, kept.id])

    await operatorService.delistProject(OPERATOR, delisted.id, 'hide it')

    const body = await (await getFeatured()).json()
    expect(body.data.map((project: { id: number }) => project.id)).toEqual([kept.id])

    expect((await projectService.getProject(delisted.id))!.status).toBe(ProjectStatus.Delisted)
    const config = await app.handle(
      new Request('http://localhost/operator/featured-projects', {
        headers: authHeaders(operatorToken),
      }),
    )
    expect((await config.json()).total).toBe(2)
  })

  it('requires authentication for the operator config', async () => {
    const getRes = await app.handle(new Request('http://localhost/operator/featured-projects'))
    expect(getRes.status).toBe(401)
  })
})
