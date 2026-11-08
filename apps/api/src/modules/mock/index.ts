import { Elysia, status, t } from 'elysia'
import { verifyToken } from '../../lib/jwt'
import {
  MOCK_COOKIE,
  MOCK_COOKIE_MAX_AGE,
  MOCK_USERS,
  getMockUserByKey,
  isMockAuthEnabled,
  resolveMockUserFromPayload,
  signMockToken,
  toMockUserSummary,
} from '../../mock'

/**
 * 本地 mock 登录的 HTTP 接口。
 *
 * 只在 `isMockAuthEnabled()` 为真时注册（见 app.ts）。生产环境里这些路由
 * **根本不存在**，不是靠运行时判断 403 —— 少一条可被利用的分支。
 *
 * 端点
 * ----
 * | 方法 | 路径              | 说明 |
 * |------|-------------------|------|
 * | GET  | /mock/users       | 列出可切换的 mock 用户 + 当前选中项 |
 * | POST | /mock/session     | 切换成某个 mock 用户；`key: null` 等于退出登录 |
 *
 * 为什么切换要落一个 cookie 而不是存内存：见 `mock/session.ts` 的说明 ——
 * Server Component 会手动把 cookie 透传给 API，存内存的话两端会各看到一个人。
 */

const clearMockCookie = () => `${MOCK_COOKIE}=; Max-Age=0; Path=/`

const sessionCookie = (token: string) =>
  `${MOCK_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MOCK_COOKIE_MAX_AGE}`

/** 当前请求是否带着一个有效的 mock 会话；是的话返回对应条目。 */
async function currentMockUser(cookieToken: string | undefined) {
  if (!cookieToken) return null
  try {
    const payload = await verifyToken(cookieToken)
    return resolveMockUserFromPayload(payload)
  } catch {
    return null
  }
}

export const mockModule = new Elysia({ prefix: '/mock' })
  // app.ts 已经按开关决定要不要注册本模块；这里再挡一层，是为了让
  // `MOCK_AUTH=off` 在**不重启进程**时也立即生效（例如测试里逐个用例切换）。
  // 返回 404 而不是 403：关闭时这些路径应当看起来压根不存在。
  .onBeforeHandle(({ set }) => {
    if (isMockAuthEnabled()) return
    set.status = 404
    return { error: { code: 'NOT_FOUND', message: 'Not Found' } }
  })
  .get('/users', async ({ cookie }) => {
    const token = cookie[MOCK_COOKIE].value
    const active = await currentMockUser(typeof token === 'string' ? token : undefined)
    return {
      active: active?.key ?? null,
      users: MOCK_USERS.map(toMockUserSummary),
    }
  }, {
    detail: {
      summary: 'List local mock users',
      description:
        'Local development only. Lists the mock users defined in src/mock/fixtures.ts plus the currently active one.',
      tags: ['Mock'],
      operationId: 'mock.listUsers',
    },
    response: {
      200: t.Object({
        active: t.Union([t.String(), t.Null()]),
        users: t.Array(t.Object({
          key: t.String(),
          label: t.String(),
          description: t.String(),
          userId: t.String(),
          email: t.Union([t.String(), t.Null()]),
          roles: t.Array(t.Number()),
          isOrganizer: t.Boolean(),
          hasProfile: t.Boolean(),
        })),
      }),
    },
  })
  .post('/session', async ({ body, set }) => {
    // null = 退出登录，回到匿名访客。
    if (body.key === null) {
      set.headers['set-cookie'] = clearMockCookie()
      return { active: null }
    }

    const user = getMockUserByKey(body.key)
    if (!user) {
      return status(400, {
        error: { code: 'MOCK_USER_NOT_FOUND', message: `Unknown mock user: ${body.key}` },
      })
    }

    const token = await signMockToken(user)
    set.headers['set-cookie'] = sessionCookie(token)
    return { active: user.key }
  }, {
    body: t.Object({ key: t.Union([t.String(), t.Null()]) }),
    detail: {
      summary: 'Switch the local mock user',
      description:
        'Local development only. Signs a mock JWT for the given mock user key and writes it to the shenicest_token cookie. Pass key: null to log out.',
      tags: ['Mock'],
      operationId: 'mock.switchUser',
    },
    response: {
      200: t.Object({ active: t.Union([t.String(), t.Null()]) }),
      400: t.Object({ error: t.Object({ code: t.String(), message: t.String() }) }),
    },
  })

/** app.ts 用这个决定要不要注册 mockModule。 */
export { isMockAuthEnabled } from '../../mock'
export { MOCK_USERS }
