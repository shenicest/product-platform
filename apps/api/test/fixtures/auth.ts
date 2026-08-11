import { SignJWT } from 'jose'

export const ISSUER = 'shenicest.com'
export const AUDIENCE = 'shenicest.com'

function secret(): string {
  const value = process.env.SHENICEST_JWT_SECRET
  if (!value) throw new Error('SHENICEST_JWT_SECRET must be set (test/setup.ts provides it)')
  return value
}

// Signs a JWT the same way the external auth service does (HS256, fixed
// issuer/audience). Pass `secretOverride` to forge tokens with a wrong
// secret for negative tests.
export async function signToken(
  payload: Record<string, unknown>,
  secretOverride?: string,
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .sign(new TextEncoder().encode(secretOverride ?? secret()))
}

export function authHeaders(token: string) {
  return { authorization: `Bearer ${token}` }
}

export function jsonHeaders(token: string) {
  return { ...authHeaders(token), 'content-type': 'application/json' }
}

export function cookieHeaders(token: string) {
  return { cookie: `shenicest_token=${token}` }
}
