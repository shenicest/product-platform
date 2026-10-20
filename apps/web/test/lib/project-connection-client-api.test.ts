import { afterEach, describe, expect, it, vi } from 'vitest'
import { getMyProjectConnection, sendProjectConnection } from '@/lib/client-api'

afterEach(() => vi.unstubAllGlobals())

describe('project connection client API', () => {
  it('uses the exact create and status paths and posts the body as-is', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const body = { purpose: '合作交流', message: '聊聊', wechat: ' wx ', phone: ' 138-0013-8000 ', email: ' ME@Example.COM ' }
    await sendProjectConnection(63, body)
    await getMyProjectConnection(63)
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method, JSON.parse(init.body ?? '{}')])).toEqual([
      ['/api/projects/63/connections', 'POST', body],
      ['/api/projects/63/connections/me', 'GET', {}],
    ])
  })
})
