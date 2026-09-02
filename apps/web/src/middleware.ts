import { NextResponse } from 'next/server'

export function middleware() {
  // Do not infer authentication from an unverified JWT. In particular, an old
  // cookie can still have a future exp after the signing secret changes and
  // must not make the login page unreachable.
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
}
