import { Elysia, status } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { ErrorCode, ErrorMessage } from '../common'

export interface AuthUser {
  userId: string
}

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required')

export const authPlugin = new Elysia({ name: 'auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: JWT_SECRET,
    }),
  )
  .macro('auth', {
    resolve: async ({ jwt, headers }) => {
      const authorization = headers.authorization
      if (!authorization?.startsWith('Bearer '))
        return status(401, { error: { code: ErrorCode.UNAUTHORIZED, message: ErrorMessage.UNAUTHORIZED } })

      const token = authorization.slice(7)
      const payload = await jwt.verify(token)
      if (!payload || typeof payload.user_id !== 'string') return status(401, { error: { code: ErrorCode.UNAUTHORIZED, message: ErrorMessage.UNAUTHORIZED } })

      return { user: { userId: payload.user_id } satisfies AuthUser }
    },
  })
