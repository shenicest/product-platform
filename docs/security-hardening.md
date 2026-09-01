# 安全加固待办

本文是产品平台上线前及上线后的安全加固清单。目标是建立纵深防御：由 CDN/WAF/Nginx 承担流量和连接层防护，由 API 承担认证、授权和业务级限流，由数据库、对象存储和运维系统承担数据保护、审计及恢复能力。

本文记录的是工程待办，不替代正式的渗透测试、云厂商安全配置检查或法律/合规评估。

## 当前结论

项目已有以下基础能力：

- JWT 使用 `jose` 校验签名、issuer 和 audience。
- 登录 Cookie 使用 `HttpOnly`、生产环境 `Secure`、`SameSite=Lax`。
- API 已有角色授权和资源属主校验。
- Drizzle 查询通常使用参数化查询。
- 上传密钥只在服务端使用，并按用户生成对象 key。
- Operator 的项目和 Proposal 状态变更已有审计记录。

当前最需要优先处理的风险：

- API 没有统一限流；OTP 发送和验证尤其容易被滥用。
- CORS 允许任意 `*.vercel.app`，且启用 `credentials`。
- 上传大小和文件类型主要依赖前端校验，服务端没有完整内容校验。
- Next.js 和反向代理没有统一的 CSP、HSTS 等安全响应头。
- 缺少统一错误边界、结构化安全日志、数据库备份和恢复演练的明确基线。

## 优先级定义

- **P0：上线前完成**。不完成则不应把对应功能暴露给公网。
- **P1：上线后立即排期**。影响攻击面、检测能力或权限边界。
- **P2：持续治理**。用于降低长期运营、供应链和灾难恢复风险。

## P0 待办

### P0-1：建立 API 限流

**状态：已实现登录接口首批限流（send-code、verify-code）；其他接口和过期清理仍待实现。**

第一阶段使用 MySQL 聚合计数表实现应用层业务限流，不直接按请求日志做 `COUNT(*)`。限流服务必须使用原子 upsert，避免并发请求在“先查询、后更新”之间绕过限制。

建议新增表：

```text
rate_limit_counters
- scope                 限流规则名称
- key_hash              identifier/IP/userId 的 HMAC，不保存原始敏感值
- window_started_at     固定窗口起始时间
- count                 当前窗口计数
- expires_at            过期时间
```

约束和实现要求：

- 唯一键为 `(scope, key_hash, window_started_at)`。
- 使用 `INSERT ... ON DUPLICATE KEY UPDATE count = count + 1` 原子增加计数。
- 达到限制时返回 `429 Too Many Requests` 和 `Retry-After`。
- 限流 key 使用服务端密钥 HMAC；不要把邮箱、手机号、OTP 或 JWT 原文写入限流表。
- 对 `expires_at` 建索引，并通过定时任务清理过期窗口。
- 必须限制 identifier 长度和格式，避免攻击者通过大量随机 key 使表膨胀。
- 限流数据库故障时，OTP 和 presign 接口采用 fail closed；普通互动接口可按可用性要求单独决定。
- 数据库限流不能替代 WAF/Nginx 限流。API 不应允许攻击者绕过受控反向代理直接访问公网端口。
- 第一阶段采用固定窗口；OTP 同时设置短窗口和长窗口，降低窗口边界突发。

首批规则建议如下，实际阈值上线后根据日志调整：

| 端点/动作 | 限流维度 | 初始限制 | 超限行为 |
|---|---|---:|---|
| `POST /auth/send-code` | identifier | 1 次/分钟，5 次/小时，20 次/天 | `429` |
| `POST /auth/send-code` | IP | 10 次/分钟，30 次/小时 | `429` |
| `POST /auth/verify-code` | identifier + IP | 5 次/10 分钟 | 失败锁定 15 分钟 |
| `POST /upload/presign` | userId + IP | 20 次/10 分钟 | `429` |
| 创建项目/Proposal | userId | 10 次/小时 | `429` |
| Like/Follow | userId + IP | 60 次/分钟 | `429` |
| Talent connection | userId | 使用现有每日业务上限，并增加短窗口 | `429` |

OTP 特殊流程：

1. `send-code` 在调用外部认证系统之前占用发送额度。
2. `verify-code` 先检查是否处于锁定状态，再占用失败尝试额度。
3. 验证成功后清除该 identifier 的失败计数。
4. 连续失败达到阈值后锁定一段时间。
5. 不能只按 IP 限制，也不能只按 identifier 限制，必须同时具备两种维度。

验收标准：

- 并发请求不能使计数超过规则允许范围。
- 未登录请求无法消耗以 userId 为 key 的额度。
- 更换邮箱不能绕过 IP 级上限，更换 IP 不能绕过 identifier 级上限。
- 过期计数可被清理，表不会无限增长。
- 返回 429 时不会泄露内部 key、数据库错误或限流实现细节。
- 测试覆盖正常、边界、并发、过期、数据库异常和锁定解除场景。

相关位置：`apps/api/src/app.ts`、`apps/api/src/modules/auth/index.ts`、`apps/api/src/modules/upload/`、`apps/api/src/db/schema/`。

### P0-2：收紧 CORS

**状态：待实现。**

- 删除任意 `*.vercel.app` 的宽泛正则。
- 生产和 Preview 使用环境变量配置的精确 origin allowlist。
- 生产只允许 HTTPS 来源。
- 仅对确实需要 Cookie 的来源启用 credentials。
- 验证未知 Preview 域名、恶意 Origin、`Origin: null` 和 HTTP 生产来源。

相关位置：`apps/api/src/app.ts`。

### P0-3：增加安全响应头

**状态：待实现。**

至少配置：

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`
- `frame-ancestors` 或 `X-Frame-Options`

CSP 必须根据实际 COS、API、字体、图片和 Demo iframe 域名配置，禁止用 `default-src *` 作为默认方案。Next.js 和 Nginx 的响应头需要在生产环境通过 `curl -I` 实际确认，避免代理覆盖应用设置。

相关位置：`apps/web/next.config.ts`、`apps/web/src/app/layout.tsx`、`docs/deploy-backend.md`。

### P0-4：将上传校验移到服务端

**状态：待实现。**

- 服务端 MIME 和扩展名白名单。
- 检查实际对象大小和 magic bytes。
- 图片服务端重编码；视频执行格式验证。
- 每用户和全局存储配额。
- 删除未完成或未被业务实体引用的对象。
- 评估病毒/恶意内容扫描。
- 缩短 presigned URL 有效期，并限制 COS CORS 的来源和方法。
- 确保任意上传对象不会以可执行 HTML/JavaScript 类型公开返回。

前端校验只能改善用户体验，不能作为安全控制。当前上传使用 `public-read` 时，应额外评估恶意内容托管和存储滥用风险。

相关位置：`apps/api/src/modules/upload/service.ts`、`apps/api/src/modules/upload/model.ts`、`apps/web/src/lib/upload.ts`。

### P0-5：增加统一错误边界

**状态：待实现。**

- 未知异常统一返回安全的 `INTERNAL_ERROR`。
- 生产环境不返回 stack trace、SQL、数据库连接信息或 COS 原始错误。
- 为请求生成并返回 `requestId`。
- 统一处理 400、401、403、404、409、422、429、500。
- 详细异常只写入内部日志，并对敏感字段脱敏。

相关位置：`apps/api/src/app.ts`、`apps/api/src/common/errors.ts`。

## P1 待办

### P1-1：明确 Cookie 和 CSRF 策略

**状态：待评估。**

- 如果不要求主站 SSO，使用 host-only Cookie，不设置 `.shenicest.com`。
- 如果必须共享父域 Cookie，建立可信子域清单并持续监控子域接管。
- Cookie-authenticated mutation 增加 Origin/Referer 校验或 CSRF Token。
- 明确 Bearer 和 Cookie 同时存在时的优先级；不要让无效 Bearer 被静默忽略造成认证语义混淆。

相关位置：`apps/api/src/modules/auth/index.ts`、`apps/api/src/plugins/auth.ts`、`docs/auth.md`。

### P1-2：强化 JWT claims 校验

**状态：待实现。**

- 显式限制算法为 `HS256`。
- `user_id` 必须通过运行时类型和范围校验。
- `exp` 必须存在且有效；按需要校验 `iat`、`nbf` 和最大 token 寿命。
- 校验 `email`、`role` 的运行时类型。
- 异常 payload 统一作为 401 处理。

相关位置：`apps/api/src/lib/jwt.ts`。

### P1-3：建立外部 URL 和 iframe 策略

**状态：待实现。**

- 按图片、视频、Demo、GitHub 链接分别校验。
- 生产环境优先只允许 `https:`。
- 禁止 `javascript:`、`data:`、`file:` 等非必要协议。
- iframe 使用 host allowlist，并配合 CSP `frame-src`。
- API 不主动请求用户提交的 URL，避免 SSRF。

相关位置：`apps/api/src/db/schema/project.ts`、`apps/api/src/modules/project/model.ts`、`apps/web/src/components/project-detail.tsx`。

### P1-4：补齐结构化日志和安全审计

**状态：待实现。**

至少记录 request ID、路由、方法、状态码、耗时、用户 ID、可信来源 IP、user-agent、认证失败、授权失败、429、OTP 结果、presign 和 Operator 操作。

严禁记录 JWT、Cookie、Authorization、OTP、COS Secret、数据库密码和联系人明文/密文。应为以下事件配置告警：OTP 异常增长、连续验证码失败、大量 401/403、上传存储异常增长、5xx 突增、数据库连接池耗尽、Operator 权限变化。

## P2 待办

### P2-1：数据库和备份治理

**状态：待落实运维配置。**

- 运行时账号与 migration 账号分离。
- 运行时账号禁止 `DROP`、`ALTER`、`CREATE` 等高危权限。
- shared users 表使用只读或最小权限账号。
- 数据库连接启用 TLS，设置连接池上限、连接和查询超时。
- 每日自动备份，配置 binlog/PITR。
- 备份加密、异地保存、独立权限和保留周期。
- 定期恢复演练，并记录 RPO/RTO。

### P2-2：Nginx/CDN/WAF 基线

**状态：待落实运维配置。**

- API 只通过受控反向代理或 WAF 对公网提供服务。
- 在边缘层对 IP、连接数和慢请求限流。
- `/auth/*`、`/upload/presign` 使用独立规则。
- 配置 TLS 基线、HSTS、`server_tokens off` 和日志脱敏。
- 普通 API 使用合理的 body、读取和发送超时。
- `/health` 只返回固定健康状态，不暴露环境信息。
- 严格定义可信代理和 `X-Forwarded-*` 边界。

相关位置：`docs/deploy-backend.md`、`apps/api/src/app.ts`。

### P2-3：CI/CD 安全检查

**状态：待实现。**

- 依赖漏洞扫描。
- Secret scanning 和 push protection。
- CodeQL 或其他 SAST。
- Dependabot/Renovate。
- API 生产构建验证和 migration 检查。
- 部署前环境变量检查。
- 确认历史 Git 提交没有泄露密钥；已泄露的密钥必须轮换。

相关位置：`.github/workflows/ci.yml`。

## 上线前检查

- [ ] P0-1 限流已实现并通过并发测试。
- [ ] P0-2 CORS 只允许明确生产/Preview 域名。
- [ ] P0-3 安全响应头已在真实 HTTPS 域名验证。
- [ ] P0-4 上传服务端校验、配额和清理策略已生效。
- [ ] P0-5 未知异常不会向客户端泄露内部细节。
- [ ] 生产 API 端口不能绕过 WAF/Nginx 直接访问。
- [ ] 数据库自动备份已配置，并完成至少一次恢复演练。
- [ ] JWT、COS、数据库和外部认证密钥已存放在受控密钥管理系统。
- [ ] 关键安全事件日志和告警已验证。
- [ ] 已进行至少一次 OWASP 基础测试或外部渗透测试。

## 攻击响应预案

发生攻击时，值班人员应能够：

1. 按 IP、用户和 token 吊销/封禁攻击来源。
2. 临时关闭 OTP、上传或其他高风险写接口。
3. 轮换 JWT、COS、数据库和外部认证密钥。
4. 检查异常访问范围、对象存储和数据库是否有泄露或篡改。
5. 从备份恢复，并验证恢复数据完整性。
6. 保留日志、请求 ID 和相关证据。
7. 根据影响范围通知项目负责人、用户及必要的合规/安全联系人。

## 相关文档

- `docs/auth.md`：认证、授权和 SSO 约定。
- `docs/deploy-backend.md`：后端、Nginx 和生产部署说明。
- `CONTEXT.md`：领域模型和敏感业务数据语义。
