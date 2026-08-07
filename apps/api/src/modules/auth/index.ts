import { Elysia, t } from 'elysia'
import { authPlugin } from '../../plugins/auth'
import { verifyToken } from '../../lib/jwt'
import { getCsrfToken, sendCode, verifyCode } from '../../lib/shenicest-client'
import { ErrorResponse } from '../../common'

export const authModule = new Elysia()
  .use(authPlugin)

  .get('/me', async ({ cookie, set }) => {
    const token = cookie['shenicest_token'].value
    if (!token || typeof token !== 'string') {
      set.status = 401
      return { error: 'Not authenticated' }
    }
    try {
      const user = await verifyToken(token)
      return { user }
    } catch {
      set.status = 401
      return { error: 'Invalid or expired token' }
    }
  }, {
    detail: {
      summary: 'Get current user (cookie auth)',
      description: 'Returns user info from the httpOnly cookie JWT.',
      tags: ['Auth'],
      operationId: 'auth.getCurrentUserCookie',
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

    if (result.success && result.token) {
      cookie['shenicest_token'].set({
        value: result.token as string,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      })
    }

    return result
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
