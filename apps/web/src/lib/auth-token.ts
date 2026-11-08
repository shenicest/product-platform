import { loginLogout } from '@/lib/client-api'

export interface AuthUser {
  user_id: number
  email: string | null
  role: string
  roles: number[]
  nickname: string | null
  avatarUrl: string | null
  /** 是否属于至少一个主办方组织（由 `/api/me` 汇总，决定主办方后台入口）。 */
  isOrganizerMember?: boolean
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' })
    if (!res.ok) return null
    const data = (await res.json()) as { user?: AuthUser }
    if (!data.user) return null
    return {
      ...data.user,
      roles: data.user.roles ?? [],
      nickname: data.user.nickname ?? null,
      avatarUrl: data.user.avatarUrl ?? null,
      isOrganizerMember: data.user.isOrganizerMember === true,
    }
  } catch {
    return null
  }
}

export async function logoutRequest(): Promise<void> {
  await loginLogout()
}
