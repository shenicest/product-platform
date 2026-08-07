import { loginLogout } from '@/lib/client-api'

export interface AuthUser {
  user_id: number
  email: string | null
  role: string
  roles: number[]
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' })
    if (!res.ok) return null
    const data = (await res.json()) as { user?: AuthUser }
    if (!data.user) return null
    return { ...data.user, roles: data.user.roles ?? [] }
  } catch {
    return null
  }
}

export async function logoutRequest(): Promise<void> {
  await loginLogout()
}
