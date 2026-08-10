# 主站 SSO 接入指引（给 AI/开发者的提示词）

> 面向对象：负责 `shenicest.com/platform`（主站，PHP）的开发者或 AI 编码助手。
> 目标：让主站与产品发现平台（`xxx.shenicest.com`）共享登录态。
> 产品平台侧已完成：登录/登出/会话升级的 cookie 都已按 `Domain=.shenicest.com` 写入；本仓库无需再改。

## 背景

产品发现平台部署在 `xxx.shenicest.com`（Bun/Elysia + Next.js），它的登录流程本来就走「主站签发的 JWT」——主站的 `verify-code.php` 返回一个 HS256 JWT，产品平台把这个 JWT 存到 httpOnly cookie `shenicest_token` 里。

现在要让**这张 cookie 在主站和子站之间共享**，从而实现 SSO：

- 用户在产品平台登录后，跳到 `shenicest.com/platform` 不用重新登录
- 用户在主站登录后，跳到 `xxx.shenicest.com` 也不用重新登录
- 任一侧登出，两侧都失效

产品平台已经完成的改动：

- 登录时的 `Set-Cookie` 带上 `Domain=.shenicest.com`
- 登出时清除同名同域 cookie
- 提供了一个 `GET /api/auth/sso-redirect` 端点：把老会话的 host-only cookie 升级成域级 cookie，然后 302 到 `https://shenicest.com/platform/projects`（主站黑客松专区）

**你要做的**：在主站 PHP 代码里读并写这张共享 cookie。

## 契约（不能改）

### Cookie

| 属性     | 值                                                  |
| -------- | --------------------------------------------------- |
| 名称     | `shenicest_token`                                   |
| Domain   | `.shenicest.com`（生产必须，本地开发可省）          |
| Path     | `/`                                                 |
| HttpOnly | `true`                                              |
| Secure   | `true`（生产 HTTPS 必须）                           |
| SameSite | `Lax`                                               |
| Max-Age  | `2592000`（30 天）                                  |

### JWT

- 算法：`HS256`
- 密钥：环境变量 `SHENICEST_JWT_SECRET`（与产品平台使用同一个值，必须保持一致）
- Issuer (`iss`)：`shenicest.com`
- Audience (`aud`)：`shenicest.com`
- Payload 至少包含：
  ```json
  { "user_id": 42, "email": "user@example.com", "role": "user", "iat": 1700000000, "exp": 1700000000 }
  ```
- 验签必须校验 `iss`、`aud`、`exp`；`role` 缺省视为 `"user"`

## 具体实现要求

### 1. 依赖

用 `firebase/php-jwt`（Composer 包）做 JWT 验签：

```bash
composer require firebase/php-jwt
```

### 2. 引导逻辑（SSO 读入口）

在所有页面/接口的会话引导处（比如统一的 `session_start()` 之后、或 auth middleware 里）加：

```php
// 伪代码，实际路径按你现有的结构放
function tryLoginFromSharedCookie(): void {
    // 已有主站登录态就跳过
    if (!empty($_SESSION['user_id'])) return;

    $token = $_COOKIE['shenicest_token'] ?? null;
    if (!$token) return;

    try {
        $decoded = \Firebase\JWT\JWT::decode(
            $token,
            new \Firebase\JWT\Key(getenv('SHENICEST_JWT_SECRET'), 'HS256')
        );
        // 必须校验 iss / aud
        if (($decoded->iss ?? '') !== 'shenicest.com') return;
        if (($decoded->aud ?? '') !== 'shenicest.com') return;

        $userId = (int)($decoded->user_id ?? 0);
        if ($userId <= 0) return;

        // 用同一张 users 表建立主站会话（不要重新签发密码、不要走短信/邮件）
        $_SESSION['user_id'] = $userId;
        $_SESSION['email']   = $decoded->email ?? null;
        $_SESSION['role']    = $decoded->role  ?? 'user';
    } catch (\Throwable $e) {
        // 过期/伪造/格式错误：静默忽略，让用户走正常登录流程
        // 不要在此处清 cookie（可能是并发窗口、时钟漂移，交给下面「清理策略」）
    }
}
```

**放置位置**：主站入口引导（`bootstrap.php` 或框架的 auth middleware），在 `session_start()` 之后、路由分发之前调用一次。

### 3. 主站自身登录成功时

除了原有的 `session` 设置外，**必须再写一份共享 cookie**，让子站能读到：

```php
function issueSharedTokenCookie(int $userId, ?string $email, string $role): void {
    $now = time();
    $payload = [
        'iss'     => 'shenicest.com',
        'aud'     => 'shenicest.com',
        'iat'     => $now,
        'exp'     => $now + 30 * 24 * 3600,
        'user_id' => $userId,
        'email'   => $email,
        'role'    => $role,
    ];
    $jwt = \Firebase\JWT\JWT::encode($payload, getenv('SHENICEST_JWT_SECRET'), 'HS256');

    setcookie('shenicest_token', $jwt, [
        'expires'  => $now + 30 * 24 * 3600,
        'path'     => '/',
        'domain'   => '.shenicest.com',   // 关键：父域共享
        'secure'   => true,               // 生产必须 HTTPS
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
```

**必须与产品平台的 `verify-code.php` 返回的 JWT 结构一致**（`iss`/`aud`/`user_id`/`email`/`role`/`iat`/`exp`），否则子站会验签失败。

### 4. 主站登出时

必须清除域级 cookie（不清的话子站还会认为已登录）：

```php
function clearSharedTokenCookie(): void {
    // 参数（path、domain）必须与写入时完全一致，否则删不掉
    setcookie('shenicest_token', '', [
        'expires'  => 1,
        'path'     => '/',
        'domain'   => '.shenicest.com',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    // 顺手把可能残留的 host-only 版本也清掉（历史遗留）
    setcookie('shenicest_token', '', [
        'expires'  => 1,
        'path'     => '/',
        'secure'   => true,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}
```

在原有的 `session_destroy()` 附近调用一次。

### 5. `verify-code.php`（子站也走它签发 JWT）

如果 `verify-code.php` 目前**只把 JWT 放在响应体里返回**给子站、并没有 `Set-Cookie`，保持现状即可（子站自己会设 cookie）。
但如果它同时也 `setcookie('shenicest_token', ...)` 给主站自己用，务必把 `domain` 改成 `.shenicest.com`，其余属性对齐上面的表格。

## 边界情况和错误处理

| 情况                              | 行为                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- |
| cookie 不存在                     | 不做任何事，走正常未登录流程                                            |
| JWT 过期 (`exp` 已到)             | 静默忽略，不要在读取处清 cookie（并发登录窗口易误伤）；下次真登录会覆盖 |
| JWT 签名错误 / 格式错误           | 静默忽略                                                                |
| `iss` 或 `aud` 不匹配             | 静默忽略（防止其他系统的 JWT 混入）                                     |
| `user_id` 缺失或 `<= 0`           | 静默忽略                                                                |
| 数据库里 `user_id` 已被封禁/删除  | 拒绝建立会话；并调用 `clearSharedTokenCookie()` 兜底                    |
| 时钟漂移                          | 允许 `firebase/php-jwt` 的 `JWT::$leeway = 60`（60 秒）                 |

## 安全要求

- `SHENICEST_JWT_SECRET` 必须与产品平台完全一致，且**只从环境变量读**，不要写到代码或配置文件里
- 生产必须 HTTPS，`Secure` 属性不能省
- `HttpOnly` 不能省，避免被前端 JS 读到
- `SameSite=Lax`（不要用 `None`，两边同注册域是同站点，Lax 就够）
- 不要把 JWT 打到日志里
- 不要基于 JWT 里的 `role` 做权限判断——`role` 只是给 UI 的提示，权限查询必须回数据库以 `user_id` 为准

## 验收清单

- [ ] 用户在 `xxx.shenicest.com` 登录后打开 `shenicest.com/platform`：直接是登录态，`$_SESSION['user_id']` 有值
- [ ] 用户在 `shenicest.com/platform` 登录后打开 `xxx.shenicest.com`：直接是登录态
- [ ] 在 `shenicest.com/platform` 登出：刷新 `xxx.shenicest.com` 也变未登录
- [ ] 在 `xxx.shenicest.com` 登出：刷新 `shenicest.com/platform` 也变未登录
- [ ] 手动伪造 `shenicest_token` cookie（改一个字符）：主站视为未登录
- [ ] `exp` 过期的 token：主站视为未登录，且不会 500
- [ ] 无 cookie 场景：主站行为完全和改动前一致（不能因为读了不存在的 cookie 报 notice/warning）

## 需要向环境和运维确认的事

1. `SHENICEST_JWT_SECRET` 已经与产品平台一致
2. 生产已经启用 HTTPS
3. 主站入口能取到 `$_COOKIE['shenicest_token']`（没有被反向代理/CDN 剥掉）

---

## 请你现在做

1. 找到主站的会话引导代码（`session_start()` 附近）和登录/登出处
2. 按上面的 4 段代码接入
3. 装 `firebase/php-jwt` 依赖
4. 跑一遍验收清单，把结果贴出来
5. 遇到主站现有代码结构与上面伪代码冲突的地方，先说明再动手，不要自作主张改架构
