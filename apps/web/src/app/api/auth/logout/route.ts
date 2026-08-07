import { apiUrl } from '@/lib/api-url'

export async function POST(request: Request) {
  const proxy = new Request(apiUrl('/auth/logout'), request)
  return fetch(proxy)
}