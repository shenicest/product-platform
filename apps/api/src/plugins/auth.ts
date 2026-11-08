import { Elysia, status } from 'elysia'
import { verifyToken } from '../lib/jwt'
import { isMockAuthEnabled } from '../mock'
import { ErrorCode, ErrorMessage } from '../common'

export interface AuthUser {
  userId: string
  email: string | null
}

/**
 * 校验并转换成 AuthUser。
 *
 * 带 `mock: true` 的 token 只在 mock 开关打开时接受 —— 这是纵深防御：
 * 生产环境既不会签发 mock token（`/mock/*` 路由根本没注册），也不认它，
 * 万一有人拿本地签的 token 去试探也进不来。
 */
async function verify(token: string): Promise<AuthUser | null> {
  try {
    const user = await verifyToken(token)
    if (user.mock && !isMockAuthEnabled()) return null
    return { userId: String(user.user_id), email: user.email }
  } catch {
    return null
  }
}

async function resolveUser(
  headers: Record<string, string | undefined>,
  cookieToken: string | undefined,
): Promise<AuthUser | null> {
  const authorization = headers.authorization
  if (authorization?.startsWith('Bearer ')) {
    const user = await verify(authorization.slice(7))
    if (user) return user
  }

  if (cookieToken) return verify(cookieToken)

  return null
}

export const authPlugin = new Elysia({ name: 'auth' })
  .macro('auth', {
    resolve: async ({ headers, cookie }) => {
      const cookieToken = cookie['shenicest_token'].value
      const user = await resolveUser(headers, typeof cookieToken === 'string' ? cookieToken : undefined)
      if (!user) return status(401, { error: { code: ErrorCode.UNAUTHORIZED, message: ErrorMessage.UNAUTHORIZED } })
      return { user }
    },
  })
  .macro('optionalAuth', {
    resolve: async ({ headers, cookie }) => {
      const cookieToken = cookie['shenicest_token'].value
      const user = await resolveUser(headers, typeof cookieToken === 'string' ? cookieToken : undefined)
      return { user }
    },
  })
