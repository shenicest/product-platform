import { afterEach, describe, expect, it, vi } from 'vitest'

// `organizer-access` reads NODE_ENV / NEXT_PUBLIC_* at import time, the same way
// Next inlines them at build time. Each case re-imports with a fresh env so we
// can prove both the "local debug" and the "production" behaviour.
const ORIGINAL_NODE_ENV = process.env.NODE_ENV
const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_ORGANIZER_OPEN_ACCESS

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
  vi.stubEnv('NODE_ENV', ORIGINAL_NODE_ENV ?? 'test')
  if (ORIGINAL_FLAG === undefined) delete process.env.NEXT_PUBLIC_ORGANIZER_OPEN_ACCESS
  else process.env.NEXT_PUBLIC_ORGANIZER_OPEN_ACCESS = ORIGINAL_FLAG
})

async function load(env: { nodeEnv: string; flag?: string }) {
  vi.resetModules()
  vi.stubEnv('NODE_ENV', env.nodeEnv)
  if (env.flag === undefined) delete process.env.NEXT_PUBLIC_ORGANIZER_OPEN_ACCESS
  else vi.stubEnv('NEXT_PUBLIC_ORGANIZER_OPEN_ACCESS', env.flag)
  return await import('@/lib/organizer-access')
}

describe('local development (non-production)', () => {
  it('opens the console and the menu entry to every logged-in account', async () => {
    const { ORGANIZER_OPEN_ACCESS, canAccessOrganizerConsole, shouldShowOrganizerEntry } =
      await load({ nodeEnv: 'development' })

    expect(ORGANIZER_OPEN_ACCESS).toBe(true)
    expect(canAccessOrganizerConsole({ isLoggedIn: true, isOperator: false, isOrganizerMember: false })).toBe(true)
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: false })).toBe(true)
    // 还没查到组织归属（null）时也不该闪掉入口。
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: null })).toBe(true)
  })

  it('still requires a login', async () => {
    const { canAccessOrganizerConsole, shouldShowOrganizerEntry } = await load({ nodeEnv: 'development' })
    expect(canAccessOrganizerConsole({ isLoggedIn: false, isOperator: true, isOrganizerMember: true })).toBe(false)
    expect(shouldShowOrganizerEntry({ isLoggedIn: false, isOperator: false, isOrganizerMember: null })).toBe(false)
  })

  it('can be switched off locally to reproduce production rules', async () => {
    const { ORGANIZER_OPEN_ACCESS, canAccessOrganizerConsole, shouldShowOrganizerEntry } =
      await load({ nodeEnv: 'development', flag: 'false' })

    expect(ORGANIZER_OPEN_ACCESS).toBe(false)
    expect(canAccessOrganizerConsole({ isLoggedIn: true, isOperator: false, isOrganizerMember: false })).toBe(false)
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: false })).toBe(false)
  })
})

describe('production', () => {
  it('hides the entry from accounts without organizer access', async () => {
    const { ORGANIZER_OPEN_ACCESS, canAccessOrganizerConsole, shouldShowOrganizerEntry } =
      await load({ nodeEnv: 'production' })

    expect(ORGANIZER_OPEN_ACCESS).toBe(false)
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: false })).toBe(false)
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: null })).toBe(false)
    expect(canAccessOrganizerConsole({ isLoggedIn: true, isOperator: false, isOrganizerMember: false })).toBe(false)
  })

  it('keeps the console for platform operators and organizer org members', async () => {
    const { canAccessOrganizerConsole, shouldShowOrganizerEntry } = await load({ nodeEnv: 'production' })

    expect(canAccessOrganizerConsole({ isLoggedIn: true, isOperator: true, isOrganizerMember: false })).toBe(true)
    expect(canAccessOrganizerConsole({ isLoggedIn: true, isOperator: false, isOrganizerMember: true })).toBe(true)
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: true, isOrganizerMember: false })).toBe(true)
    expect(shouldShowOrganizerEntry({ isLoggedIn: true, isOperator: false, isOrganizerMember: true })).toBe(true)
  })

  it('ignores the debug flag even when it is left set in the environment', async () => {
    const { ORGANIZER_OPEN_ACCESS, canAccessOrganizerConsole } =
      await load({ nodeEnv: 'production', flag: 'true' })

    expect(ORGANIZER_OPEN_ACCESS).toBe(false)
    expect(canAccessOrganizerConsole({ isLoggedIn: true, isOperator: false, isOrganizerMember: false })).toBe(false)
  })

  it('treats an unset NODE_ENV as a non-production default', async () => {
    vi.resetModules()
    // NODE_ENV 在 `@types/node` 里是只读声明，直接用 Reflect 删掉这个键。
    Reflect.deleteProperty(process.env, 'NODE_ENV')
    delete process.env.NEXT_PUBLIC_ORGANIZER_OPEN_ACCESS
    const { ORGANIZER_OPEN_ACCESS } = await import('@/lib/organizer-access')
    expect(ORGANIZER_OPEN_ACCESS).toBe(true)
  })
})
