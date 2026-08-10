import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { SignJWT } from 'jose'
import { authModule } from '../../src/modules/auth'

const TEST_SECRET = process.env.SHENICEST_JWT_SECRET
if (!TEST_SECRET) throw new Error('SHENICEST_JWT_SECRET must be set for tests')
const ISSUER = 'shenicest.com'
const AUDIENCE = 'shenicest.com'

async function signToken(payload: Record<string, unknown>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .sign(new TextEncoder().encode(TEST_SECRET))
}

describe('GET /me', () => {
  it('returns 401 with standard error shape when cookie is missing', async () => {
    const response = await authModule.handle(new Request('http://localhost/me'))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authentication token' },
    })
  })

  it('returns 401 with standard error shape when cookie is invalid', async () => {
    const response = await authModule.handle(
      new Request('http://localhost/me', {
        headers: { cookie: 'shenicest_token=not-a-jwt' },
      }),
    )
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authentication token' },
    })
  })

  it('returns user payload for valid cookie', async () => {
    const token = await signToken({ user_id: 42, email: 'founder@example.com', role: 'user' })
    const response = await authModule.handle(
      new Request('http://localhost/me', {
        headers: { cookie: `shenicest_token=${token}` },
      }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      user: { user_id: 42, email: 'founder@example.com', role: 'user' },
    })
  })
})

describe('POST /auth/verify-code', () => {
  const originalFetch = globalThis.fetch

  beforeAll(() => {
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/csrf-token.php')) {
        return Response.json({ success: true, token: 'csrf-token' })
      }
      const body = JSON.parse(String(init?.body))
      if (body.code === '000000') {
        return Response.json({ success: false, error: 'Invalid code' })
      }
      return Response.json({ success: true, token: 'external-jwt', user_id: 42 })
    }) as typeof fetch
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('sets httpOnly cookie and omits token from response body', async () => {
    const response = await authModule.handle(
      new Request('http://localhost/auth/verify-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: 'user@example.com', code: '123456' }),
      }),
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.token).toBeUndefined()
    const setCookie = response.headers.get('set-cookie')
    expect(setCookie).toContain('shenicest_token=external-jwt')
    expect(setCookie?.toLowerCase()).toContain('httponly')
  })

  it('does not set cookie when verification fails', async () => {
    const response = await authModule.handle(
      new Request('http://localhost/auth/verify-code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: 'user@example.com', code: '000000' }),
      }),
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(response.headers.get('set-cookie')).toBeNull()
  })

  it('sets cookie with shared domain when COOKIE_DOMAIN is configured', async () => {
    process.env.COOKIE_DOMAIN = '.shenicest.com'
    try {
      const response = await authModule.handle(
        new Request('http://localhost/auth/verify-code', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ identifier: 'user@example.com', code: '123456' }),
        }),
      )
      expect(response.status).toBe(200)
      const setCookie = response.headers.get('set-cookie')
      expect(setCookie).toContain('shenicest_token=external-jwt')
      expect(setCookie).toContain('Domain=.shenicest.com')
    } finally {
      delete process.env.COOKIE_DOMAIN
    }
  })
})

describe('POST /auth/logout', () => {
  it('clears the host-only cookie', async () => {
    const response = await authModule.handle(
      new Request('http://localhost/auth/logout', { method: 'POST' }),
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(response.headers.getSetCookie()).toEqual(['shenicest_token=; Max-Age=0; Path=/'])
  })

  it('clears both host-only and domain cookies when COOKIE_DOMAIN is configured', async () => {
    process.env.COOKIE_DOMAIN = '.shenicest.com'
    try {
      const response = await authModule.handle(
        new Request('http://localhost/auth/logout', { method: 'POST' }),
      )
      expect(response.status).toBe(200)
      expect(response.headers.getSetCookie()).toEqual([
        'shenicest_token=; Max-Age=0; Path=/',
        'shenicest_token=; Max-Age=0; Path=/; Domain=.shenicest.com',
      ])
    } finally {
      delete process.env.COOKIE_DOMAIN
    }
  })
})

describe('GET /auth/sso-redirect', () => {
  it('redirects to the main site without touching cookies when COOKIE_DOMAIN is unset', async () => {
    const token = await signToken({ user_id: 42, email: 'founder@example.com', role: 'user' })
    const response = await authModule.handle(
      new Request('http://localhost/auth/sso-redirect', {
        headers: { cookie: `shenicest_token=${token}` },
      }),
    )
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://shenicest.com/platform')
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('redirects to MAIN_SITE_URL when configured', async () => {
    process.env.MAIN_SITE_URL = 'https://test.shenicest.com/platform'
    try {
      const response = await authModule.handle(new Request('http://localhost/auth/sso-redirect'))
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('https://test.shenicest.com/platform')
    } finally {
      delete process.env.MAIN_SITE_URL
    }
  })

  it('upgrades a valid token cookie to the shared domain', async () => {
    process.env.COOKIE_DOMAIN = '.shenicest.com'
    try {
      const token = await signToken({ user_id: 42, email: 'founder@example.com', role: 'user' })
      const response = await authModule.handle(
        new Request('http://localhost/auth/sso-redirect', {
          headers: { cookie: `shenicest_token=${token}` },
        }),
      )
      expect(response.status).toBe(302)
      expect(response.headers.get('location')).toBe('https://shenicest.com/platform')
      expect(response.headers.getSetCookie()).toEqual([
        'shenicest_token=; Max-Age=0; Path=/',
        `shenicest_token=${token}; Domain=.shenicest.com; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
      ])
    } finally {
      delete process.env.COOKIE_DOMAIN
    }
  })

  it('does not upgrade an invalid token cookie', async () => {
    process.env.COOKIE_DOMAIN = '.shenicest.com'
    try {
      const response = await authModule.handle(
        new Request('http://localhost/auth/sso-redirect', {
          headers: { cookie: 'shenicest_token=not-a-jwt' },
        }),
      )
      expect(response.status).toBe(302)
      expect(response.headers.getSetCookie()).toEqual([])
    } finally {
      delete process.env.COOKIE_DOMAIN
    }
  })

  it('redirects without cookies when not logged in', async () => {
    process.env.COOKIE_DOMAIN = '.shenicest.com'
    try {
      const response = await authModule.handle(new Request('http://localhost/auth/sso-redirect'))
      expect(response.status).toBe(302)
      expect(response.headers.getSetCookie()).toEqual([])
    } finally {
      delete process.env.COOKIE_DOMAIN
    }
  })
})
