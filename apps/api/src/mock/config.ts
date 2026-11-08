import { env, isProduction } from '../lib/env'

/**
 * 本地 mock 登录的总开关。
 *
 * 目标：本地调试时可以随意切换「当前登录的是谁」，模拟不同角色、不同用户状态，
 * 而不需要去外部认证系统拿真实 JWT，也不需要跑 seed 往库里写死数据。
 *
 * 三道闸，缺一不可：
 *   1. `NODE_ENV !== 'production'` —— 生产构建恒关闭，哪怕环境变量误留。
 *   2. `MOCK_AUTH !== 'off'` —— 非生产默认开启，需要复现真实登录时显式关掉。
 *   3. 请求必须带 mock 会话 cookie（见 `registry.ts` 的 MOCK_COOKIE）。
 *      没有 cookie 时，即使开关是开的，走的也完全是真实 JWT 链路。
 *
 * 用函数而不是模块级常量读取，是为了测试能逐个用例切换 `process.env`
 * （与 `modules/auth/index.ts` 里 `getCookieDomain()` 的写法保持一致）。
 *
 * ★ 必须经由 `lib/env.ts` 的 `env()` 读取，不能写 `process.env.NODE_ENV`：
 *   后者会被 `bun build` 在构建期替换成字面量，把「生产恒关闭」这条闸
 *   整条删掉。详见 `lib/env.ts` 的文件头说明。
 */
export function isMockAuthEnabled(): boolean {
  if (isProduction()) return false
  return env('MOCK_AUTH') !== 'off'
}
