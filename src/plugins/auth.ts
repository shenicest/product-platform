import { Elysia, status } from 'elysia'
import { jwt } from '@elysiajs/jwt'

export interface AuthUser {
  userId: string
}

export const authPlugin = new Elysia({ name: 'auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET!,
    }),
  )
  .macro({
    auth: {
      resolve: async ({ jwt, headers }) => {
        const authorization = headers.authorization
        if (!authorization?.startsWith('Bearer '))
          return status(401, 'Unauthorized')

        const token = authorization.slice(7)
        const payload = await jwt.verify(token)
        if (!payload) return status(401, 'Unauthorized')

        return { user: { userId: payload.user_id as string } satisfies AuthUser }
      },
    },
  })
