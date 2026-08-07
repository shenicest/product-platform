import { apiUrl } from '@/lib/api-url'

export async function POST(request: Request) {
  const proxy = new Request(apiUrl('/auth/send-code'), request)
  return fetch(proxy)
}