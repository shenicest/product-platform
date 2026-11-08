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

  // Organizer membership decides whether the 「主办方后台」 menu entry shows in
  // production. Fetched here rather than in the menu so the header stays one
  // request per page; degrades to false when the user belongs to no org.
  const orgsRes = await fetch(apiUrl('/organizer-orgs'), {
    headers: {
      cookie: request.headers.get('cookie') ?? '',
    },
  })
  const orgsData = orgsRes.ok ? await orgsRes.json() : { items: [] }
  const isOrganizerMember = Array.isArray(orgsData.items)
    && orgsData.items.some((org: { isMember?: boolean }) => org.isMember === true)

  return Response.json({
    user: {
      ...meData.user,
      roles: rolesData.roles ?? [],
      nickname: profileData.nickname ?? null,
      avatarUrl: profileData.avatarUrl ?? null,
      isOrganizerMember,
    },
  })
}