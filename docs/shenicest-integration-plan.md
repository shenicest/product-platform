# SheNicest 平台用户系统接入 — AI 执行方案

## 概述

将 SheNicest 平台的用户认证系统（OTP 验证码登录）接入到 Next.js + Elysia 项目中。
**不修改平台任何代码**，所有交互通过 Elysia 后端代理平台 API 完成。

## 架构

```
用户浏览器 (Next.js)
    │
    │  /api/auth/send-code  (Elysia 路由)
    │  /api/auth/verify-code (Elysia 路由)
    │  /api/auth/me          (Elysia 路由)
    │  /api/auth/logout      (Elysia 路由)
    │
    ▼
Elysia 后端 ──(server-to-server)──► SheNicest 平台 API
    │                                https://shenicest.com/platform/api/
    │                                ├── csrf-token.php  (GET)
    │                                ├── send-code.php   (POST)
    │                                ├── verify-code.php (POST)
    │                                └── refresh-token.php (POST, 可选)
    │
    ▼
JWT 验证 (jose) — 用共享 JWT_SECRET 本地验证
```

## 前置条件

1. 从平台运维处获取 `JWT_SECRET`（与平台 `api/.env` 中的 `JWT_SECRET` 完全一致）
2. 确认平台 `api/.env` 中 `ALLOWED_ORIGINS` 包含你的系统域名（生产环境必须）
3. 平台 API 基础 URL：`https://shenicest.com/platform/api`

## JWT 规格（验证时使用）

| 字段 | 值 |
|------|----|
| 算法 | HS256 |
| 签发者 (iss) | `shenicest.ton-ton.fun` |
| 受众 (aud) | `shenicest.ton-ton.fun` |
| 过期时间 | 30 天 (2592000 秒) |
| 时钟容差 | 60 秒 |

JWT Payload 结构：
```json
{
  "user_id": 123,
  "email": "user@example.com",
  "role": "user",
  "iat": 1722000000,
  "exp": 1724592000,
  "iss": "shenicest.ton-ton.fun",
  "aud": "shenicest.ton-ton.fun"
}
```

`role` 取值：`user` | `staff` | `reviewer` | `event_admin` | `super_admin`

---

## 执行步骤

### Step 1: 安装依赖

```bash
bun add jose
```

> 用 `jose` 做 JWT 验证，兼容 Bun/Elysia 运行时。

### Step 2: 环境变量

在项目的 `.env` 中添加：

```env
SHENICEST_JWT_SECRET=<从平台运维获取>
SHENICEST_API_BASE=https://shenicest.com/platform/api
```

### Step 3: 创建平台 API 客户端

创建文件 `src/lib/shenicest-client.ts`：

```typescript
const API_BASE = process.env.SHENICEST_API_BASE!;

interface PlatformResponse {
  success: boolean;
  [key: string]: unknown;
}

async function platformFetch(
  path: string,
  options: RequestInit = {}
): Promise<{ data: PlatformResponse; cookies: string[] }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  const data = await res.json();
  const cookies = res.headers.getSetCookie?.() ?? [];
  return { data, cookies };
}

export async function getCsrfToken(): Promise<{ token: string; cookies: string[] }> {
  const { data, cookies } = await platformFetch('/csrf-token.php');
  if (!data.success) throw new Error('Failed to get CSRF token');
  return { token: data.token as string, cookies };
}

export async function sendCode(
  identifier: string,
  csrfToken: string,
  sessionCookies: string[]
): Promise<PlatformResponse> {
  const { data } = await platformFetch('/send-code.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      Cookie: sessionCookies.join('; '),
    },
    body: JSON.stringify({ identifier }),
  });
  return data;
}

export async function verifyCode(
  identifier: string,
  code: string,
  csrfToken: string,
  sessionCookies: string[]
): Promise<PlatformResponse> {
  const { data } = await platformFetch('/verify-code.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      Cookie: sessionCookies.join('; '),
    },
    body: JSON.stringify({ identifier, code }),
  });
  return data;
}

export async function refreshToken(
  jwt: string,
  csrfToken: string,
  sessionCookies: string[]
): Promise<PlatformResponse> {
  const { data } = await platformFetch('/refresh-token.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      'X-CSRF-Token': csrfToken,
      Cookie: sessionCookies.join('; '),
    },
  });
  return data;
}
```

### Step 4: 创建 JWT 验证模块

创建文件 `src/lib/jwt.ts`：

```typescript
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.SHENICEST_JWT_SECRET!;
const ISSUER = 'shenicest.ton-ton.fun';
const AUDIENCE = 'shenicest.ton-ton.fun';

export interface SheNicestUser {
  user_id: number;
  email: string | null;
  role: string;
}

export async function verifyToken(token: string): Promise<SheNicestUser> {
  const { payload } = await jwtVerify(
    token,
    new TextEncoder().encode(JWT_SECRET),
    { issuer: ISSUER, audience: AUDIENCE }
  );

  return {
    user_id: payload.user_id as number,
    email: (payload.email as string) ?? null,
    role: (payload.role as string) ?? 'user',
  };
}
```

### Step 5: 创建 Elysia 认证路由

创建文件 `src/routes/auth.ts`：

```typescript
import { Elysia, t } from 'elysia';
import { getCsrfToken, sendCode, verifyCode } from '../lib/shenicest-client';
import { verifyToken, type SheNicestUser } from '../lib/jwt';

export const authRoutes = new Elysia({ prefix: '/api/auth' })

  // 发送验证码
  .post('/send-code', async ({ body }) => {
    const { token: csrfToken, cookies } = await getCsrfToken();
    const result = await sendCode(body.identifier, csrfToken, cookies);
    return result;
  }, {
    body: t.Object({ identifier: t.String({ minLength: 1 }) }),
  })

  // 验证码登录
  .post('/verify-code', async ({ body, cookie }) => {
    const { token: csrfToken, cookies } = await getCsrfToken();
    const result = await verifyCode(body.identifier, body.code, csrfToken, cookies);

    if (result.success && result.token) {
      cookie['shenicest_token'].set({
        value: result.token as string,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return result;
  }, {
    body: t.Object({
      identifier: t.String({ minLength: 1 }),
      code: t.String({ minLength: 6, maxLength: 6 }),
    }),
  })

  // 获取当前用户
  .get('/me', async ({ cookie, set }) => {
    const token = cookie['shenicest_token'].value;
    if (!token) {
      set.status = 401;
      return { error: 'Not authenticated' };
    }

    try {
      const user = await verifyToken(token);
      return { user };
    } catch {
      set.status = 401;
      return { error: 'Invalid or expired token' };
    }
  })

  // 登出
  .post('/logout', ({ cookie }) => {
    cookie['shenicest_token'].remove({ path: '/' });
    return { success: true };
  });
```

### Step 6: 创建认证守卫中间件

创建文件 `src/middleware/auth-guard.ts`：

```typescript
import { Elysia } from 'elysia';
import { verifyToken, type SheNicestUser } from '../lib/jwt';

declare module 'elysia' {
  interface Context {
    user: SheNicestUser;
  }
}

export const authGuard = new Elysia().derive({ as: 'scoped' }, async ({ cookie, set }) => {
  const token = cookie['shenicest_token'].value;
  if (!token) {
    set.status = 401;
    throw new Error('Not authenticated');
  }

  try {
    const user = await verifyToken(token);
    return { user };
  } catch {
    set.status = 401;
    throw new Error('Invalid or expired token');
  }
});
```

### Step 7: 注册路由到 Elysia app

修改 `src/index.ts`（或你的 Elysia 入口文件）：

```typescript
import { Elysia } from 'elysia';
import { authRoutes } from './routes/auth';
// import { authGuard } from './middleware/auth-guard';

const app = new Elysia()
  .use(authRoutes)
  // 需要认证的路由组：
  // .group('/api/protected', (app) => app.use(authGuard).get('/me', ({ user }) => user))
  .listen(3000);

console.log(`Server running at http://localhost:3000`);
```

### Step 8: Next.js 登录页面

创建文件 `app/login/page.tsx`：

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!identifier.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || '发送失败');
        return;
      }
      setStep('code');
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || '验证失败');
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '100px auto', padding: 24 }}>
      <h1>登录</h1>

      {step === 'email' ? (
        <div>
          <input
            type="email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="输入邮箱"
            style={{ width: '100%', padding: 12, marginBottom: 12 }}
          />
          <button onClick={handleSend} disabled={loading} style={{ width: '100%', padding: 12 }}>
            {loading ? '发送中...' : '发送验证码'}
          </button>
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: 12 }}>验证码已发送至 {identifier}</p>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6 位验证码"
            maxLength={6}
            style={{ width: '100%', padding: 12, marginBottom: 12 }}
          />
          <button onClick={handleVerify} disabled={loading} style={{ width: '100%', padding: 12 }}>
            {loading ? '验证中...' : '登录'}
          </button>
          <button
            onClick={() => setStep('email')}
            disabled={loading}
            style={{ width: '100%', padding: 12, marginTop: 8, background: 'none' }}
          >
            更换邮箱
          </button>
        </div>
      )}

      {error && <p style={{ color: 'red', marginTop: 12 }}>{error}</p>}
    </div>
  );
}
```

### Step 9: Next.js 认证 Hook

创建文件 `hooks/useAuth.ts`：

```typescript
import { useEffect, useState } from 'react';

interface User {
  user_id: number;
  email: string | null;
  role: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  };

  return { user, loading, logout };
}
```

### Step 10: Next.js 路由守卫

创建文件 `middleware.ts`（项目根目录）：

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const token = request.cookies.get('shenicest_token');
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!token && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
```

---

## API 合约参考

### GET /api/auth/me

获取当前登录用户信息。

**Response 200:**
```json
{ "user": { "user_id": 123, "email": "user@example.com", "role": "user" } }
```

**Response 401:**
```json
{ "error": "Not authenticated" }
```

### POST /api/auth/send-code

发送验证码到邮箱。

**Request:**
```json
{ "identifier": "user@example.com" }
```

**Response 200:**
```json
{ "success": true, "channel": "email", "message": "Verification code sent to your email", "expires_in": 600 }
```

**Response 429 (限流):**
```json
{ "success": false, "error": "Too many requests. Please try again later.", "reset_at": "..." }
```

### POST /api/auth/verify-code

验证码登录。

**Request:**
```json
{ "identifier": "user@example.com", "code": "123456" }
```

**Response 200:**
```json
{
  "success": true,
  "message": "Login successful",
  "channel": "email",
  "token": "eyJhbGciOi...",
  "user": { "id": 123, "email": "user@example.com", "phone": null, "role": "user" }
}
```

**Response 400:**
```json
{ "success": false, "error": "Invalid verification code" }
```

### POST /api/auth/logout

登出（清除 cookie）。

**Response 200:**
```json
{ "success": true }
```

---

## 注意事项

1. **CSRF 机制**：平台所有写操作需要 CSRF token。后端每次请求前先调用 `getCsrfToken()` 获取 token 和 session cookie，然后在后续请求中带上。
2. **Cookie 传递**：`getCsrfToken()` 返回的 `cookies` 数组必须在 `sendCode()` / `verifyCode()` 请求中通过 `Cookie` 头传递，因为 CSRF token 绑定在 PHP session 上。
3. **限流**：发送验证码 3次/5分钟，验证 5次/5分钟。前端应处理 429 响应。
4. **Token 存储**：JWT 存在 httpOnly cookie 中，前端不直接访问 token，通过 `/api/auth/me` 获取用户信息。
5. **CORS**：生产环境需确保平台 `ALLOWED_ORIGINS` 包含你的域名。
6. **新用户自动注册**：平台 `verify-code.php` 会自动创建不存在的用户，无需额外处理。

## 验证清单

- [ ] `POST /api/auth/send-code` 返回 `{ success: true }`
- [ ] `POST /api/auth/verify-code` 返回 `{ success: true, token: "..." }` 且 cookie 已设置
- [ ] `GET /api/auth/me` 返回 `{ user: { user_id, email, role } }`
- [ ] `POST /api/auth/logout` 清除 cookie
- [ ] 未登录时访问受保护页面重定向到 `/login`
- [ ] 已登录时访问 `/login` 重定向到 `/dashboard`
