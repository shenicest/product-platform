import { afterEach, describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { SignJWT } from 'jose'
import { authPlugin } from '../../src/plugins/auth'
import { MOCK_USERS, isMockAuthEnabled, signMockToken } from '../../src/mock'
import { AUDIENCE, ISSUER, signToken } from '../fixtures/auth'

const TEST_SECRET = process.env.SHENICEST_JWT_SECRET!

function createApp() {
  return new Elysia()
    .use(authPlugin)
    .get('/protected', ({ user }) => ({ userId: user.userId }), { auth: true })
    .get('/optional', ({ user }) => ({ userId: user?.userId ?? null }), { optionalAuth: true })
}

const app = createApp()

const guest = MOCK_USERS.find((u) => u.key === 'guest')!

afterEach(() => {
  delete process.env.MOCK_AUTH
  delete process.env.NODE_ENV
})

describe('Mock auth — enablement gate', () => {
  it('is enabled by default outside production', () => {
    delete process.env.MOCK_AUTH
    process.env.NODE_ENV = 'development'
    expect(isMockAuthEnabled()).toBe(true)
  })

  it('can be switched off explicitly with MOCK_AUTH=off', () => {
    process.env.NODE_ENV = 'development'
    process.env.MOCK_AUTH = 'off'
    expect(isMockAuthEnabled()).toBe(false)
  })

  it('is always off in production, even with MOCK_AUTH unset', () => {
    delete process.env.MOCK_AUTH
    process.env.NODE_ENV = 'production'
    expect(isMockAuthEnabled()).toBe(false)
  })

  it('is off in production even if MOCK_AUTH=on is set', () => {
    process.env.NODE_ENV = 'production'
    process.env.MOCK_AUTH = 'on'
    expect(isMockAuthEnabled()).toBe(false)
  })
})

describe('Mock auth — token handling', () => {
  it('accepts a mock token while mock auth is enabled', async () => {
    process.env.NODE_ENV = 'development'
    const token = await signMockToken(guest)
    const res = await app.handle(
      new Request('http://localhost/protected', { headers: { cookie: `shenicest_token=${token}` } }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: guest.userId })
  })

  it('rejects a mock token in production (defence in depth)', async () => {
    process.env.NODE_ENV = 'development'
    const token = await signMockToken(guest)
    // Flip to production after the token exists: the route must stop accepting it.
    process.env.NODE_ENV = 'production'
    const res = await app.handle(
      new Request('http://localhost/protected', { headers: { cookie: `shenicest_token=${token}` } }),
    )
    expect(res.status).toBe(401)
  })

  it('rejects a mock token when MOCK_AUTH=off', async () => {
    process.env.NODE_ENV = 'development'
    const token = await signMockToken(guest)
    process.env.MOCK_AUTH = 'off'
    const res = await app.handle(
      new Request('http://localhost/protected', { headers: { cookie: `shenicest_token=${token}` } }),
    )
    expect(res.status).toBe(401)
  })

  it('optional auth resolves no user from a mock token when mock auth is off', async () => {
    process.env.NODE_ENV = 'development'
    const token = await signMockToken(guest)
    process.env.MOCK_AUTH = 'off'
    const res = await app.handle(
      new Request('http://localhost/optional', { headers: { cookie: `shenicest_token=${token}` } }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: null })
  })

  it('still accepts a real (non-mock) token when mock auth is off', async () => {
    process.env.NODE_ENV = 'production'
    const token = await signToken({ user_id: 123 })
    const res = await app.handle(
      new Request('http://localhost/protected', { headers: { cookie: `shenicest_token=${token}` } }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: '123' })
  })

  it('does not treat a token without the mock flag as a mock session', async () => {
    process.env.NODE_ENV = 'development'
    // Forged without `mock: true` but using a mock user's id: roles must come
    // from the database, not from fixtures.ts.
    const token = await new SignJWT({ user_id: Number(guest.userId) })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .sign(new TextEncoder().encode(TEST_SECRET))
    const res = await app.handle(
      new Request('http://localhost/protected', { headers: { cookie: `shenicest_token=${token}` } }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ userId: guest.userId })
  })

  it('rejects a mock token signed with the wrong secret', async () => {
    process.env.NODE_ENV = 'development'
    const token = await new SignJWT({ user_id: Number(guest.userId), mock: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .sign(new TextEncoder().encode('wrong-secret'))
    const res = await app.handle(
      new Request('http://localhost/protected', { headers: { cookie: `shenicest_token=${token}` } }),
    )
    expect(res.status).toBe(401)
  })
})
