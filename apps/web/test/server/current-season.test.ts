import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../msw/server'

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}))

async function importFresh() {
  vi.resetModules()
  return await import('@/server/boomland')
}

function summary(overrides: Record<string, unknown> = {}) {
  return {
    id: 501,
    code: '501',
    name: 'BoomLand 秋季共创赛季',
    type: 'season',
    city: '上海',
    status: 'active',
    themes: ['AI 应用'],
    schedule: {
      applyOpen: '2020-01-01T00:00:00.000Z',
      applyClose: '2020-02-01T00:00:00.000Z',
      startAt: '2026-11-01T01:00:00.000Z',
      teamDeadline: '2026-11-10T15:59:00.000Z',
      challengeFreezeAt: '2026-11-15T15:59:00.000Z',
      workDeadline: '2026-12-01T15:59:00.000Z',
      scoreDeadline: '2026-12-10T15:59:00.000Z',
      settleDate: '2026-12-20T15:59:00.000Z',
    },
    organizerOrgs: [{ id: 1, name: 'A4BBS' }],
    pinned: false,
    approvedAt: '2026-09-01T00:00:00.000Z',
    participantCapacity: 20,
    participantCount: 19,
    publishedChallengeCount: 3,
    ...overrides,
  }
}

function detail(overrides: Record<string, unknown> = {}) {
  return {
    ...summary(),
    intro: '把真实问题做成可交付的服务',
    ruleCard: [],
    rulesVersion: 1,
    awardingEntity: 'A4BBS',
    agreementVersion: 'v1',
    agreementContent: null,
    startedAt: null,
    applicationWindow: {
      opensAt: '2020-01-01T00:00:00.000Z',
      closesAt: '2020-02-01T00:00:00.000Z',
      isOpen: false,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('getCurrentSeasonSpotlight', () => {
  it('picks the pinned season and loads its detail', async () => {
    let detailPath: string | null = null
    server.use(
      http.get('*/seasons', () =>
        HttpResponse.json({
          items: [
            summary({ id: 501, code: '501', status: 'active' }),
            summary({ id: 502, code: '502', status: 'upcoming', pinned: true }),
          ],
          total: 2,
          page: 1,
          pageSize: 20,
        }),
      ),
      http.get('*/seasons/:id', ({ request }) => {
        detailPath = new URL(request.url).pathname
        return HttpResponse.json(
          detail({ id: 502, code: '502', status: 'upcoming', pinned: true }),
        )
      }),
    )

    const { getCurrentSeasonSpotlight } = await importFresh()
    const view = await getCurrentSeasonSpotlight()

    expect(view).toMatchObject({
      id: 502,
      code: '502',
      href: '/seasons/502',
      statusLabel: '即将开始',
    })
    // 并行赛季来自同一次列表请求：首页不用为「并行 N 个赛季」再打一次接口。
    expect(view?.parallelSeasons).toEqual([
      expect.objectContaining({
        id: 501,
        href: '/seasons/501',
        statusLabel: '进行中',
      }),
    ])
    expect(detailPath).toBe('/seasons/502')
  })

  it('returns null when there is no public season', async () => {
    server.use(
      http.get('*/seasons', () =>
        HttpResponse.json({ items: [], total: 0, page: 1, pageSize: 20 }),
      ),
    )

    const { getCurrentSeasonSpotlight } = await importFresh()
    await expect(getCurrentSeasonSpotlight()).resolves.toBeNull()
  })

  it('returns null when the season list request fails', async () => {
    server.use(
      http.get('*/seasons', () =>
        HttpResponse.json(
          { error: { code: 'ERR', message: 'boom' } },
          { status: 500 },
        ),
      ),
    )

    const { getCurrentSeasonSpotlight } = await importFresh()
    await expect(getCurrentSeasonSpotlight()).resolves.toBeNull()
  })

  it('falls back to the list payload when the detail request fails', async () => {
    server.use(
      http.get('*/seasons', () =>
        HttpResponse.json({
          items: [summary()],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      ),
      http.get('*/seasons/:id', () =>
        HttpResponse.json(
          { error: { code: 'ERR', message: 'boom' } },
          { status: 500 },
        ),
      ),
    )

    const { getCurrentSeasonSpotlight } = await importFresh()
    const view = await getCurrentSeasonSpotlight()

    expect(view).toMatchObject({
      id: 501,
      href: '/seasons/501',
      // 详情不可用时用主题兜底简介，入口不会因此消失。
      intro: 'AI 应用',
      statusLabel: '进行中',
    })
  })
})
