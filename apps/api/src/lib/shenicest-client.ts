const API_BASE = process.env.SHENICEST_API_BASE
if (!API_BASE) throw new Error('SHENICEST_API_BASE environment variable is required')

interface PlatformResponse {
  success: boolean
  [key: string]: unknown
}

async function platformFetch(
  path: string,
  options: RequestInit = {},
): Promise<{ data: PlatformResponse; cookies: string[] }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  })

  const data = await res.json()
  const cookies = res.headers.getSetCookie?.() ?? []
  return { data, cookies }
}

export async function getCsrfToken(): Promise<{ token: string; cookies: string[] }> {
  const { data, cookies } = await platformFetch('/csrf-token.php')
  if (!data.success) throw new Error('Failed to get CSRF token')
  return { token: data.token as string, cookies }
}

export async function sendCode(
  identifier: string,
  csrfToken: string,
  sessionCookies: string[],
): Promise<PlatformResponse> {
  const { data } = await platformFetch('/send-code.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      Cookie: sessionCookies.join('; '),
    },
    body: JSON.stringify({ identifier }),
  })
  return data
}

export async function verifyCode(
  identifier: string,
  code: string,
  csrfToken: string,
  sessionCookies: string[],
): Promise<PlatformResponse> {
  const { data } = await platformFetch('/verify-code.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      Cookie: sessionCookies.join('; '),
    },
    body: JSON.stringify({ identifier, code }),
  })
  return data
}

export async function refreshToken(
  jwt: string,
  csrfToken: string,
  sessionCookies: string[],
): Promise<PlatformResponse> {
  const { data } = await platformFetch('/refresh-token.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'X-CSRF-Token': csrfToken,
      Cookie: sessionCookies.join('; '),
    },
  })
  return data
}
