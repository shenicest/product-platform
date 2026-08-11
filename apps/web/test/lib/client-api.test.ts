import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  createProject,
  getProject,
  loginLogout,
  saveDraft,
  sendLoginCode,
  submitForReview,
  verifyLoginCode,
} from '@/lib/client-api'
import { server } from '../msw/server'

const project = {
  id: 42,
  userId: 'u-1',
  status: 0,
  name: 'Demo',
  tagline: null,
  description: null,
  coverUrl: null,
  demoImages: null,
  demoVideoUrl: null,
  demoLink: null,
  stage: null,
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

describe('sendLoginCode', () => {
  it('POSTs identifier as JSON and returns the body on success', async () => {
    let captured: unknown
    server.use(
      http.post('/api/auth/send-code', async ({ request }) => {
        expect(request.headers.get('content-type')).toBe('application/json')
        captured = await request.json()
        return HttpResponse.json({ success: true })
      })
    )

    const result = await sendLoginCode('a@b.com')
    expect(captured).toEqual({ identifier: 'a@b.com' })
    expect(result).toEqual({ data: { success: true }, error: null })
  })

  it('returns a structured error on 4xx', async () => {
    server.use(
      http.post('/api/auth/send-code', () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'too many' } },
          { status: 429 }
        )
      )
    )

    const result = await sendLoginCode('a@b.com')
    expect(result.data).toBeNull()
    expect(result.error).toEqual({
      status: 429,
      body: { error: { code: 'RATE_LIMITED', message: 'too many' } },
    })
  })

  it('falls back to a synthetic error body when the response is not JSON', async () => {
    server.use(
      http.post(
        '/api/auth/send-code',
        () => new HttpResponse('not json', { status: 500, statusText: 'Server Error' })
      )
    )

    const result = await sendLoginCode('a@b.com')
    expect(result.error?.status).toBe(500)
    expect(result.error?.body.error.code).toBe('UNKNOWN')
    // fetch may or may not surface statusText in jsdom; assert it exists.
    expect(result.error?.body.error.message).toBeTypeOf('string')
  })
})

describe('verifyLoginCode', () => {
  it('POSTs identifier and code', async () => {
    let captured: unknown
    server.use(
      http.post('/api/auth/verify-code', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ success: true })
      })
    )

    await verifyLoginCode('a@b.com', '123456')
    expect(captured).toEqual({ identifier: 'a@b.com', code: '123456' })
  })
})

describe('loginLogout', () => {
  it('POSTs without a body and omits the content-type header', async () => {
    let contentType: string | null = null
    let bodyText: string | null = null
    server.use(
      http.post('/api/auth/logout', async ({ request }) => {
        contentType = request.headers.get('content-type')
        bodyText = await request.text()
        return HttpResponse.json({ success: true })
      })
    )

    await loginLogout()
    expect(contentType).toBeNull()
    expect(bodyText).toBe('')
  })
})

describe('project endpoints', () => {
  it('createProject POSTs to /api/projects and returns the project', async () => {
    let captured: unknown
    server.use(
      http.post('/api/projects', async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json(project)
      })
    )

    const result = await createProject({ name: 'Demo' })
    expect(captured).toEqual({ name: 'Demo' })
    expect(result.data).toEqual(project)
    expect(result.error).toBeNull()
  })

  it('saveDraft PUTs to /api/projects/:id/draft', async () => {
    let method: string | null = null
    let url: URL | null = null
    server.use(
      http.put('/api/projects/:id/draft', ({ request, params }) => {
        method = request.method
        url = new URL(request.url)
        expect(params.id).toBe('42')
        return HttpResponse.json(project)
      })
    )

    const result = await saveDraft(42, { name: 'Demo' })
    expect(method).toBe('PUT')
    expect(url!.pathname).toBe('/api/projects/42/draft')
    expect(result.data).toEqual(project)
  })

  it('submitForReview PUTs to /api/projects/:id/submit with no body', async () => {
    let bodyText: string | null = null
    server.use(
      http.put('/api/projects/:id/submit', async ({ request }) => {
        bodyText = await request.text()
        return HttpResponse.json(project)
      })
    )

    await submitForReview(42)
    expect(bodyText).toBe('')
  })

  it('getProject GETs /api/projects/:id', async () => {
    server.use(
      http.get('/api/projects/:id', ({ params }) => {
        expect(params.id).toBe('42')
        return HttpResponse.json(project)
      })
    )

    const result = await getProject(42)
    expect(result.data).toEqual(project)
  })

  it('propagates 404 for unknown projects', async () => {
    server.use(
      http.get('/api/projects/:id', () =>
        HttpResponse.json(
          { error: { code: 'NOT_FOUND', message: 'nope' } },
          { status: 404 }
        )
      )
    )

    const result = await getProject(999)
    expect(result.data).toBeNull()
    expect(result.error?.status).toBe(404)
  })
})
