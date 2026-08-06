const API_URL = process.env.API_URL ?? 'http://localhost:3000'

export async function POST(request: Request) {
  const url = new URL('/auth/verify-code', API_URL)
  const proxy = new Request(url, request)
  return fetch(proxy)
}
