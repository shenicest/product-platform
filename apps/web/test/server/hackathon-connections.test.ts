import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieGet = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }))
vi.mock('@/lib/api-url', () => ({ API_URL: 'https://api.example.test' }))

describe('hackathon connection status server data', () => {
  beforeEach(() => {
    vi.resetModules()
    cookieGet.mockReset()
  })

  it('forwards the auth cookie and unwraps the data envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 7, status: 0, createdAt: '2026-09-07T10:00:00.000Z' } }),
    }))
    cookieGet.mockReturnValue({ value: 'secret-token' })
    const { getMyHackathonConnectionStatus } = await import('@/server/hackathon-connections')
    const status = await getMyHackathonConnectionStatus(42)
    expect(status).toEqual({ id: 7, status: 0, createdAt: '2026-09-07T10:00:00.000Z' })
    expect(vi.mocked(fetch).mock.calls[0]).toEqual([
      'https://api.example.test/hackathon/projects/42/connections/me',
      expect.objectContaining({
        headers: { cookie: 'shenicest_token=secret-token' },
        cache: 'no-store',
      }),
    ])
  })

  it('returns null without a login cookie and still hits the endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    cookieGet.mockReturnValue(undefined)
    const { getMyHackathonConnectionStatus } = await import('@/server/hackathon-connections')
    expect(await getMyHackathonConnectionStatus(42)).toBeNull()
    expect(vi.mocked(fetch).mock.calls[0]?.[1]?.headers).not.toHaveProperty('cookie')
  })

  it('returns null for no-record responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: null }) }))
    cookieGet.mockReturnValue({ value: 'secret-token' })
    const { getMyHackathonConnectionStatus } = await import('@/server/hackathon-connections')
    expect(await getMyHackathonConnectionStatus(42)).toBeNull()
  })
})
