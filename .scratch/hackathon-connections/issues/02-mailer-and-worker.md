# 02 — Mailer（腾讯云 SES）+ 邮件模板 + 投递 worker

**What to build:** 平台邮件基础设施。`Mailer` 接口 + 腾讯云 SES 适配器 + 建联通知模板（HTML/纯文本、转义）+ 进程内投递 worker（轮询、认领、退避重试、幂等）。

**Blocked by:** 01（需要 `connection_notification_deliveries` 表）

**Status:** todo

- [ ] 安装 `tencentcloud-sdk-nodejs-ses`（模块化包，不装整包）
- [ ] `apps/api/src/lib/mail/mailer.ts`：`Mailer` 接口 `send({ to, subject, html, text, idempotencyKey }): Promise<{ providerMessageId?: string }>` + 内存实现（测试用，记录调用）
- [ ] `apps/api/src/lib/mail/ses-mailer.ts`：腾讯云 SES 适配；凭据/Region/发信地址从环境变量读取，缺失时构造处 throw（禁止裸 `process.env.X!`）
- [ ] `apps/api/src/lib/mail/templates/hackathon-connection-created.ts`：输入 `{ projectName, projectUrl, senderNickname, purpose, message, createdAt, connectionsUrl }`；用户输入全部 HTML 转义；同时产出 text 版本；邮件中**不含申请方任何联系方式**
- [ ] `apps/api/src/worker/mail-worker.ts`：轮询 `connection_notification_deliveries`
  - 认领：条件 UPDATE `Pending → Sending`（或 `Sending` 且 `last_attempt_at` 早于 10 分钟），`affectedRows = 1` 才发送
  - 发送成功：`Sent` + `provider_message_id`（SES `MessageId`）
  - 失败：`attempt_count < 3` 时按 1min/5min/30min 退避保持 `Pending`；第 3 次失败置 `Failed` + `last_error_code`
- [ ] `apps/api/src/index.ts` 按 `NOTIFICATION_WORKER`（默认生产 on / 测试 off）启动 worker，`NOTIFICATION_POLL_INTERVAL_MS` 默认 30000
- [ ] `.env.example` 追加：`TENCENTCLOUD_SECRET_ID`、`TENCENTCLOUD_SECRET_KEY`、`TENCENTCLOUD_SES_REGION`、`SES_FROM_EMAIL_ADDRESS`、`SES_REPLY_TO_ADDRESS`、`NOTIFICATION_WORKER`、`NOTIFICATION_POLL_INTERVAL_MS`（只追加行）
- [ ] 测试（`bun test`，用内存 Mailer）：
  - 模板：主题/正文含项目名与消息；消息含 `<script>` 等内容被转义；正文不含微信/邮箱明文
  - worker：Pending 被认领且只发一次；失败退避后重试；三次失败置 Failed；`Sending` 僵死行可回收；同幂等键不重复发
  - 环境变量缺失时 ses-mailer 构造报错

**Implementation notes:**
- worker 与 API 同进程（评审文档 D6）；认领门闩使多实例部署天然安全
- 通知类型常量 `NOTIFICATION_TYPES.CONNECTION_CREATED = 'hackathon_connection_created'`，放 `lib/mail/` 或 shared，后续 Talent/平台项目复用时再加类型
- `last_error_code` 只存错误代码（如 `INVALID_PARAMETER`、`SEND_LIMIT_EXCEEDED`），不存供应商原始报文
- 发信域名/发信地址/密钥沿用现有腾讯云 SES 配置（产品已确认），本票不涉及 DNS 配置
