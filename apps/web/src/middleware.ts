import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isTokenUnexpired(token: string): boolean {
  try {
    const segment = token.split('.')[1]
    if (!segment) return false
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(bytes))
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now()
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('shenicest_token')?.value
  const pathname = request.nextUrl.pathname

  // Decodes exp without verifying the signature: this redirect is a UX hint,
  // not a security boundary. Expired or malformed tokens reach /login so the
  // user can authenticate again.
  if (pathname.startsWith('/login') && token && isTokenUnexpired(token)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
