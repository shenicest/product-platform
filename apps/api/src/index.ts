import 'dotenv/config'
import { Elysia, t } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { cors } from '@elysiajs/cors'
import { authModule } from './modules/auth'
import { userIdentityModule } from './modules/user-identity'
import { projectModule } from './modules/project'
import { proposalModule } from './modules/proposal'
import { operatorModule } from './modules/operator'
import { founderModule } from './modules/founder'

const app = new Elysia()
  .use(openapi({
    documentation: {
      info: {
        title: 'Shenicest Product Platform',
        version: '1.0.0',
        description:
          'Product showcase platform backend API. Founders submit projects for review, operators curate and manage them, and visitors browse live projects. ' +
          'Authentication consumes JWTs issued by an external auth service — this API does not manage credentials.',
      },
      tags: [
        { name: 'Auth', description: 'Current-user identity from JWT' },
        { name: 'UserIdentity', description: 'Role queries (Founder / Operator)' },
        { name: 'Project', description: 'Project submission, draft editing, review submission, and public browsing' },
        { name: 'Proposal', description: 'Post-live edit proposals — diff-based changes reviewed by operators' },
        { name: 'Founder', description: 'Founder dashboard — own projects, stats, audit reasons, and proposals' },
        { name: 'Operator', description: 'Operator review actions, management lists, audit records, and platform statistics' },
      ],
      security: [{ bearerAuth: [] }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT issued by the external auth service. Pass as `Authorization: Bearer <token>`.',
          },
        },
      },
    },
  }))
  .use(cors({
    origin: [/\.vercel\.app$/],
  }))
  .use(authModule)
  .use(userIdentityModule)
  .use(projectModule)
  .use(proposalModule)
  .use(founderModule)
  .use(operatorModule)
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
