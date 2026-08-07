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

  return Response.json({
    user: {
      ...meData.user,
      roles: rolesData.roles ?? [],
    },
  })
}