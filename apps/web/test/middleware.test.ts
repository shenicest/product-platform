import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { middleware } from '@/middleware'

function base64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

// Build a JWT-shaped string without a real signature. The middleware only
// inspects the `exp` claim, not the signature, so this is enough to exercise
// the redirect logic.
function fakeJwt(payload: Record<string, unknown>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  return `${header}.${body}.sig`
}

const HOUR = 60 * 60
const nowSec = () => Math.floor(Date.now() / 1000)

function buildRequest(pathname: string, token?: string): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000')
  const req = new NextRequest(url)
  if (token) req.cookies.set('shenicest_token', token)
  return req
}

describe('middleware — /login redirect', () => {
  it('redirects to / when a valid unexpired token is present', () => {
    const token = fakeJwt({ exp: nowSec() + HOUR })
    const res = middleware(buildRequest('/login', token))

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('redirects when visiting /login/anything with a valid token (startsWith match)', () => {
    const token = fakeJwt({ exp: nowSec() + HOUR })
    const res = middleware(buildRequest('/login/verify', token))
    expect(res.status).toBe(307)
  })

  it('does not redirect when the token is expired', () => {
    const token = fakeJwt({ exp: nowSec() - HOUR })
    const res = middleware(buildRequest('/login', token))
    // NextResponse.next() has no location header.
    expect(res.headers.get('location')).toBeNull()
  })

  it('does not redirect when the exp claim is missing', () => {
    const token = fakeJwt({ sub: 'user-1' })
    const res = middleware(buildRequest('/login', token))
    expect(res.headers.get('location')).toBeNull()
  })

  it('does not redirect when the exp claim is not a number', () => {
    const token = fakeJwt({ exp: 'later' })
    const res = middleware(buildRequest('/login', token))
    expect(res.headers.get('location')).toBeNull()
  })

  it('does not redirect when the token is malformed', () => {
    const res = middleware(buildRequest('/login', 'not-a-jwt'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('does not redirect when the payload is not valid base64url JSON', () => {
    const res = middleware(buildRequest('/login', 'aaa.notbase64!.bbb'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('does not redirect when no token cookie is present', () => {
    const res = middleware(buildRequest('/login'))
    expect(res.headers.get('location')).toBeNull()
  })

  it('does not redirect for non-login paths, even with a valid token', () => {
    const token = fakeJwt({ exp: nowSec() + HOUR })
    const res = middleware(buildRequest('/', token))
    expect(res.headers.get('location')).toBeNull()
  })

  it('does not middleware-block anonymous visitors to /following', () => {
    const res = middleware(buildRequest('/following'))
    expect(res.headers.get('location')).toBeNull()
  })
})
