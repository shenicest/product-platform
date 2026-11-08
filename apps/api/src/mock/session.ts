import { SignJWT } from 'jose'
import { isMockAuthEnabled } from './config'
import { findMockUserByUserId, getMockUserByKey, type MockUser } from './fixtures'

/**
 * mock 会话 = 一个真正签过名的 JWT。
 *
 * 为什么不另起一套「mock cookie / 内存会话」？
 * ------------------------------------------------------------------
 * 全站所有身份读取路径最后都收敛到 `shenicest_token` 这个 cookie：
 *   · API 侧 `plugins/auth.ts` 的 `auth` / `optionalAuth` macro；
 *   · web 侧 `src/server/*.ts` 里的 Server Component 数据层 —— 它们**手动**把
 *     `cookie: shenicest_token=...` 透传给 eden treaty（Server 端没有浏览器
 *     自动带 cookie 这回事）。
 * 如果 mock 身份放在另一个 cookie 或进程内存里，上面每一处都得再加一条分支，
 * 而且 Next 的 server/client 两侧、多标签页、热重载都会各看到不同的“当前用户”。
 *
 * 改成签一个真 JWT 之后：mock 就是「登录成了另一个人」，其余链路零改动 ——
 * 中间件、服务端守卫、客户端 `useAuth()`、`/api/me` 聚合全部照常工作。
 *
 * 与真实用户的区分
 * ----------------
 * payload 里多带一个 `mock: true`。只有带这个标记的 token，角色/组织/资料才会
 * 走 `fixtures.ts` 的覆盖；真实 token 永远读数据库。因此即使某个真实用户
 * 恰好也是 9001 号，也不会被 mock 数据劫持。
 */
export const MOCK_COOKIE = 'shenicest_token'
export const MOCK_COOKIE_MAX_AGE = 24 * 60 * 60

const ISSUER = 'shenicest.com'
const AUDIENCE = 'shenicest.com'

function secret(): string {
  const value = process.env.SHENICEST_JWT_SECRET
  if (!value) throw new Error('SHENICEST_JWT_SECRET environment variable is required')
  return value
}

/** 为指定 mock 用户签发一个本地开发用的 JWT。 */
export async function signMockToken(user: MockUser): Promise<string> {
  // `user_id` 必须是 number：真实签发方就这么发，`GET /me` 的响应 schema 也按
  // number 校验（见 modules/auth/index.ts），写成字符串会直接被响应校验拒掉。
  const userId = Number(user.userId)
  if (!Number.isSafeInteger(userId)) {
    throw new Error(`Mock user "${user.key}" has a non-numeric userId: ${user.userId}`)
  }

  return new SignJWT({
    user_id: userId,
    email: user.email,
    // `role` 是外部认证系统的账号角色，不参与平台授权决策（见 docs/auth.md）。
    role: 'user',
    mock: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${MOCK_COOKIE_MAX_AGE}s`)
    .sign(new TextEncoder().encode(secret()))
}

/**
 * 从已验证的 JWT payload 里认出 mock 用户。
 *
 * 调用方必须已经把 token 验过签（`verifyToken`）—— 这里只看标记，不验签。
 * mock 关闭时恒返回 null，保证生产环境不存在任何 mock 分支。
 */
export function resolveMockUserFromPayload(payload: {
  mock?: unknown
  user_id?: unknown
}): MockUser | null {
  if (!isMockAuthEnabled()) return null
  if (payload.mock !== true) return null
  const userId = payload.user_id
  if (typeof userId !== 'string' && typeof userId !== 'number') return null
  return findMockUserByUserId(String(userId))
}

/** 切换器当前选中项：按 cookie 里的 token 反查 key。 */
export function mockKeyOf(user: MockUser | null): string | null {
  return user?.key ?? null
}

export { getMockUserByKey }
