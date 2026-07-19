import { Elysia, t } from 'elysia'
import { dbPlugin } from './plugins/db'
import { authPlugin } from './plugins/auth'

const app = new Elysia()
  .use(dbPlugin)
  .use(authPlugin)
  .get('/health', () => ({ status: 'ok' as const }), {
    response: t.Object({
      status: t.Literal('ok'),
    }),
  })
  .get('/me', ({ user }) => ({ userId: user.userId }), {
    auth: true,
    response: {
      200: t.Object({ userId: t.String() }),
      401: t.Literal('Unauthorized'),
    },
  })
  .listen(3000)

console.log(`Server running at http://localhost:${app.server?.port}`)

export type App = typeof app
