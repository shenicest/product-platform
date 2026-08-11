import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `api-url` reads process.env at import time. Each test re-imports the module
// after mutating the env so we can exercise different `API_URL` values.
let originalApiUrl: string | undefined

beforeEach(() => {
  originalApiUrl = process.env.API_URL
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  if (originalApiUrl === undefined) {
    delete process.env.API_URL
  } else {
    process.env.API_URL = originalApiUrl
  }
})

async function importFresh() {
  return await import('@/lib/api-url')
}

describe('API_URL default', () => {
  it('defaults to http://localhost:3000 when API_URL is unset', async () => {
    // vi.stubEnv only sets strings, so delete directly to simulate "unset".
    delete process.env.API_URL
    const { API_URL } = await importFresh()
    expect(API_URL).toBe('http://localhost:3000')
  })

  it('respects a custom API_URL', async () => {
    vi.stubEnv('API_URL', 'https://api.shenicest.test')
    const { API_URL } = await importFresh()
    expect(API_URL).toBe('https://api.shenicest.test')
  })

  it('throws on invalid API_URL', async () => {
    vi.stubEnv('API_URL', 'not a url')
    await expect(importFresh()).rejects.toThrow(/is not a valid URL/)
  })
})

describe('apiUrl()', () => {
  it('joins the base URL with a leading-slash path', async () => {
    vi.stubEnv('API_URL', 'http://localhost:3000')
    const { apiUrl } = await importFresh()
    expect(apiUrl('/projects')).toBe('http://localhost:3000/projects')
  })

  it('preserves the base URL path prefix and strips a trailing slash', async () => {
    vi.stubEnv('API_URL', 'https://api.example.com/v1/')
    const { apiUrl } = await importFresh()
    expect(apiUrl('/projects')).toBe('https://api.example.com/v1/projects')
  })

  it('handles nested paths', async () => {
    vi.stubEnv('API_URL', 'https://api.example.com')
    const { apiUrl } = await importFresh()
    expect(apiUrl('/projects/42/approve')).toBe('https://api.example.com/projects/42/approve')
  })

  it('accepts an empty path (returns the base URL)', async () => {
    vi.stubEnv('API_URL', 'http://localhost:3000')
    const { apiUrl } = await importFresh()
    expect(apiUrl('')).toBe('http://localhost:3000/')
  })
})
