export interface AuthUser {
  user_id: number
  email: string | null
  role: string
  roles: number[]
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/me')
    if (!res.ok) return null
    const data = await res.json()
    const user = data.user
    if (!user) return null
    return { roles: [], ...user }
  } catch {
    return null
  }
}

export async function logoutRequest(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}
