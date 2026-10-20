import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieGet = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }))
vi.mock('@/lib/api-url', () => ({ API_URL: 'https://api.example.test' }))

describe('project connection server data', () => {
  beforeEach(() => {
    vi.resetModules()
    cookieGet.mockReset()
  })

  it('forwards the auth cookie and returns the gating envelope', async () => {
    const gate = { data: { id: 1, status: 0, createdAt: '2026-09-07T00:00:00.000Z' }, receiverConfigured: true, viewerIsReceiver: false }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => gate }))
    cookieGet.mockReturnValue({ value: 'secret-token' })
    const { getMyProjectConnectionStatus } = await import('@/server/project-connections')
    expect(await getMyProjectConnectionStatus(63)).toEqual(gate)
    expect(vi.mocked(fetch).mock.calls[0]).toEqual([
      'https://api.example.test/projects/63/connections/me',
      expect.objectContaining({ headers: { cookie: 'shenicest_token=secret-token' }, cache: 'no-store' }),
    ])
  })

  it('degrades failures to null, including logged-out requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    cookieGet.mockReturnValue(undefined)
    const { getMyProjectConnectionStatus } = await import('@/server/project-connections')
    expect(await getMyProjectConnectionStatus(63)).toBeNull()
  })
})
