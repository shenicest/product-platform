import { apiUrl } from '@/lib/api-url'

export async function GET(request: Request) {
  const proxy = new Request(apiUrl('/auth/sso-redirect'), request)
  // redirect: 'manual' surfaces the upstream 302 (with its Set-Cookie
  // headers) to the browser instead of following it server-side, so the
  // shared-domain cookie is set on this origin before navigating away.
  return fetch(proxy, { redirect: 'manual' })
}
