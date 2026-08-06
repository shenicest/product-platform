import { Elysia, status } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { verifyToken } from '../lib/jwt'
import { ErrorCode, ErrorMessage } from '../common'

export interface AuthUser {
  userId: string
}

const JWT_SECRET = process.env.SHENICEST_JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')


export const authPlugin = new Elysia({ name: 'auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: JWT_SECRET,
    }),
  )
  .macro('auth', {
    resolve: async ({ jwt, headers, cookie }) => {
      const authorization = headers.authorization
      if (authorization?.startsWith('Bearer ')) {
        const token = authorization.slice(7)
        const payload = await jwt.verify(token)
        if (payload && typeof payload.user_id === 'string')
          return { user: { userId: payload.user_id } satisfies AuthUser }
      }

      const cookieToken = cookie['shenicest_token'].value
      if (cookieToken && typeof cookieToken === 'string') {
        try {
          const user = await verifyToken(cookieToken)
          return { user: { userId: String(user.user_id) } satisfies AuthUser }
        } catch {
        }
      }
return status(401, { error: { code: ErrorCode.UNAUTHORIZED, message: ErrorMessage.UNAUTHORIZED } })
    },
  })
  .macro('optionalAuth', {
    resolve: async ({ jwt, headers, cookie }) => {
      try {
        const authorization = headers.authorization
        if (authorization?.startsWith('Bearer ')) {
          const token = authorization.slice(7)
          const payload = await jwt.verify(token)
          if (payload && typeof payload.user_id === 'string')
            return { user: { userId: payload.user_id } as AuthUser }
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
