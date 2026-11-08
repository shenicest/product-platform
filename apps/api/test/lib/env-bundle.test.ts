import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * 构建级回归测试：mock 开关必须在**打包产物**里仍是运行时判断。
 *
 * 背景（见 `src/lib/env.ts` 的文件头）：`bun build` 会把静态成员访问
 * `process.env.NODE_ENV` 替换成构建机上的值。部署流程在构建机上不设
 * `NODE_ENV`，所以一旦代码写回 `process.env.NODE_ENV`，产物里
 * `isMockAuthEnabled()` 会变成：
 *
 *     function isMockAuthEnabled() {
 *       if (false) ;                      // ← 「生产恒关闭」整段消失
 *       return process.env.MOCK_AUTH !== 'off'
 *     }
 *
 * 也就是说生产进程里 `/mock/*` 照样注册、mock token 照样被接受。
 * 这个测试真的跑一次 `bun build`，把那条闸钉住 —— 单元测试无法发现这类
 * 只在打包后才出现的退化。
 */

const ROOT = join(import.meta.dir, '..', '..')
const CONFIG = join(ROOT, 'src', 'mock', 'config.ts')

const dirs: string[] = []

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })))
})

/** 在构建机不设 NODE_ENV 的前提下打包 `src/mock/config.ts`，返回产物源码。 */
async function bundleMockConfig(): Promise<string> {
  const outDir = await mkdtemp(join(tmpdir(), 'shenicest-env-build-'))
  dirs.push(outDir)

  const proc = Bun.spawn(
    ['bun', 'build', CONFIG, '--outdir', outDir, '--target', 'bun'],
    {
      cwd: ROOT,
      // 显式抹掉 NODE_ENV：模拟 `docs/deploy-backend.md` 的构建机（`bun run build`
      // 不设这个变量，`bun run` 也不会替我们设）。
      env: { ...process.env, NODE_ENV: undefined },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )

  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`bun build failed: ${await new Response(proc.stderr).text()}`)
  }

  return await readFile(join(outDir, 'config.js'), 'utf8')
}

describe('mock config — survives bundling', () => {
  it('keeps the production gate as a runtime check, not a baked-in literal', async () => {
    const output = await bundleMockConfig()

    // 退化形态：`if (false) ;` —— 生产分支被删掉。
    expect(output).not.toMatch(/if\s*\(\s*false\s*\)/)
    // 退化形态：整个函数被折成 `return process.env.MOCK_AUTH !== "off"`。
    expect(output).toMatch(/isProduction/)
    expect(output).toMatch(/MOCK_AUTH/)
  })

  it('routes the NODE_ENV read through the env helper', async () => {
    const output = await bundleMockConfig()

    // helper 被内联后仍应是参数化访问（`env3("NODE_ENV")` / `process.env[key]`），
    // 绝不能是被替换好的字面量比较。
    expect(output).not.toMatch(/NODE_ENV\s*===\s*"production"/)
    expect(output).toMatch(/NODE_ENV/)
  })
})
