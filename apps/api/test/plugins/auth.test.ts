import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { SignJWT } from 'jose'
import { authPlugin } from '../../src/plugins/auth'

const TEST_SECRET = process.env.SHENICEST_JWT_SECRET
if (!TEST_SECRET) throw new Error('SHENICEST_JWT_SECRET must be set for tests')
const ISSUER = 'shenicest.com'
const AUDIENCE = 'shenicest.com'

function createApp() {
  return new Elysia()
    .use(authPlugin)
    .get('/public', () => ({ message: 'public' }))
    .get('/protected', ({ user }) => ({ userId: user.userId }), {
      auth: true,
    })
}

async function signToken(payload: Record<string, unknown>, secret = TEST_SECRET) {
  const encoder = new TextEncoder()
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .sign(encoder.encode(secret))
  return jwt
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
})
