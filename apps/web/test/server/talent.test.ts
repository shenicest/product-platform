import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieGet = vi.fn()
const founderProjectsGet = vi.fn()
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }))
vi.mock('@/lib/api-url', () => ({ API_URL: 'https://api.example.test' }))
vi.mock('@/lib/api', () => ({
  api: { founder: { projects: { get: founderProjectsGet } } },
}))

describe('talent server data', () => {
  beforeEach(() => { vi.resetModules(); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [], total: 0 }) }))); cookieGet.mockReturnValue({ value: 'secret-token' }); founderProjectsGet.mockReset() })
  it('forwards the auth cookie for optional-auth public detail', async () => {
    const { getTalent } = await import('@/server/talent')
    await getTalent('42')
    expect(fetch).toHaveBeenCalledWith('https://api.example.test/talents/42', expect.objectContaining({ headers: { cookie: 'shenicest_token=secret-token' }, cache: 'no-store' }))
  })

  it('does not fetch founder projects for logged-out visitors', async () => {
    cookieGet.mockReturnValue(undefined)
    const { getConnectionProjectOptions } = await import('@/server/talent')
    expect(await getConnectionProjectOptions()).toEqual([])
    expect(founderProjectsGet).not.toHaveBeenCalled()
  })

  it('degrades a non-Founder 403 to no project options', async () => {
    founderProjectsGet.mockResolvedValue({ data: null, error: { status: 403 } })
    const { getConnectionProjectOptions } = await import('@/server/talent')
    expect(await getConnectionProjectOptions()).toEqual([])
  })

  it('projects only safe display fields from Live founder projects', async () => {
    founderProjectsGet.mockResolvedValue({
      data: { data: [{ id: 17, name: 'Live project', tagline: 'Public tagline', contactEmail: 'secret@example.com' }] },
      error: null,
    })
    const { getConnectionProjectOptions } = await import('@/server/talent')
    expect(await getConnectionProjectOptions()).toEqual([
      { id: 17, name: 'Live project', tagline: 'Public tagline' },
    ])
    expect(founderProjectsGet).toHaveBeenCalledWith(expect.objectContaining({ query: { status: 3, limit: 100 } }))
  })
})
