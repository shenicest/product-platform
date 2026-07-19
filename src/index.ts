import { Elysia, t } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { authModule } from './modules/auth'
import { userIdentityModule } from './modules/user-identity'

const app = new Elysia()
  .use(openapi({
    documentation: {
      info: {
        title: 'Shenicest Product Platform',
        version: '0.1.0',
      },
      tags: [
        { name: 'Auth', description: 'Authentication' },
        { name: 'UserIdentity', description: 'User identity management' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  }))
  .use(authModule)
  .use(userIdentityModule)
  .get('/health', () => ({ status: 'ok' as const }), {
    detail: {
      summary: 'Health check',
      description: 'Returns server health status',
      tags: ['App'],
      hide: true,
    },
    response: t.Object({
      status: t.Literal('ok'),
    }),
  })
  .listen(Number(process.env.PORT) || 3000)

console.log(`Server running at http://localhost:${app.server?.port}`)

export type App = typeof app
