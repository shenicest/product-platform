import { afterAll, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../../src/db'
import { follows, userIdentities } from '../../../src/db/schema'
import { followModule } from '../../../src/modules/follow'
import { Role } from '../../../src/modules/user-identity/model'
import { authHeaders, signToken } from '../../fixtures/auth'

const FOLLOWER = `follow-user-${crypto.randomUUID()}`
const FOUNDER = `follow-founder-${crypto.randomUUID()}`
const OTHER_FOUNDER = `follow-founder-${crypto.randomUUID()}`
const VISITOR = `follow-visitor-${crypto.randomUUID()}`
const app = new Elysia().use(followModule)

async function request(userId: string, followeeUserId: string, method: 'POST' | 'DELETE') {
  const token = await signToken({ user_id: userId })
  return app.handle(new Request(`http://localhost/founders/${followeeUserId}/follow`, { method, headers: authHeaders(token) }))
}

describe('Follow routes', () => {
  afterAll(async () => {
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
})
