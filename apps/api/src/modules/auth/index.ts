import { Elysia, status, t } from 'elysia'
import { authPlugin } from '../../plugins/auth'
import { verifyToken } from '../../lib/jwt'
import { getCsrfToken, sendCode, verifyCode } from '../../lib/shenicest-client'
import { ErrorCode, ErrorMessage, ErrorResponse } from '../../common'

const unauthorized = () =>
  status(401, { error: { code: ErrorCode.UNAUTHORIZED, message: ErrorMessage.UNAUTHORIZED } })

export const authModule = new Elysia()
  .use(authPlugin)

  .get('/me', async ({ cookie }) => {
    const token = cookie['shenicest_token'].value
    if (!token || typeof token !== 'string') return unauthorized()
    try {
      const user = await verifyToken(token)
      return { user }
    } catch {
      return unauthorized()
    }
  }, {
    detail: {
      summary: 'Get current user (cookie auth)',
      description: 'Returns user info from the httpOnly cookie JWT.',
      tags: ['Auth'],
      operationId: 'auth.getCurrentUserCookie',
    },
    response: {
      200: t.Object({
        user: t.Object({
          user_id: t.Number(),
          email: t.Union([t.String(), t.Null()]),
          role: t.String(),
        }),
      }),
      401: ErrorResponse,
    },
  })

  .post('/auth/send-code', async ({ body }) => {
    const { token: csrfToken, cookies } = await getCsrfToken()
    const result = await sendCode(body.identifier, csrfToken, cookies)
    return result
  }, {
    body: t.Object({ identifier: t.String({ minLength: 1 }) }),
    detail: {
      summary: 'Send OTP code',
      description: 'Sends a verification code to the given email identifier.',
      tags: ['Auth'],
      operationId: 'auth.sendCode',
    },
  })

  .post('/auth/verify-code', async ({ body, cookie }) => {
    const { token: csrfToken, cookies } = await getCsrfToken()
    const result = await verifyCode(body.identifier, body.code, csrfToken, cookies)

    if (result.success && typeof result.token === 'string') {
      cookie['shenicest_token'].set({
        value: result.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      })
    }

    const { token: _token, ...rest } = result
    return rest
  }, {
    body: t.Object({
      identifier: t.String({ minLength: 1 }),
      code: t.String({ minLength: 6, maxLength: 6 }),
    }),
    detail: {
      summary: 'Verify OTP code and login',
      description: 'Verifies the code, sets an httpOnly JWT cookie on success.',
      tags: ['Auth'],
      operationId: 'auth.verifyCode',
    },
  })

  .post('/auth/logout', ({ cookie }) => {
    cookie['shenicest_token'].remove()
    return { success: true }
  }, {
    detail: {
      summary: 'Logout',
      description: 'Clears the authentication cookie.',
      tags: ['Auth'],
      operationId: 'auth.logout',
    },
  })

  .get('/me/bearer', ({ user }) => ({ userId: user.userId }), {
    auth: true,
    detail: {
      summary: 'Get current user (Bearer auth)',
      description: 'Returns the user ID from the JWT Bearer token.',
      tags: ['Auth'],
      operationId: 'auth.getCurrentUser',
    },
    response: {
      200: t.Object({ userId: t.String() }),
      401: ErrorResponse,
    },
  })
