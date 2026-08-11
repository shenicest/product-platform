import { afterAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../../src/db'
import { follows, projects, userIdentities } from '../../../src/db/schema'
import { ProjectStatus } from '../../../src/modules/project/model'
import { followModule } from '../../../src/modules/follow'
import { Role } from '../../../src/modules/user-identity/model'
import { authHeaders, signToken } from '../../fixtures/auth'

const FOLLOWER = `follow-user-${crypto.randomUUID()}`
const FOUNDER = `follow-founder-${crypto.randomUUID()}`
const OTHER_FOUNDER = `follow-founder-${crypto.randomUUID()}`
const VISITOR = `follow-visitor-${crypto.randomUUID()}`
const app = new Elysia().use(followModule)
const projectIds: number[] = []

async function request(userId: string, followeeUserId: string, method: 'POST' | 'DELETE') {
  const token = await signToken({ user_id: userId })
  return app.handle(new Request(`http://localhost/founders/${followeeUserId}/follow`, { method, headers: authHeaders(token) }))
}

describe('Follow routes', () => {
  afterAll(async () => {
    if (projectIds.length > 0) await db.delete(projects).where(inArray(projects.id, projectIds))
    await db.delete(follows).where(inArray(follows.followeeUserId, [FOUNDER, OTHER_FOUNDER, VISITOR]))
    await db.delete(follows).where(inArray(follows.followerUserId, [FOLLOWER, `other-${FOLLOWER}`]))
    await db.delete(userIdentities).where(inArray(userIdentities.userId, [FOUNDER, OTHER_FOUNDER, VISITOR]))
  })

  it('is idempotent and returns exactly the current caller follows', async () => {
    await db.insert(userIdentities).values([{ userId: FOUNDER, role: Role.Founder }, { userId: OTHER_FOUNDER, role: Role.Founder }])
    expect((await request(FOLLOWER, FOUNDER, 'POST')).status).toBe(200)
    expect((await request(FOLLOWER, FOUNDER, 'POST')).status).toBe(200)
    expect(await db.select().from(follows).where(and(eq(follows.followerUserId, FOLLOWER), eq(follows.followeeUserId, FOUNDER)))).toHaveLength(1)
    await request(`other-${FOLLOWER}`, OTHER_FOUNDER, 'POST')

    const token = await signToken({ user_id: FOLLOWER })
    const response = await app.handle(new Request('http://localhost/me/follows', { headers: authHeaders(token) }))
    expect(response.status).toBe(200)
    expect((await response.json()).followed_founder_user_ids).toEqual([FOUNDER])
  })

  it('makes unfollowing a never-followed founder a no-op', async () => {
    const response = await request(FOLLOWER, OTHER_FOUNDER, 'DELETE')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ followed: false, followerCount: 1 })
  })

  it('refuses self-follow and non-Founder targets', async () => {
    await db.insert(userIdentities).values({ userId: VISITOR, role: Role.Operator })
    const self = await request(FOUNDER, FOUNDER, 'POST')
    const notFounder = await request(FOLLOWER, VISITOR, 'POST')
    expect(self.status).toBe(400)
    expect((await self.json()).error.code).toBe('CANNOT_FOLLOW_SELF')
    expect(notFounder.status).toBe(400)
    expect((await notFounder.json()).error.code).toBe('NOT_A_FOUNDER')
  })

  it('allows unfollow after the target loses the Founder role', async () => {
    await request(FOLLOWER, OTHER_FOUNDER, 'POST')
    await db.delete(userIdentities).where(and(eq(userIdentities.userId, OTHER_FOUNDER), eq(userIdentities.role, Role.Founder)))
    const response = await request(FOLLOWER, OTHER_FOUNDER, 'DELETE')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ followed: false, followerCount: 1 })
  })

  describe('GET /me/following/projects', () => {
    async function createProject(userId: string, status: ProjectStatus, name: string, overrides: Partial<typeof projects.$inferInsert> = {}) {
      const [result] = await db.insert(projects).values({ userId, status, name, ...overrides })
      projectIds.push(result.insertId)
      return result.insertId
    }

    async function followingProjects(userId: string, query = '') {
      const token = await signToken({ user_id: userId })
      return app.handle(new Request(`http://localhost/me/following/projects${query}`, { headers: authHeaders(token) }))
    }

    it('requires authentication', async () => {
      expect((await app.handle(new Request('http://localhost/me/following/projects'))).status).toBe(401)
    })

    it('returns only Live projects from followed Founders', async () => {
      const followedLive = await createProject(FOUNDER, ProjectStatus.Live, `followed-live-${crypto.randomUUID()}`)
      const followedDraft = await createProject(FOUNDER, ProjectStatus.Draft, `followed-draft-${crypto.randomUUID()}`)
      const followedPending = await createProject(FOUNDER, ProjectStatus.PendingReview, `followed-pending-${crypto.randomUUID()}`)
      const followedDelisted = await createProject(FOUNDER, ProjectStatus.Delisted, `followed-delisted-${crypto.randomUUID()}`)
      const unfollowedLive = await createProject(OTHER_FOUNDER, ProjectStatus.Live, `unfollowed-live-${crypto.randomUUID()}`)
      await db.execute(sql`INSERT IGNORE INTO ${follows} (follower_user_id, followee_user_id) VALUES (${FOLLOWER}, ${FOUNDER})`)

      const body = await (await followingProjects(FOLLOWER)).json()
      const ids = body.data.map((project: { id: number }) => project.id)
      expect(ids).toContain(followedLive)
      expect(ids).not.toContain(followedDraft)
      expect(ids).not.toContain(followedPending)
      expect(ids).not.toContain(followedDelisted)
      expect(ids).not.toContain(unfollowedLive)
    })

    it('returns an empty page when the caller follows no Founders', async () => {
      const body = await (await followingProjects(`no-follows-${crypto.randomUUID()}`)).json()
      expect(body).toEqual({ data: [], total: 0 })
    })

    it('uses standard filters, sorting, and pagination', async () => {
      const prefix = `feed-${crypto.randomUUID()}`
      const older = await createProject(FOUNDER, ProjectStatus.Live, `${prefix}-older`, {
        categories: ['效率工具'], stage: 0, createdAt: new Date('2024-01-01T00:00:00Z'), updatedAt: new Date('2024-01-01T00:00:00Z'),
      })
      const newer = await createProject(FOUNDER, ProjectStatus.Live, `${prefix}-newer`, {
        categories: ['效率工具'], stage: 0, createdAt: new Date('2024-01-02T00:00:00Z'), updatedAt: new Date('2024-01-03T00:00:00Z'),
      })
      await createProject(FOUNDER, ProjectStatus.Live, `${prefix}-other-stage`, { categories: ['效率工具'], stage: 1 })
      await db.execute(sql`INSERT IGNORE INTO ${follows} (follower_user_id, followee_user_id) VALUES (${FOLLOWER}, ${FOUNDER})`)

      const filtered = await (await followingProjects(FOLLOWER, `?q=${prefix}&category=%E6%95%88%E7%8E%87%E5%B7%A5%E5%85%B7&stage=0&limit=1`)).json()
      expect(filtered.total).toBe(2)
      expect(filtered.data).toHaveLength(1)
      expect(filtered.data[0].id).toBe(newer)

      const secondPage = await (await followingProjects(FOLLOWER, `?q=${prefix}&category=%E6%95%88%E7%8E%87%E5%B7%A5%E5%85%B7&stage=0&limit=1&offset=1`)).json()
      expect(secondPage.data.map((project: { id: number }) => project.id)).toEqual([older])

      const updated = await (await followingProjects(FOLLOWER, `?q=${prefix}&stage=0&sort=recently_updated&limit=2`)).json()
      expect(updated.data[0].id).toBe(newer)
    })
  })
})
