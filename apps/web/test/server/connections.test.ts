import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieGet = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }))
vi.mock('@/lib/api-url', () => ({ API_URL: 'https://api.example.test' }))

describe('connections server data', () => {
  beforeEach(() => {
    vi.resetModules()
    cookieGet.mockReset()
  })

  it('forwards the auth cookie and returns the aggregate', async () => {
    const aggregate = { data: [{ id: 1, source: 'hackathon', status: 0 }], pendingReceived: 3 }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => aggregate }))
    cookieGet.mockReturnValue({ value: 'secret-token' })
    const { getConnections } = await import('@/server/connections')
    expect(await getConnections()).toEqual(aggregate)
    expect(vi.mocked(fetch).mock.calls[0]).toEqual([
      'https://api.example.test/connections',
      expect.objectContaining({ headers: { cookie: 'shenicest_token=secret-token' }, cache: 'no-store' }),
    ])
  })

  it('degrades failures to null, including logged-out requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    cookieGet.mockReturnValue(undefined)
    const { getConnections } = await import('@/server/connections')
    expect(await getConnections()).toBeNull()
  })
})
