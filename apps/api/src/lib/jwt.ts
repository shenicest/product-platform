import { jwtVerify } from 'jose'

const JWT_SECRET = process.env.SHENICEST_JWT_SECRET
if (!JWT_SECRET) throw new Error('SHENICEST_JWT_SECRET environment variable is required')

const ISSUER = 'shenicest.ton-ton.fun'
const AUDIENCE = 'shenicest.ton-ton.fun'

export interface SheNicestUser {
  user_id: number
  email: string | null
  role: string
}

export async function verifyToken(token: string): Promise<SheNicestUser> {
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(JWT_SECRET),
    { issuer: ISSUER, audience: AUDIENCE },
  )

  return {
    user_id: payload.user_id as number,
    email: (payload.email as string) ?? null,
    role: (payload.role as string) ?? 'user',
  }
}
