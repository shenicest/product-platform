# 鉴权体系（Authentication & Authorization）

本文梳理当前系统的认证与授权实现。术语遵循 [CONTEXT.md](../CONTEXT.md)（User、UserIdentity、Founder、Operator）。

## 总览

- **认证外置**：JWT 由外部认证系统（shenicest.com）签发，本 API **只验证、不签发、不管理凭据**。
- **授权内置**：平台侧通过 UserIdentity 角色（RBAC）+ 资源属主校验两层控制访问。

```
浏览器                  Next.js (web)                Elysia API                 外部认证系统
  │ OTP 登录             │ /api/auth/* 代理            │ /auth/send-code          │ csrf-token.php
  │─────────────────────►│───────────────────────────►│─────────────────────────►│ send-code.php
  │                      │                            │ /auth/verify-code        │ verify-code.php
  │                      │                            │                          │ ← 签发 JWT
  │ ◄── Set-Cookie: shenicest_token (httpOnly) ───────│                          │
  │ 后续请求自动携带 Cookie（经 /api/* rewrite 转发到 API）                          │
```

## 1. 认证（你是谁）

### JWT

- 签发方：外部认证系统；算法 HS256，密钥为环境变量 `SHENICEST_JWT_SECRET`（缺失时进程启动即抛错）。
- 固定校验 `issuer` 与 `audience`，均为 `shenicest.com`。
- payload：`{ user_id: number, email: string | null, role: string }`。
- 验证入口：`apps/api/src/lib/jwt.ts` 的 `verifyToken()`（基于 `jose` 的 `jwtVerify`）。

### Token 传递通道

`auth` / `optionalAuth` macro 按以下优先级取 token（`apps/api/src/plugins/auth.ts`）：

1. `Authorization: Bearer <token>` 请求头
2. httpOnly Cookie `shenicest_token`（`maxAge` 30 天，`sameSite=lax`，生产环境 `secure`）

### 登录流程（邮箱 OTP）

认证模块 `apps/api/src/modules/auth/index.ts` 充当外部认证系统的**代理**（`apps/api/src/lib/shenicest-client.ts`）：

| 端点 | 说明 |
|------|------|
| `POST /auth/send-code` | 先向外部取 CSRF token + session cookie，再调 `send-code.php` 发送验证码 |
| `POST /auth/verify-code` | 校验验证码；成功时由 API `Set-Cookie: shenicest_token` 写入 JWT（响应 body 不含 token 明文） |
| `POST /auth/logout` | 删除 Cookie |
| `GET /me` | Cookie 通道，返回完整用户信息 `{ user_id, email, role }` |
| `GET /me/bearer` | Bearer 通道，返回 `{ userId }`（用于脚本/第三方调用） |

注意：`shenicest-client` 中还有 `refreshToken()` 封装，目前无路由使用（见 [7.B3](#b3-无会话续期)）。

## 2. 后端授权机制

### Macro 体系（声明在路由选项上）

| Macro | 定义位置 | 行为 |
|-------|----------|------|
| `auth: true` | `plugins/auth.ts` | 必须登录；失败返回 **401 UNAUTHORIZED**；成功向 context 注入 `user: { userId }` |
| `optionalAuth: true` | `plugins/auth.ts` | 尝试解析；缺失或非法时 `user = null`，**不报错** |
| `operatorOnly: true` | `plugins/role-guard.ts` | 依赖 `auth`；查 `user_identities` 是否持有 `Role.Operator`，否则 **403 FORBIDDEN** |
| `founderOnly: true` | `plugins/role-guard.ts` | 依赖 `auth`；同上检查 `Role.Founder` |

- 角色 macro 声明了依赖（`auth: true`），使用方无需重复写 `auth: true`。
- 每个模块通过 `.use(authPlugin)` / `.use(roleGuardPlugin)` 显式引入。

### 资源级授权（属主校验）

角色之外的第二道防线，在路由 handler 内显式比对：

- **属主校验**：如 `PUT /projects/:id/draft`、`PUT /projects/:id/submit` 中 `owned.userId !== user.userId` → 403。提案模块同理（仅提案发起者可编辑）。
- **可见性规则**：`ProjectService.getVisibleProject()` — Live（status=3）项目公开；非 Live 项目仅属主或 Operator 可见，其余返回 **404 而非 403**（不暴露资源存在性，防枚举探测）。
- **上传隔离**：`UploadService` 的 COS 对象 key 强制带上 `<userId>/` 命名空间，调用者只能写自己的目录。

### 路由鉴权矩阵

| 端点 | 鉴权 |
|------|------|
| `GET /projects` | 公开（仅 Live） |
| `GET /projects/:id` | `optionalAuth`（可见性规则兜底） |
| `POST /projects` | `auth`（成功后授予 Founder 角色） |
| `PUT /projects/:id/draft`、`PUT /projects/:id/submit` | `auth` + 属主校验 |
| `POST /proposals` 等提案端点（4 个） | `auth`（+ 属主校验） |
| `POST /upload/presign` | `auth` |
| `GET /identity/roles` | `auth` |
| `GET /identity/users/:userId/roles` | `operatorOnly` |
| `/founder/*`（4 个端点） | `founderOnly` |
| `/operator/*`（13 个端点） | `operatorOnly` |

## 3. 角色模型（UserIdentity）

- 表 `user_identities`：`(user_id, role)` 唯一索引，`role` 为 tinyint。
- 取值定义在 `@shenicest/shared`：`Role.Founder = 0`、`Role.Operator = 1`；一个 User 可同时持有多个角色。
- **授予路径**：
  - Founder：首次 `POST /projects` 时由 `ProjectService.createProject()` 幂等授予（`grantRole` 为 upsert）。
  - Operator：seed 或带外分配，无自助通道。
- 运行时只有 `hasRole` / `getRoles` 读路径；JWT payload 里的 `role` 字段（外部系统的角色）**不参与**平台授权决策。

## 4. 前端

### BFF 代理与 Cookie 流转

- `next.config.ts` 的 rewrite 把 `/api/*` 代理到 `${API_URL}/*`，浏览器始终同源访问，Cookie 无跨域问题。
- `app/api/auth/{send-code,verify-code,logout}/route.ts`：纯透传代理（`Set-Cookie` 随之落到 web 源）。
- `app/api/me/route.ts`：**聚合端点**，先调 API `GET /me`，再带 Cookie 调 `GET /identity/roles`，合并为 `{ user: { ..., roles: number[] } }` 返回——这是客户端获取"用户 + 平台角色"的唯一入口（优化方向见 [7.C2](#c2-apime-聚合是两次串行上游调用)）。

### 客户端会话

- `AuthProvider`（Client Component）挂载时调 `fetchCurrentUser()`（即 `/api/me`），通过 `useAuth()` 暴露 `{ user, loading, isAuthenticated, refresh, logout }`。
- 客户端业务请求统一走 `lib/client-api.ts`：`fetch('/api/...', { credentials: 'same-origin' })`，不直接触碰 token。

### 页面守卫（三层）

1. **`middleware.ts`**：仅做一件事——持有**未过期** token（解码 payload 的 `exp` 判断，不验签）的用户访问 `/login` 时重定向到 `/`；token 过期或无法解析时放行登录页。**它不保护其他页面**。
2. **Server Component 守卫**：
   - `app/operator/layout.tsx`：`getSessionUser()`（`src/server/auth.ts`）返回 null → `/login`；无 `Role.Operator` → `/`。
   - `app/founder/dashboard`、`app/submit/page.tsx`：无 Cookie → `/login`（角色交由 API 的 `founderOnly` 兜底，前端不重复校验；dashboard 对 403 渲染提交引导空态——这是获得 Founder 角色的入口，见 [7.C5](#c5-前端守卫策略决策记录)）。
3. **API 兜底**：所有越权请求最终都被后端 macro / 属主校验拦截，前端守卫只是体验层。

### Server 端数据获取

`src/server/*` 中的函数（`cache()` 包装）用 eden treaty 调 API，从 `cookies()` 取出 `shenicest_token` 后**手动透传** `cookie` 请求头（Server 端没有浏览器 Cookie 自动携带）。其中 `src/server/auth.ts` 的 `getSessionUser()` 是 Server 端获取"当前会话用户 + 平台角色"的统一入口。

## 5. 错误语义

| 状态码 | code | 触发场景 |
|--------|------|----------|
| 401 | `UNAUTHORIZED` | 未登录 / token 缺失、非法、过期 |
| 403 | `FORBIDDEN` | 已登录但角色不足（macro）或不是资源属主（handler 校验） |
| 404 | `PROJECT_NOT_FOUND` 等 | 资源不存在，**或**非 Live 资源对无权限者不可见（防探测） |

## 6. 相关环境变量

| 变量 | 侧 | 用途 |
|------|----|------|
| `SHENICEST_JWT_SECRET` | API | 验证外部 JWT 的 HS256 密钥 |
| `SHENICEST_API_BASE` | API | 外部认证系统地址（OTP 代理目标） |
| `API_URL` | Web | 后端地址（eden treaty、`/api/*` rewrite、`/api/me` 聚合） |

## 7. 已知优化项

A 类正确性 bug（登录死锁、optionalAuth 回退、operator 守卫、verify-code token 泄露、/me 错误结构）修复后，剩余的已知薄弱点与优化方向，供后续迭代排期。

### B. 安全加固

#### B1 OTP 端点零限流

- 现状：`POST /auth/send-code`、`POST /auth/verify-code` 无任何频率限制；登录页 60s 重发冷却只是前端逻辑，直接调 API 即可绕过。
- 风险：验证码邮件轰炸；6 位验证码可暴力枚举（尝试次数不受限）。
- 方向：按 identifier + IP 限流（发送频率、验证尝试次数、失败锁定）；先确认外部认证系统侧是否已有限流，平台侧再补一层纵深防御。
- 位置：`apps/api/src/modules/auth/index.ts`

#### B2 JWT claims 无运行时校验

- 现状：`verifyToken()` 对 `payload.user_id as number` 等直接强转；外部系统 payload 结构变化时会静默产生 `"undefined"` 的 userId。
- 方向：对 claims 做运行时校验（user_id 必须为 number 等），校验失败返回 401。
- 位置：`apps/api/src/lib/jwt.ts`

#### B3 无会话续期

- 现状：cookie `maxAge` 30 天，外部 JWT 的 `exp` 由签发方控制，两者可能不一致；JWT 过期后用户断崖式掉线（所有请求 401）而 cookie 仍在。`refreshToken()` 已封装但无路由使用。
- 方向：接续期流程（近过期时静默 refresh）；或至少让 cookie maxAge 与 JWT exp 对齐，并配合 C4 的 401 统一处理。
- 位置：`apps/api/src/lib/shenicest-client.ts`、`apps/api/src/modules/auth/index.ts`

#### B4 CORS origin 过宽

- 现状：CORS 允许 `/\.vercel\.app$/` 正则 + `credentials: true`，任意 Vercel 子域都在白名单内。
- 说明：当前实际风险有限（cookie 设在 web 源且为 host-only，跨站请求不会携带），但白名单应精确。
- 方向：收敛为实际生产/预览域名列表。
- 位置：`apps/api/src/index.ts`

### C. 性能 / 结构

#### C1 角色检查每请求一次 DB 查询

- 现状：`operatorOnly` / `founderOnly` 每次请求执行一次 `hasRole` 查询；运营后台每个请求多一次 DB 往返。
- 方向：角色极少变更（Founder 首次提交项目时授予、Operator 带外分配），适合短 TTL 内存缓存 + `grantRole` 时主动失效。
- 位置：`apps/api/src/plugins/role-guard.ts`、`apps/api/src/modules/user-identity/service.ts`

#### C2 `/api/me` 聚合是两次串行上游调用

- 现状：web 的 `app/api/me/route.ts` 先调 API `GET /me`，再调 `GET /identity/roles`，合并返回。
- 方向：API 的 `GET /me` 直接 JOIN `user_identities` 返回 roles，删除前端聚合层；`AuthProvider` 与 `getSessionUser()` 均可减少一跳。
- 位置：`apps/api/src/modules/auth/index.ts`、`apps/web/src/app/api/me/route.ts`

#### C3 AuthUser context 信息过薄（部分完成）

- 已完成：token 提取逻辑统一为 `resolveUser()`，`auth` / `optionalAuth` 的 Bearer→cookie 回退行为一致（`plugins/auth.ts`）。
- 剩余：macro 只注入 `userId`，需要 email 的 handler 需重新解析 token。方向：一并注入 `email`。

#### C4 前端 401 无统一处理

- 现状：
  - 客户端：`lib/client-api.ts` 只返回 error，token 过期后各组件各自报错，无全局跳登录/刷新机制。
  - Server 端：`/founder/dashboard` 捕获 `getFounderStats()` 的 401 时 rethrow → 错误页，而非重定向登录页。
- 方向：client-api 对 401 统一触发登出/跳转；server 守卫的 catch 增加 401 → `redirect('/login')`。
- 位置：`apps/web/src/lib/client-api.ts`、`apps/web/src/app/founder/dashboard/page.tsx`

#### C5 前端守卫策略（决策记录）

- 已完成：`app/operator/layout.tsx` 改用 `src/server/auth.ts` 的 `getSessionUser()`（eden treaty + cookie 透传）。
- 决策：founder / submit 页面保持轻量"cookie 存在性"检查，**不**引入前端角色预检——dashboard 的 403 空态 CTA 是获得 Founder 角色的入口（角色在首次 `POST /projects` 时授予），安全边界交由 API 的 `founderOnly` 兜底。Operator 则必须在页面层硬拦截（无"候选运营"UX，且角色带外授予）。

### D. 测试

#### D1 鉴权链路覆盖（部分完成）

- 已完成：cookie 通道、Bearer→cookie 回退、`/me` 错误结构、verify-code token 剥离（`test/plugins/auth.test.ts`、`test/modules/auth.test.ts`）。
- `operatorOnly` / `founderOnly` 经模块路由测试间接覆盖（user-identity、founder 模块的 403 用例），无独立 plugin 级单测。
- 缺口：`/auth/send-code`、`/auth/logout` 的分支测试；web 侧无测试基建，middleware 的 exp 判断与 `getSessionUser()` 无自动化验证。
