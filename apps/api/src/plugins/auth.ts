import { Elysia, status } from 'elysia'
import { verifyToken } from '../lib/jwt'
import { ErrorCode, ErrorMessage } from '../common'

export interface AuthUser {
  userId: string
}

export const authPlugin = new Elysia({ name: 'auth' })
  .macro('auth', {
    resolve: async ({ headers, cookie }) => {
      const authorization = headers.authorization
      if (authorization?.startsWith('Bearer ')) {
        const token = authorization.slice(7)
        try {
          const user = await verifyToken(token)
          return { user: { userId: String(user.user_id) } satisfies AuthUser }
        } catch {}
      }

      const cookieToken = cookie['shenicest_token'].value
      if (cookieToken && typeof cookieToken === 'string') {
        try {
          const user = await verifyToken(cookieToken)
          return { user: { userId: String(user.user_id) } satisfies AuthUser }
        } catch {}
      }
      return status(401, { error: { code: ErrorCode.UNAUTHORIZED, message: ErrorMessage.UNAUTHORIZED } })
    },
  })
  .macro('optionalAuth', {
    resolve: async ({ headers, cookie }) => {
      try {
        const authorization = headers.authorization
        if (authorization?.startsWith('Bearer ')) {
          const token = authorization.slice(7)
          const user = await verifyToken(token)
          return { user: { userId: String(user.user_id) } as AuthUser }
        }

        const cookieToken = cookie['shenicest_token'].value
        if (cookieToken && typeof cookieToken === 'string') {
          const user = await verifyToken(cookieToken)
          return { user: { userId: String(user.user_id) } as AuthUser }
        }

        return { user: null as AuthUser | null }
      } catch {
        return { user: null as AuthUser | null }
      }
    },
  })
