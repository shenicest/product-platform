import { afterEach, describe, expect, it, vi } from 'vitest'
import { acceptTalentConnection, pauseTalent, saveTalent, sendTalentConnection } from '@/lib/client-api'

afterEach(() => vi.unstubAllGlobals())
describe('talent client API', () => {
  it('uses the exact management and connection paths', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    const body = { headline: '产品搭档', bio: '这是一段足够长的人才档案介绍，用于描述合作方式和经验。', roles: ['产品'], skills: ['产品策略', '需求分析', '用户研究'], domains: ['效率工具'], durations: ['短期项目'] }
    await saveTalent(body, 'resume')
    await pauseTalent()
    await sendTalentConnection({ receiverUserId: '2', purpose: '合作', message: '聊聊', email: 'me@example.com' })
    await acceptTalentConnection(7, { wechat: 'wechat-id' })
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['/api/talents/me/resume', 'POST'], ['/api/talents/me/pause', 'POST'], ['/api/talents/connections', 'POST'], ['/api/talents/connections/7/accept', 'POST'],
    ])
  })
})
