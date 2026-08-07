import { treaty } from '@elysiajs/eden/treaty2'
import type { App } from '@shenicest/api'
import { API_URL } from '@/lib/api-url'

// Server-side client (React Server Components)
export const api = treaty<App>(API_URL)