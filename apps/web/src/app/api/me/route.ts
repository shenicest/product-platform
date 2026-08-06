const API_URL = process.env.API_URL ?? 'http://localhost:3000'

export async function GET(request: Request) {
  const meUrl = new URL('/me', API_URL)
  const meProxy = new Request(meUrl, request)
  const meRes = await fetch(meProxy)

  if (!meRes.ok) return meRes

  const meData = await meRes.json()
  if (!meData.user) return Response.json(meData)

  const rolesUrl = new URL('/identity/roles', API_URL)
  const rolesRes = await fetch(rolesUrl, {
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
