import { Elysia, t } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { cors } from '@elysiajs/cors'
import { authModule } from './modules/auth'
import { userIdentityModule } from './modules/user-identity'
import { projectModule } from './modules/project'
import { proposalModule } from './modules/proposal'
import { operatorModule } from './modules/operator'
import { founderModule } from './modules/founder'
import { uploadModule } from './modules/upload'
import { likeModule } from './modules/like'
import { followModule } from './modules/follow'
import { talentModule, talentOperatorModule } from './modules/talent'
import { bathModule } from './modules/bath'
import { hackathonModule } from './modules/hackathon'
import { hackathonConnectionModule } from './modules/hackathon-connection'
import { projectConnectionModule } from './modules/project-connection'
import { connectionsModule } from './modules/connections'
import { organizerOrgModule } from './modules/organizer-org'
import { seasonModule } from './modules/season'
import { challengeModule } from './modules/challenge'
import { seasonConfigModule } from './modules/season-config'
import { seasonApplicationModule } from './modules/season-application'
import { seasonTeamModule } from './modules/season-team'
import { isMockAuthEnabled } from './mock'
import { env } from './lib/env'
import { mockModule } from './modules/mock'

/**
 * 本地 mock 登录模块：只在非生产、且没有显式 `MOCK_AUTH=off` 时注册。
 *
 * 关闭时挂一个空实例，而不是在路由里判断 —— 生产环境的 App 上这些路径
 * 压根不存在，少一条可被利用的分支。
 */
const localMockModule = isMockAuthEnabled() ? mockModule : new Elysia()

export const app = new Elysia()
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
        { name: 'Upload', description: 'Pre-signed COS image upload for project assets' },
        { name: 'Talent', description: 'Talent Plaza profiles, discovery, matching, and connection requests' },
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
    origin: [
      /^https?:\/\/(www\.|product-platform\.)?shenicest\.com$/,
      /\.vercel\.app$/,
      /^https?:\/\/localhost(:\d+)?$/,
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    ],
    credentials: true,
  }))
  .use(authModule)
  .use(userIdentityModule)
  .use(projectModule)
  .use(hackathonModule)
  .use(hackathonConnectionModule)
  .use(projectConnectionModule)
  .use(likeModule)
  .use(followModule)
  .use(talentModule)
  .use(talentOperatorModule)
  .use(proposalModule)
  .use(founderModule)
  .use(uploadModule)
  .use(bathModule)
  .use(connectionsModule)
  .use(operatorModule)
  .use(organizerOrgModule)
  .use(seasonModule)
  .use(challengeModule)
  .use(seasonConfigModule)
  .use(seasonApplicationModule)
  .use(seasonTeamModule)
  .use(localMockModule)
  .get('/health', () => ({ status: 'ok' as const, env: env('NODE_ENV') }), {
    detail: {
      summary: 'Health check',
      description: 'Returns server health status',
      tags: ['App'],
      hide: true,
    },
    response: t.Object({
      status: t.Literal('ok'),
      env: t.Optional(t.String()),
    }),
  })

export type App = typeof app
