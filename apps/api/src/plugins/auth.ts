import { Elysia, status } from 'elysia'
import { verifyToken } from '../lib/jwt'
import { ErrorCode, ErrorMessage } from '../common'

export interface AuthUser {
  userId: string
}

async function resolveUser(
  headers: Record<string, string | undefined>,
  cookieToken: string | undefined,
): Promise<AuthUser | null> {
  const authorization = headers.authorization
  if (authorization?.startsWith('Bearer ')) {
    try {
      const user = await verifyToken(authorization.slice(7))
      return { userId: String(user.user_id) }
    } catch {}
  }

  if (cookieToken) {
    try {
      const user = await verifyToken(cookieToken)
      return { userId: String(user.user_id) }
    } catch {}
  }

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
