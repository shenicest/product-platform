import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { DEMO_COOKIE, DEMO_IDENTITIES, DEMO_MODE, resolveDemoIdentity } from '@/lib/demo-mode'

/**
 * 演示身份切换。只在 DEMO_MODE 开启时存在；关闭后返回 404，
 * 行为与「这些路由根本没注册」一致，不给生产留免登录入口。
 */
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60

function unavailable() {
  return NextResponse.json(
    { error: { code: 'NOT_FOUND', message: 'Not Found' } },
    { status: 404 },
  )
}

export async function GET() {
  if (!DEMO_MODE) return unavailable()
  const identity = resolveDemoIdentity((await cookies()).get(DEMO_COOKIE)?.value)
  return NextResponse.json({ identity: identity.key })
}

export async function POST(request: Request) {
  if (!DEMO_MODE) return unavailable()

  let key: unknown
  try {
    const body = (await request.json()) as { identity?: unknown }
    key = body.identity
  } catch {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 },
    )
  }

  if (typeof key !== 'string' || !DEMO_IDENTITIES.some((identity) => identity.key === key)) {
    return NextResponse.json(
      { error: { code: 'DEMO_IDENTITY_UNKNOWN', message: 'Unknown demo identity' } },
      { status: 400 },
    )
  }

  const response = NextResponse.json({ identity: key })
  response.cookies.set(DEMO_COOKIE, key, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
  return response
}
