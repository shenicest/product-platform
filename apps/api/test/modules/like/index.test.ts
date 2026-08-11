import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { projectLikes, projects } from '../../../src/db/schema'
import { likeModule } from '../../../src/modules/like'
import { ProjectStatus } from '../../../src/modules/project/model'
import { authHeaders, signToken } from '../../fixtures/auth'

const USER = `like-user-${crypto.randomUUID()}`
const OTHER_USER = `like-other-${crypto.randomUUID()}`
const MIXED_USER = `like-mixed-${crypto.randomUUID()}`
const projectIds: number[] = []
const app = new Elysia().use(likeModule)

async function createProject(status: number) {
  const [result] = await db.insert(projects).values({ userId: 'like-founder', name: `Like test ${status}`, status })
  projectIds.push(result.insertId)
  return result.insertId
}

async function request(projectId: number, method: 'POST' | 'DELETE', userId = USER) {
  const token = await signToken({ user_id: userId })
  return app.handle(new Request(`http://localhost/projects/${projectId}/like`, { method, headers: authHeaders(token) }))
}

describe('Like routes', () => {
  beforeAll(async () => {
    await db.delete(projectLikes).where(eq(projectLikes.userId, USER))
  })

  afterAll(async () => {
    if (projectIds.length) await db.delete(projectLikes).where(inArray(projectLikes.projectId, projectIds))
    if (projectIds.length) await db.delete(projects).where(inArray(projects.id, projectIds))
  })

  it('is idempotent and increments only once', async () => {
    const projectId = await createProject(ProjectStatus.Live)
    expect((await request(projectId, 'POST')).status).toBe(200)
    expect((await request(projectId, 'POST')).status).toBe(200)
    const rows = await db.select().from(projectLikes).where(eq(projectLikes.projectId, projectId))
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    expect(rows).toHaveLength(1)
    expect(project.likeCount).toBe(1)
  })

  it('unliking a project never liked is a no-op', async () => {
    const projectId = await createProject(ProjectStatus.Live)
    const response = await request(projectId, 'DELETE')
    expect(response.status).toBe(200)
    expect((await response.json()).likeCount).toBe(0)
  })

  it('rejects creating likes for every non-Live status', async () => {
    for (const status of [ProjectStatus.Draft, ProjectStatus.PendingReview, ProjectStatus.RevisionRequired, ProjectStatus.Delisted, ProjectStatus.Rejected]) {
      const projectId = await createProject(status)
      const response = await request(projectId, 'POST')
      expect(response.status).toBe(409)
      expect((await response.json()).error.code).toBe('NOT_LIKABLE')
    }
  })

  it('allows an existing like to be removed after delisting', async () => {
    const projectId = await createProject(ProjectStatus.Live)
    await request(projectId, 'POST')
    await db.update(projects).set({ status: ProjectStatus.Delisted }).where(eq(projects.id, projectId))
    const response = await request(projectId, 'DELETE')
    expect(response.status).toBe(200)
    expect((await response.json()).likeCount).toBe(0)
  })

  it('does not double-count concurrent likes from one user', async () => {
    const projectId = await createProject(ProjectStatus.Live)
    await Promise.all([request(projectId, 'POST'), request(projectId, 'POST'), request(projectId, 'POST')])
    const [project] = await db.select().from(projects).where(eq(projects.id, projectId))
    expect(project.likeCount).toBe(1)
  })

  it('returns exactly the current caller\'s likes', async () => {
    const first = await createProject(ProjectStatus.Live)
    const second = await createProject(ProjectStatus.Live)
    await request(first, 'POST', MIXED_USER)
    await request(second, 'POST', OTHER_USER)
    const token = await signToken({ user_id: MIXED_USER })
    const response = await app.handle(new Request('http://localhost/me/likes', { headers: authHeaders(token) }))
    expect(response.status).toBe(200)
    expect((await response.json()).liked_project_ids).toEqual([first])
  })
})
