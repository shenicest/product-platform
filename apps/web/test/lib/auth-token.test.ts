import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { fetchCurrentUser, logoutRequest } from '@/lib/auth-token'
import { server } from '../msw/server'

describe('fetchCurrentUser', () => {
  it('returns the user with a defaulted roles array on 200', async () => {
    server.use(
      http.get('/api/me', () =>
        HttpResponse.json({
          user: { user_id: 1, email: 'a@b.com', role: 'operator', roles: [1] },
        })
      )
    )

    await expect(fetchCurrentUser()).resolves.toEqual({
      user_id: 1,
      email: 'a@b.com',
      role: 'operator',
      roles: [1],
    })
  })

  it('defaults roles to [] when the response omits it', async () => {
    server.use(
      http.get('/api/me', () =>
        HttpResponse.json({
          user: { user_id: 2, email: null, role: 'founder' },
        })
      )
    )

    await expect(fetchCurrentUser()).resolves.toEqual({
      user_id: 2,
      email: null,
      role: 'founder',
      roles: [],
    })
  })

  it('returns null when the API answers 401', async () => {
    server.use(http.get('/api/me', () => new HttpResponse(null, { status: 401 })))
    await expect(fetchCurrentUser()).resolves.toBeNull()
  })

  it('returns null when the body has no user', async () => {
    server.use(http.get('/api/me', () => HttpResponse.json({})))
    await expect(fetchCurrentUser()).resolves.toBeNull()
  })

  it('returns null when the network fails', async () => {
    server.use(http.get('/api/me', () => HttpResponse.error()))
    await expect(fetchCurrentUser()).resolves.toBeNull()
  })
})

describe('logoutRequest', () => {
  it('POSTs /api/auth/logout with same-origin credentials', async () => {
    let captured: Request | null = null
    server.use(
      http.post('/api/auth/logout', ({ request }) => {
        captured = request
        return HttpResponse.json({ success: true })
      })
    )

    await logoutRequest()
    expect(captured).not.toBeNull()
    expect(captured!.method).toBe('POST')
    // fetch adds credentials via option, not a header; we can only assert the
    // path/method here from MSW.
    expect(new URL(captured!.url).pathname).toBe('/api/auth/logout')
  })

  it('resolves even when the server returns an error', async () => {
    server.use(
      http.post('/api/auth/logout', () =>
        HttpResponse.json({ error: { code: 'X', message: 'nope' } }, { status: 500 })
      )
    )
    // logoutRequest ignores errors — the client-side UX still logs the user out.
    await expect(logoutRequest()).resolves.toBeUndefined()
  })
})
