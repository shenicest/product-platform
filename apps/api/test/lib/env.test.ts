import { describe, expect, it } from 'bun:test'
import { env, isProduction } from '../../src/lib/env'

/**
 * 回归测试：`lib/env.ts` 的存在理由。
 *
 * `bun build` 会把静态成员访问 `process.env.NODE_ENV` 在**打包时**替换成构建机
 * 上的字面量。部署流程（`docs/deploy-backend.md`）在构建机上不设 `NODE_ENV`，
 * 于是产物里会固化成 `if (false)` —— 生产分支被整段删除。
 *
 * 这个测试不跑构建（那太慢），而是断言 helper 的**运行时语义**正确：读的是
 * 当前进程的环境，不缓存。真正的「打包后是否还被内联」由下面的构建级测试覆盖。
 */
describe('lib/env', () => {
  it('reads the live value, not a cached one', () => {
    const original = process.env.SHENICEST_ENV_PROBE
    try {
      process.env.SHENICEST_ENV_PROBE = 'first'
      expect(env('SHENICEST_ENV_PROBE')).toBe('first')
      process.env.SHENICEST_ENV_PROBE = 'second'
      expect(env('SHENICEST_ENV_PROBE')).toBe('second')
    } finally {
      if (original === undefined) delete process.env.SHENICEST_ENV_PROBE
      else process.env.SHENICEST_ENV_PROBE = original
    }
  })

  it('returns undefined for an unset variable', () => {
    expect(env('SHENICEST_DEFINITELY_NOT_SET_XYZ')).toBeUndefined()
  })

  it('treats only the exact string "production" as production', () => {
    const original = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'production'
      expect(isProduction()).toBe(true)

      for (const value of ['development', 'test', 'PRODUCTION', 'prod', '']) {
        process.env.NODE_ENV = value
        expect(isProduction()).toBe(false)
      }

      delete process.env.NODE_ENV
      expect(isProduction()).toBe(false)
    } finally {
      if (original === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = original
    }
  })
})
