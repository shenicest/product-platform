import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  approveProject,
  approveProposal,
  delistProject,
  rejectProject,
  rejectProposal,
  requireProjectRevision,
  requireProposalRevision,
  restoreProject,
} from '@/lib/operator-api'
import { server } from '../msw/server'

function stubOperator(
  method: 'post',
  path: string,
  handler: (info: { body: unknown; url: URL }) => Record<string, unknown>
) {
  server.use(
    http[method](path, async ({ request }) => {
      const url = new URL(request.url)
      const body = request.headers.get('content-type')?.includes('application/json')
        ? await request.json()
        : null
      const result = handler({ body, url })
      return HttpResponse.json(result)
    })
  )
}

describe('operator project actions', () => {
  it('approveProject POSTs to /api/operator/projects/:id/approve without a body', async () => {
    let captured: unknown = 'unset'
    stubOperator('post', '/api/operator/projects/:id/approve', ({ body, url }) => {
      captured = body
      expect(url.pathname).toBe('/api/operator/projects/42/approve')
      return { id: 42, status: 3 }
    })

    const result = await approveProject(42)
    expect(captured).toBeNull()
    expect(result).toEqual({ data: { id: 42, status: 3 }, error: null })
  })

  it('requireProjectRevision sends the reason as JSON', async () => {
    let captured: unknown
    stubOperator('post', '/api/operator/projects/:id/require-revision', ({ body }) => {
      captured = body
      return { id: 42, status: 2 }
    })

    await requireProjectRevision(42, 'need more detail')
    expect(captured).toEqual({ reason: 'need more detail' })
  })

  it('rejectProject sends the reason as JSON', async () => {
    let captured: unknown
    stubOperator('post', '/api/operator/projects/:id/reject', ({ body }) => {
      captured = body
      return { id: 42, status: 5 }
    })

    await rejectProject(42, 'off topic')
    expect(captured).toEqual({ reason: 'off topic' })
  })

  it('delistProject and restoreProject hit their respective routes', async () => {
    let delistBody: unknown
    let restoreBody: unknown
    stubOperator('post', '/api/operator/projects/:id/delist', ({ body }) => {
      delistBody = body
      return { id: 42, status: 4 }
    })
    stubOperator('post', '/api/operator/projects/:id/restore', ({ body }) => {
      restoreBody = body
      return { id: 42, status: 3 }
    })

    await delistProject(42, 'violation')
    await restoreProject(42)
    expect(delistBody).toEqual({ reason: 'violation' })
    expect(restoreBody).toBeNull()
  })
})

describe('operator proposal actions', () => {
  it('approveProposal POSTs to /api/operator/proposals/:id/approve without a body', async () => {
    let captured: unknown = 'unset'
    stubOperator('post', '/api/operator/proposals/:id/approve', ({ body, url }) => {
      captured = body
      expect(url.pathname).toBe('/api/operator/proposals/7/approve')
      return { id: 7, status: 1 }
    })

    const result = await approveProposal(7)
    expect(captured).toBeNull()
    expect(result.data).toEqual({ id: 7, status: 1 })
  })

  it('rejectProposal and requireProposalRevision send reason', async () => {
    let rejectBody: unknown
    let revisionBody: unknown
    stubOperator('post', '/api/operator/proposals/:id/reject', ({ body }) => {
      rejectBody = body
      return { id: 7, status: 2 }
    })
    stubOperator('post', '/api/operator/proposals/:id/require-revision', ({ body }) => {
      revisionBody = body
      return { id: 7, status: 3 }
    })

    await rejectProposal(7, 'not aligned')
    await requireProposalRevision(7, 'clarify scope')
    expect(rejectBody).toEqual({ reason: 'not aligned' })
    expect(revisionBody).toEqual({ reason: 'clarify scope' })
  })
})

describe('operator error handling', () => {
  it('returns a structured error when the API answers 403', async () => {
    server.use(
      http.post('/api/operator/projects/:id/approve', () =>
        HttpResponse.json(
          { error: { code: 'FORBIDDEN', message: 'not operator' } },
          { status: 403 }
        )
      )
    )

    const result = await approveProject(42)
    expect(result.data).toBeNull()
    expect(result.error).toEqual({
      status: 403,
      body: { error: { code: 'FORBIDDEN', message: 'not operator' } },
    })
  })

  it('falls back to a synthetic error body when the response is not JSON', async () => {
    server.use(
      http.post(
        '/api/operator/projects/:id/approve',
        () => new HttpResponse('boom', { status: 500 })
      )
    )

    const result = await approveProject(42)
    expect(result.error?.status).toBe(500)
    expect(result.error?.body.error.code).toBe('UNKNOWN')
  })
})
