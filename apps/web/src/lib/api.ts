import { treaty } from '@elysiajs/eden/treaty2'
import type { App } from '@shenicest/api'

const API_URL = process.env.API_URL ?? 'http://localhost:3000'
if (!URL.canParse(API_URL)) {
  throw new Error(`API_URL is not a valid URL: ${API_URL}`)
}

export const api = treaty<App>(API_URL)
