import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { SignJWT } from 'jose'
import { authPlugin } from '../../src/plugins/auth'
import { AUDIENCE, ISSUER, signToken } from '../fixtures/auth'

const TEST_SECRET = process.env.SHENICEST_JWT_SECRET!

function createApp() {
  return new Elysia()
    .use(authPlugin)
    .get('/public', () => ({ message: 'public' }))
    .get('/protected', ({ user }) => ({ userId: user.userId }), {
      auth: true,
    })
    .get('/optional', ({ user }) => ({ userId: user?.userId ?? null }), {
      optionalAuth: true,
    })
}

describe('Auth plugin', () => {
  const app = createApp()

  it('public route works without token', async () => {
    const response = await app.handle(new Request('http://localhost/public'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: 'public' })
  })

  it('protected route returns 401 without token', async () => {
    const response = await app.handle(new Request('http://localhost/protected'))
    expect(response.status).toBe(401)
  })

  it('protected route returns 401 with malformed token', async () => {
    const response = await app.handle(
      new Request('http://localhost/protected', {
        headers: { authorization: 'Bearer not-a-valid-jwt' },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('protected route returns 401 with expired token', async () => {
    const encoder = new TextEncoder()
    const jwt = await new SignJWT({ user_id: 'user-123' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(encoder.encode(TEST_SECRET))
    const response = await app.handle(
      new Request('http://localhost/protected', {
        headers: { authorization: `Bearer ${jwt}` },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('protected route returns 401 with wrong secret', async () => {
    const token = await signToken({ user_id: 'user-123' }, 'wrong-secret')
    const response = await app.handle(
      new Request('http://localhost/protected', {
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('valid token decorates user onto context', async () => {
    const token = await signToken({ user_id: 'user-123' })
    const response = await app.handle(
      new Request('http://localhost/protected', {
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: 'user-123' })
  })

  it('returns 401 with non-Bearer authorization header', async () => {
    const response = await app.handle(
      new Request('http://localhost/protected', {
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('protected route accepts valid cookie', async () => {
    const token = await signToken({ user_id: 'user-123' })
    const response = await app.handle(
      new Request('http://localhost/protected', {
        headers: { cookie: `shenicest_token=${token}` },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: 'user-123' })
  })

  it('protected route returns 401 with invalid cookie', async () => {
    const response = await app.handle(
      new Request('http://localhost/protected', {
        headers: { cookie: 'shenicest_token=not-a-jwt' },
      }),
    )
    expect(response.status).toBe(401)
  })

  it('protected route falls back to cookie when bearer token is invalid', async () => {
    const token = await signToken({ user_id: 'user-123' })
    const response = await app.handle(
      new Request('http://localhost/protected', {
        headers: {
          authorization: 'Bearer invalid-token',
          cookie: `shenicest_token=${token}`,
        },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: 'user-123' })
  })

  it('optional route returns null user without credentials', async () => {
    const response = await app.handle(new Request('http://localhost/optional'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: null })
  })

  it('optional route resolves user from valid bearer token', async () => {
    const token = await signToken({ user_id: 'user-123' })
    const response = await app.handle(
      new Request('http://localhost/optional', {
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: 'user-123' })
  })

  it('optional route falls back to cookie when bearer token is invalid', async () => {
    const token = await signToken({ user_id: 'user-123' })
    const response = await app.handle(
      new Request('http://localhost/optional', {
        headers: {
          authorization: 'Bearer invalid-token',
          cookie: `shenicest_token=${token}`,
        },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: 'user-123' })
  })

  it('optional route returns null user with invalid credentials', async () => {
    const response = await app.handle(
      new Request('http://localhost/optional', {
        headers: {
          authorization: 'Bearer invalid-token',
          cookie: 'shenicest_token=also-invalid',
        },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: null })
  })
})
