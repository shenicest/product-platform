import { clientApi } from '@/lib/api'

export interface AuthUser {
  user_id: number
  email: string | null
  role: string
  roles: number[]
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data, error } = await clientApi.me.get()
    if (error || !data) return null
    const user = (data as { user?: AuthUser }).user
    if (!user) return null
    return { ...user, roles: user.roles ?? [] }
  } catch {
    return null
  }
}

export async function logoutRequest(): Promise<void> {
  await clientApi.auth.logout.post()
}
