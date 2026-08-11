import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../msw/server'

let cookieValue: string | undefined

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'shenicest_token' && cookieValue
        ? { name, value: cookieValue }
        : undefined,
  }),
}))

async function importFresh() {
  vi.resetModules()
  return await import('@/server/projects')
}

afterEach(() => {
  cookieValue = undefined
})

const projectFixture = {
  id: 1,
  userId: 'u-1',
  status: 3,
  name: 'Nova',
  tagline: 'A fast build tool',
  description: null,
  coverUrl: null,
  demoImages: null,
  demoVideoUrl: null,
  demoLink: null,
  stage: 0,
  categories: null,
  targetUsers: null,
  userProblem: null,
  progress: null,
  nextSteps: null,
  messageToUsers: null,
  isOpenForBeta: null,
  betaDescription: null,
  contactName: null,
  contactPhone: null,
  contactEmail: null,
  contactWechat: null,
  teamName: null,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
}

describe('getLiveProjects', () => {
  it('returns the API payload on success', async () => {
    server.use(
      http.get('*/projects', () =>
        HttpResponse.json({ data: [projectFixture], total: 1, page: 1, pageSize: 20 })
      )
    )

    const { getLiveProjects } = await importFresh()
    const result = await getLiveProjects()
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
  })

  it('throws when the API answers with an error', async () => {
    server.use(
      http.get('*/projects', () =>
        HttpResponse.json({ error: { code: 'ERR', message: 'boom' } }, { status: 500 })
      )
    )

    const { getLiveProjects } = await importFresh()
    await expect(getLiveProjects()).rejects.toThrow(/Failed to load live projects/)
  })
})

describe('getProject', () => {
  it('returns the project when it exists', async () => {
    server.use(http.get('*/projects/:id', () => HttpResponse.json(projectFixture)))

    const { getProject } = await importFresh()
    // Eden treaty parses ISO-8601 strings into Date objects, so compare only
    // the fields we actually assert on.
    const result = await getProject(1)
    expect(result).toMatchObject({ id: 1, name: 'Nova', tagline: 'A fast build tool' })
  })

  it('returns null when the API answers 404', async () => {
    server.use(
      http.get('*/projects/:id', () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'not found' } },
          { status: 404 }
        )
      )
    )

    const { getProject } = await importFresh()
    await expect(getProject(999)).resolves.toBeNull()
  })

  it('throws on non-404 errors', async () => {
    server.use(
      http.get('*/projects/:id', () =>
        HttpResponse.json(
          { error: { code: 'ERR', message: 'boom' } },
          { status: 500 }
        )
      )
    )

    const { getProject } = await importFresh()
    await expect(getProject(1)).rejects.toThrow(/Failed to load project/)
  })
})

describe('getProjectWithAuth', () => {
  it('forwards the shenicest_token cookie when present', async () => {
    cookieValue = 'token-abc'
    let captured: string | null = null
    server.use(
      http.get('*/projects/:id', ({ request }) => {
        captured = request.headers.get('cookie')
        return HttpResponse.json(projectFixture)
      })
    )

    const { getProjectWithAuth } = await importFresh()
    const result = await getProjectWithAuth(1)
    expect(result).toMatchObject({ id: 1, name: 'Nova' })
    expect(captured).toContain('shenicest_token=token-abc')
  })

  it('omits the cookie header when no token is present', async () => {
    let captured: string | null = 'sentinel'
    server.use(
      http.get('*/projects/:id', ({ request }) => {
        captured = request.headers.get('cookie')
        return HttpResponse.json(projectFixture)
      })
    )

    const { getProjectWithAuth } = await importFresh()
    await getProjectWithAuth(1)
    // We didn't set cookieValue, so the client shouldn't have sent one. jsdom
    // may still set an empty cookie header via node-fetch; accept either.
    expect(captured === null || captured === '').toBe(true)
  })

  it('returns null on 404 and throws on other errors', async () => {
    server.use(
      http.get('*/projects/:id', () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'no' } },
          { status: 404 }
        )
      )
    )
    const { getProjectWithAuth } = await importFresh()
    await expect(getProjectWithAuth(1)).resolves.toBeNull()

    server.use(
      http.get('*/projects/:id', () =>
        HttpResponse.json(
          { error: { code: 'ERR', message: 'boom' } },
          { status: 500 }
        )
      )
    )
    const { getProjectWithAuth: getAgain } = await importFresh()
    await expect(getAgain(1)).rejects.toThrow(/Failed to load project/)
  })
})
