import { Elysia, status, t } from 'elysia'
import { authPlugin } from '../../plugins/auth'
import { verifyToken } from '../../lib/jwt'
import { getCsrfToken, sendCode, verifyCode } from '../../lib/shenicest-client'
import { ErrorCode, ErrorMessage, ErrorResponse } from '../../common'

const unauthorized = () =>
  status(401, { error: { code: ErrorCode.UNAUTHORIZED, message: ErrorMessage.UNAUTHORIZED } })

const TOKEN_COOKIE = 'shenicest_token'
const TOKEN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60

// Optional; read lazily so tests can toggle it per case. When set (e.g.
// `.shenicest.com` in production) the token cookie is shared across the whole
// registrable domain, so shenicest.com/platform sees the same login state.
// Leave unset on localhost where a parent domain does not exist.
const getCookieDomain = () => process.env.COOKIE_DOMAIN || undefined
const getMainSiteUrl = () => process.env.MAIN_SITE_URL || 'https://shenicest.com/platform/projects'
const isProduction = () => process.env.NODE_ENV === 'production'

// Raw Set-Cookie strings are used wherever one response must touch both the
// host-only and the domain-scoped variants of the cookie (Elysia's cookie jar
// keeps a single entry per name). Attributes mirror the jar-based set in
// /auth/verify-code.
const serializeTokenCookie = (value: string, domain: string) => {
  const parts = [
    `${TOKEN_COOKIE}=${value}`,
    `Domain=${domain}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${TOKEN_COOKIE_MAX_AGE}`,
  ]
  if (isProduction()) parts.push('Secure')
  return parts.join('; ')
}

const clearTokenCookieVariants = () => {
  const deletions = [`${TOKEN_COOKIE}=; Max-Age=0; Path=/`]
  const domain = getCookieDomain()
  if (domain) deletions.push(`${TOKEN_COOKIE}=; Max-Age=0; Path=/; Domain=${domain}`)
  return deletions
}

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
      const domain = getCookieDomain()
      cookie[TOKEN_COOKIE].set({
        value: result.token,
        httpOnly: true,
        secure: isProduction(),
        sameSite: 'lax',
        path: '/',
        maxAge: TOKEN_COOKIE_MAX_AGE,
        ...(domain ? { domain } : {}),
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

  .post('/auth/logout', ({ set }) => {
    set.headers['set-cookie'] = clearTokenCookieVariants()
    return { success: true }
  }, {
    detail: {
      summary: 'Logout',
      description: 'Clears the authentication cookie.',
      tags: ['Auth'],
      operationId: 'auth.logout',
    },
  })

  .get('/auth/sso-redirect', async ({ cookie, set }) => {
    const domain = getCookieDomain()
    const token = cookie[TOKEN_COOKIE].value
    if (domain && token && typeof token === 'string') {
      try {
        await verifyToken(token)
        set.headers['set-cookie'] = [
          `${TOKEN_COOKIE}=; Max-Age=0; Path=/`,
          serializeTokenCookie(token, domain),
        ]
      } catch {
        // Expired or invalid token: redirect without upgrading the cookie.
      }
    }
    set.status = 302
    set.headers['location'] = getMainSiteUrl()
    return ''
  }, {
    detail: {
      summary: 'SSO redirect to the main site',
      description:
        'Upgrades the token cookie to the shared parent domain (when COOKIE_DOMAIN is set) and redirects to the main site, so an existing login here is carried over.',
      tags: ['Auth'],
      operationId: 'auth.ssoRedirect',
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
