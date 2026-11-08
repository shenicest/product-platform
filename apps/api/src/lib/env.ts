/**
 * 运行时环境变量读取。
 *
 * 为什么不直接写 `process.env.NODE_ENV`？
 * --------------------------------------
 * `bun build`（见 `apps/api/package.json` 的 build 脚本）会把
 * **静态成员访问** `process.env.NODE_ENV` 在打包时替换成构建机上的值。
 * 而部署流程（`docs/deploy-backend.md`）是直接 `bun run build`，构建机上
 * 没有设置 `NODE_ENV`，于是产物里被固化成字面量：
 *
 *   function isMockAuthEnabled() {
 *     if (false) return false            // ← 「生产就关闭」的分支被删掉
 *     return process.env.MOCK_AUTH !== 'off'
 *   }
 *   var isProduction = () => false       // ← cookie 的 Secure 永不添加
 *
 * 后果不是「本地行为不对」，而是**生产进程里这两个生产分支永远进不去**：
 * mock 登录路由照样注册、mock token 照样被接受、登录 cookie 不带 Secure。
 *
 * 参数化访问（`env('NODE_ENV')`）能绕开静态替换：bun 只替换字面量成员访问，
 * 看到 `process.env[key]` 就保留原样，由运行时决定。`Bun.env` 与
 * `process.env` 是同一个对象，两种写法等价。
 *
 * 注意：这里只适用于走 `bun build` 的后端。前端（Next.js）的
 * `NEXT_PUBLIC_*` 依赖构建期静态替换，不要套用这个 helper。
 */

/** 读取一个环境变量；`key` 是变量名，运行期求值。 */
export function env(key: string): string | undefined {
  return process.env[key]
}

/**
 * 是否为生产环境。
 *
 * 用函数而不是模块级常量，是为了测试能逐个用例切换 `process.env`
 * （与 `modules/auth/index.ts` 里 `getCookieDomain()` 的写法保持一致）。
 */
export function isProduction(): boolean {
  return env('NODE_ENV') === 'production'
}
