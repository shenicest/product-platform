import { apiUrl } from '@/lib/api-url'

export async function GET(request: Request) {
  const meUrl = apiUrl('/me')
  const meProxy = new Request(meUrl, request)
  const meRes = await fetch(meProxy)

  if (!meRes.ok) return meRes

  const meData = await meRes.json()
  if (!meData.user) return Response.json(meData)

  const rolesRes = await fetch(apiUrl('/identity/roles'), {
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
  })
  const rolesData = rolesRes.ok ? await rolesRes.json() : { roles: [] }

  // Own public profile (account nickname) lets form pages prefill contact
  // fields; degrades to nulls when the shared users table has no row.
  const profileRes = await fetch(apiUrl('/founder/profile'), {
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
  })
  const profileData = profileRes.ok
    ? ((await profileRes.json()) as { nickname?: string | null; avatarUrl?: string | null })
    : { nickname: null, avatarUrl: null }

  return Response.json({
    user: {
      ...meData.user,
      roles: rolesData.roles ?? [],
      nickname: profileData.nickname ?? null,
      avatarUrl: profileData.avatarUrl ?? null,
    },
  })
}