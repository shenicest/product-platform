import { Elysia, t } from 'elysia'
import { authPlugin } from '../../plugins/auth'
import { ErrorResponse } from '../../common'

export const authModule = new Elysia()
  .use(authPlugin)
  .get('/me', ({ user }) => ({ userId: user.userId }), {
    auth: true,
    detail: {
      summary: 'Get current user',
      description: 'Returns the user ID parsed from the JWT token.',
      tags: ['Auth'],
      operationId: 'auth.getCurrentUser',
    },
    response: {
      200: t.Object({ userId: t.String() }),
      401: ErrorResponse,
    },
  })
