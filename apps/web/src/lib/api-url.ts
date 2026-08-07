const API_URL = process.env.API_URL ?? 'http://localhost:3000'
if (!URL.canParse(API_URL)) {
  throw new Error(`API_URL is not a valid URL: ${API_URL}`)
}

export { API_URL }

export function apiUrl(path: string): string {
  const url = new URL(API_URL)
  url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`
  return url.toString()
}