import { treaty } from '@elysiajs/eden/treaty2'
import type { App } from '@shenicest/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
if (!URL.canParse(API_URL)) {
  throw new Error(`API_URL is not a valid URL: ${API_URL}`)
}

// Server-side client (React Server Components)
export const api = treaty<App>(API_URL)

// Client-side client (browser, sends cookies for auth)
export const clientApi = treaty<App>(API_URL, {
  fetch: { credentials: 'include' },
})
