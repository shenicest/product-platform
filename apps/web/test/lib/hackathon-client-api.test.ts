import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMyHackathonConnection, sendHackathonConnection } from '@/lib/client-api'

afterEach(() => vi.unstubAllGlobals())

describe('hackathon connection client API', () => {
  it('uses the exact create and status paths and posts the body as-is', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const body = { purpose: '合作交流', message: '聊聊', wechat: ' wx ', email: ' ME@Example.COM ' }
    await sendHackathonConnection(42, body)
    await getMyHackathonConnection(42)
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method, JSON.parse(init.body ?? '{}')])).toEqual([
      ['/api/hackathon/projects/42/connections', 'POST', body],
      ['/api/hackathon/projects/42/connections/me', 'GET', {}],
    ])
  })
})
