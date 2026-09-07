import { afterEach, describe, expect, it, vi } from 'vitest'
import { acceptHackathonConnection, getConnections, getHackathonContacts, ignoreHackathonConnection } from '@/lib/client-api'

afterEach(() => vi.unstubAllGlobals())

describe('connections client API', () => {
  it('hits the aggregate with source/direction filters and the hackathon action paths', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    await getConnections({ source: 'hackathon', direction: 'received' })
    await getConnections()
    await acceptHackathonConnection(7, { wechat: 'wx', email: undefined })
    await ignoreHackathonConnection(7)
    await getHackathonContacts(7)
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['/api/connections?source=hackathon&direction=received', 'GET'],
      ['/api/connections', 'GET'],
      ['/api/connections/hackathon/7/accept', 'POST'],
      ['/api/connections/hackathon/7/ignore', 'POST'],
      ['/api/connections/hackathon/7/contacts', 'GET'],
    ])
  })
})
