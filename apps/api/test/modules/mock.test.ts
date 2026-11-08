import { afterAll, afterEach, describe, expect, it } from 'bun:test'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../src/db'
import { organizerOrgs, userIdentities } from '../../src/db/schema'
import { app } from '../../src/app'
import { MOCK_USERS, signMockToken } from '../../src/mock'
import { Role } from '../../src/modules/user-identity/model'
import { UserIdentityService } from '../../src/modules/user-identity/service'

const userIdentity = new UserIdentityService(db)

const byKey = (key: string) => MOCK_USERS.find((u) => u.key === key)!
const OPERATOR = byKey('operator')
const GUEST = byKey('guest')
const ORGANIZER = byKey('organizer')
const NO_PROFILE = byKey('founder-no-profile')
const ADMIN = byKey('admin')

/** 这些 mock 用户的 id 号段（9000+）不应出现在库里；用于断言“真的没查库”。 */
const MOCK_USER_IDS = MOCK_USERS.filter((u) => u.overrides !== false).map((u) => u.userId)

const cookieFor = async (key: string) => {
  const token = await signMockToken(byKey(key))
  return { cookie: `shenicest_token=${token}` }
}

afterEach(() => {
  delete process.env.MOCK_AUTH
  delete process.env.NODE_ENV
})

afterAll(async () => {
  // Defensive: the mock layer must never have written rows for mock users.
  // Each test cleans up after itself; this only catches a test that threw
  // mid-way, so it must tolerate a table that another suite already dropped.
  try {
    await db.delete(userIdentities).where(inArray(userIdentities.userId, MOCK_USER_IDS))
  } catch {}
})

describe('Mock session — HTTP endpoints', () => {
  it('lists mock users and reports no active session without a cookie', async () => {
    process.env.NODE_ENV = 'development'
    const res = await app.handle(new Request('http://localhost/mock/users'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.active).toBeNull()
    expect(body.users.length).toBe(MOCK_USERS.length)
    expect(body.users.map((u: { key: string }) => u.key)).toEqual(MOCK_USERS.map((u) => u.key))
    // No internal fields leak to the client.
    expect(body.users[0]).not.toHaveProperty('overrides')
    expect(body.users[0]).not.toHaveProperty('sharedProfile')
  })

  it('switches the session by writing the shenicest_token cookie', async () => {
    process.env.NODE_ENV = 'development'
    const res = await app.handle(
      new Request('http://localhost/mock/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: OPERATOR.key }),
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ active: OPERATOR.key })

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('shenicest_token=')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Lax')
  })

  it('reports the active mock user back when the cookie is replayed', async () => {
    process.env.NODE_ENV = 'development'
    const cookie = await cookieFor(OPERATOR.key)
    const res = await app.handle(new Request('http://localhost/mock/users', { headers: cookie }))
    expect((await res.json()).active).toBe(OPERATOR.key)
  })

  it('logs out when key is null', async () => {
    process.env.NODE_ENV = 'development'
    const res = await app.handle(
      new Request('http://localhost/mock/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: null }),
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ active: null })
    expect(res.headers.get('set-cookie') ?? '').toContain('Max-Age=0')
  })

  it('rejects an unknown mock user key', async () => {
    process.env.NODE_ENV = 'development'
    const res = await app.handle(
      new Request('http://localhost/mock/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: 'no-such-user' }),
      }),
    )
    expect(res.status).toBe(400)
  })

  it('hides the endpoints entirely when mock auth is off', async () => {
    process.env.NODE_ENV = 'development'
    process.env.MOCK_AUTH = 'off'
    const list = await app.handle(new Request('http://localhost/mock/users'))
    expect(list.status).toBe(404)

    const switchRes = await app.handle(
      new Request('http://localhost/mock/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ key: OPERATOR.key }),
      }),
    )
    expect(switchRes.status).toBe(404)
  })
})

describe('Mock session — identity surfaces', () => {
  it('/me returns the mock user profile', async () => {
    process.env.NODE_ENV = 'development'
    const res = await app.handle(new Request('http://localhost/me', { headers: await cookieFor('guest') }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.user_id).toBe(Number(GUEST.userId))
    expect(body.user.email).toBe(GUEST.email)
    expect(body.user).not.toHaveProperty('mock')
  })

  it('/identity/roles reflects fixtures, not the database', async () => {
    process.env.NODE_ENV = 'development'
    const opRes = await app.handle(
      new Request('http://localhost/identity/roles', { headers: await cookieFor(OPERATOR.key) }),
    )
    expect(await opRes.json()).toEqual({ roles: [Role.Operator] })

    const guestRes = await app.handle(
      new Request('http://localhost/identity/roles', { headers: await cookieFor(GUEST.key) }),
    )
    expect(await guestRes.json()).toEqual({ roles: [] })

    const adminRes = await app.handle(
      new Request('http://localhost/identity/roles', { headers: await cookieFor(ADMIN.key) }),
    )
    expect((await adminRes.json()).roles.sort()).toEqual([Role.Founder, Role.Operator].sort())
  })

  it('grants operator-only routes to the operator mock user', async () => {
    process.env.NODE_ENV = 'development'
    const res = await app.handle(
      new Request('http://localhost/identity/users/9004/roles', { headers: await cookieFor(OPERATOR.key) }),
    )
    expect(res.status).toBe(200)
  })

  it('denies operator-only routes to the roleless mock user', async () => {
    process.env.NODE_ENV = 'development'
    const res = await app.handle(
      new Request('http://localhost/identity/users/9001/roles', { headers: await cookieFor(GUEST.key) }),
    )
    expect(res.status).toBe(403)
  })

  it('denies founder-only routes to the roleless mock user', async () => {
    process.env.NODE_ENV = 'development'
    const res = await app.handle(
      new Request('http://localhost/founder/stats', { headers: await cookieFor(GUEST.key) }),
    )
    expect(res.status).toBe(403)
  })

  it('allows founder-only routes to the founder mock user', async () => {
    process.env.NODE_ENV = 'development'
    const res = await app.handle(
      new Request('http://localhost/founder/stats', { headers: await cookieFor('founder') }),
    )
    expect(res.status).toBe(200)
  })

  it('/founder/profile serves the fixture profile without a shared users row', async () => {
    process.env.NODE_ENV = 'development'
    const founder = byKey('founder')
    const res = await app.handle(
      new Request('http://localhost/founder/profile', { headers: await cookieFor(founder.key) }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      nickname: founder.sharedProfile!.nickname,
      avatarUrl: founder.sharedProfile!.avatarUrl,
    })
  })

  it('/founder/profile degrades to nulls for a mock user without a profile', async () => {
    process.env.NODE_ENV = 'development'
    const res = await app.handle(
      new Request('http://localhost/founder/profile', { headers: await cookieFor(NO_PROFILE.key) }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ nickname: null, avatarUrl: null })
  })

  it('reports organizer membership per fixture', async () => {
    process.env.NODE_ENV = 'development'
    // 建一个真实组织：否则新库里一个组织都没有，这条断言会空转成
    // 「遍历空数组」，看着通过其实什么都没验。
    const orgName = `mock-test-org-${crypto.randomUUID()}`
    const [org] = await db.insert(organizerOrgs).values({ name: orgName })
    try {
      const memberRes = await app.handle(
        new Request('http://localhost/organizer-orgs', { headers: await cookieFor(ORGANIZER.key) }),
      )
      const memberBody = await memberRes.json()
      const memberOrg = memberBody.items.find((o: { id: number }) => o.id === org.insertId)
      expect(memberOrg?.isMember).toBe(true)

      const nonMemberRes = await app.handle(
        new Request('http://localhost/organizer-orgs', { headers: await cookieFor(GUEST.key) }),
      )
      const nonMemberBody = await nonMemberRes.json()
      const nonMemberOrg = nonMemberBody.items.find((o: { id: number }) => o.id === org.insertId)
      expect(nonMemberOrg?.isMember).toBe(false)
    } finally {
      await db.delete(organizerOrgs).where(eq(organizerOrgs.id, org.insertId))
    }
  })

  it('does not persist any rows for mock users', async () => {
    process.env.NODE_ENV = 'development'
    await app.handle(
      new Request('http://localhost/identity/roles', { headers: await cookieFor(OPERATOR.key) }),
    )
    const rows = await db
      .select({ userId: userIdentities.userId })
      .from(userIdentities)
      .where(inArray(userIdentities.userId, MOCK_USER_IDS))
    expect(rows).toEqual([])
  })

  it('falls back to the database for a mock entry with overrides: false', async () => {
    process.env.NODE_ENV = 'development'
    // `founder-demo` reuses seed id 1 and does NOT override roles, so granting
    // Operator to id 1 in the DB must show up for it.
    const demo = byKey('founder-demo')
    await userIdentity.grantRole(demo.userId, Role.Operator)
    try {
      const res = await app.handle(
        new Request('http://localhost/identity/roles', { headers: await cookieFor(demo.key) }),
      )
      const roles = (await res.json()).roles as number[]
      expect(roles).toContain(Role.Operator)
    } finally {
      await db.delete(userIdentities).where(inArray(userIdentities.userId, [demo.userId]))
    }
  })
})
