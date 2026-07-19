import { describe, expect, it } from 'bun:test'
import { Elysia, t } from 'elysia'

describe('Server', () => {
  const app = new Elysia().get('/health', () => ({ status: 'ok' }), {
    response: t.Object({
      status: t.Literal('ok'),
    }),
  })

  it('GET /health returns ok', async () => {
    const response = await app.handle(new Request('http://localhost/health'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
