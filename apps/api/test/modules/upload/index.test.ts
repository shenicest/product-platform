import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { uploadModule } from '../../../src/modules/upload'
import { jsonHeaders, signToken } from '../../fixtures/auth'

const USER_ID = `test-uploader-${crypto.randomUUID()}`
const PREFIX = (process.env.COS_UPLOAD_PREFIX ?? 'projects/').replace(/\/+$/, '') + '/'
const PUBLIC_BASE = process.env.COS_PUBLIC_BASE_URL!.replace(/\/+$/, '')

function createApp() {
  return new Elysia().use(uploadModule)
}

describe('Upload routes', () => {
  const app = createApp()

  it('returns 401 without a token', async () => {
    const res = await app.handle(
      new Request('http://localhost/uploads/presign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filename: 'cover.png' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it('returns 422 when filename is missing', async () => {
    const token = await signToken({ user_id: USER_ID })
    const res = await app.handle(
      new Request('http://localhost/uploads/presign', {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(422)
  })

  it('returns a signed PUT URL and a public URL for an authenticated user', async () => {
    const token = await signToken({ user_id: USER_ID })
    const res = await app.handle(
      new Request('http://localhost/uploads/presign', {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify({ filename: 'screenshot.png', mime: 'image/png' }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.key).toMatch(new RegExp(`^${PREFIX}${USER_ID}/\\d{4}/\\d{2}/`))
    expect(body.key.endsWith('.png')).toBe(true)
    expect(body.publicUrl).toBe(`${PUBLIC_BASE}/${body.key}`)

    const url = new URL(body.url)
    expect(url.protocol).toBe('https:')
    expect(url.searchParams.get('q-signature')).toBeTruthy()
    expect(url.searchParams.get('q-header-list')).toBe('host')
  })

  it('falls back to an empty extension for filenames without a safe suffix', async () => {
    const token = await signToken({ user_id: USER_ID })
    const res = await app.handle(
      new Request('http://localhost/uploads/presign', {
        method: 'POST',
        headers: jsonHeaders(token),
        body: JSON.stringify({ filename: 'no_extension' }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(/\.(png|jpg|jpeg|gif|webp|svg)$/.test(body.key)).toBe(false)
  })

  it('scopes each user to their own key namespace', async () => {
    const tokenA = await signToken({ user_id: `a-${USER_ID}` })
    const tokenB = await signToken({ user_id: `b-${USER_ID}` })
    const keyA = (await (await app.handle(
      new Request('http://localhost/uploads/presign', {
        method: 'POST',
        headers: jsonHeaders(tokenA),
        body: JSON.stringify({ filename: 'a.png' }),
      }),
    )).json()).key
    const keyB = (await (await app.handle(
      new Request('http://localhost/uploads/presign', {
        method: 'POST',
        headers: jsonHeaders(tokenB),
        body: JSON.stringify({ filename: 'b.png' }),
      }),
    )).json()).key
    expect(keyA.startsWith(`${PREFIX}a-${USER_ID}/`)).toBe(true)
    expect(keyB.startsWith(`${PREFIX}b-${USER_ID}/`)).toBe(true)
    expect(keyA).not.toBe(keyB)
  })
})
