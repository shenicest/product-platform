import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../msw/server'

// getSessionUser reads its bearer token from next/headers cookies(). We stub
// cookies() to return whatever the current test wants; each test is
// responsible for resetting it in afterEach if needed.
let cookieValue: string | undefined

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'shenicest_token' && cookieValue
        ? { name, value: cookieValue }
        : undefined,
  }),
}))

// getSessionUser is cache()-wrapped, so React will dedupe within one render
// tree. Each test imports it fresh to sidestep that memo.
async function importFresh() {
  vi.resetModules()
  return await import('@/server/auth')
}

afterEach(() => {
  cookieValue = undefined
})

describe('getSessionUser', () => {
  it('returns null when no shenicest_token cookie is present', async () => {
    const { getSessionUser } = await importFresh()
    await expect(getSessionUser()).resolves.toBeNull()
  })

  it('returns null when /api/me answers 401', async () => {
    cookieValue = 'token-abc'
    server.use(
      http.get('*/me', () => new HttpResponse(null, { status: 401 }))
    )

    const { getSessionUser } = await importFresh()
    await expect(getSessionUser()).resolves.toBeNull()
  })

  it('returns a session with roles when both /me and /identity/roles resolve', async () => {
    cookieValue = 'token-abc'
    server.use(
      http.get('*/me', ({ request }) => {
        // The server client forwards the cookie header, so we can assert it
        // was propagated correctly.
        expect(request.headers.get('cookie')).toContain('shenicest_token=token-abc')
        return HttpResponse.json({
          user: { user_id: 42, email: 'op@shenicest.com', role: 'operator', roles: [1] },
        })
      }),
      http.get('*/identity/roles', () => HttpResponse.json({ roles: [1, 2] }))
    )

    const { getSessionUser } = await importFresh()
    await expect(getSessionUser()).resolves.toEqual({
      userId: '42',
      email: 'op@shenicest.com',
      roles: [1, 2],
    })
  })

  it('defaults roles to [] when /identity/roles fails', async () => {
    cookieValue = 'token-abc'
    server.use(
      http.get('*/me', () =>
        HttpResponse.json({
          user: { user_id: 42, email: null, role: 'founder', roles: [] },
        })
      ),
      http.get('*/identity/roles', () => new HttpResponse(null, { status: 500 }))
    )

    const { getSessionUser } = await importFresh()
    await expect(getSessionUser()).resolves.toEqual({
      userId: '42',
      email: null,
      roles: [],
    })
  })

  it('returns null when the network throws', async () => {
    cookieValue = 'token-abc'
    server.use(http.get('*/me', () => HttpResponse.error()))

    const { getSessionUser } = await importFresh()
    await expect(getSessionUser()).resolves.toBeNull()
  })
})
