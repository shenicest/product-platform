import { cache } from 'react'
import { cookies } from 'next/headers'
import type { Role } from '@shenicest/shared'
import { api } from '@/lib/api'

export interface SessionUser {
  userId: string
  email: string | null
  roles: Role[]
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies()
  const token = jar.get('shenicest_token')?.value
  if (!token) return null

  try {
    const headers = { cookie: `shenicest_token=${token}` }
    const { data, error } = await api.me.get({ headers })
    if (error || !data) return null

    const { data: rolesData } = await api.identity.roles.get({ headers })

    return {
      userId: String(data.user.user_id),
      email: data.user.email,
      roles: (rolesData?.roles ?? []) as Role[],
    }
  } catch {
    return null
  }
})
