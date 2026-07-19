import { describe, expect, it } from 'bun:test'
import { Elysia, t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { authPlugin } from '../../src/plugins/auth'

const TEST_SECRET = 'dev-secret-change-in-production'

function createApp() {
  return new Elysia()
    .use(authPlugin)
    .get('/public', () => ({ message: 'public' }))
    .get('/protected', ({ user }) => ({ userId: user.userId }), {
      auth: true,
    })
}

async function signToken(payload: Record<string, unknown>, secret = TEST_SECRET) {
  const app = new Elysia().use(jwt({ name: 'jwt', secret }))
  const { jwt: jwtInstance } = app.decorator
  return jwtInstance.sign(payload)
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
    const token = await signToken({
      user_id: 'user-123',
      exp: Math.floor(Date.now() / 1000) - 3600,
    })
    const response = await app.handle(
      new Request('http://localhost/protected', {
        headers: { authorization: `Bearer ${token}` },
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
