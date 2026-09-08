# 02 — Mailer（SMTP，腾讯云 SES 通道）+ 邮件模板 + 投递 worker

**What to build:** 平台邮件基础设施。`Mailer` 接口 + SMTP 适配器（`nodemailer`）+ 建联通知模板（HTML/纯文本、转义）+ 进程内投递 worker（轮询、认领、退避重试、幂等）。

**Blocked by:** 01（需要 `connection_notification_deliveries` 表）

**Status:** done

- [ ] 安装 `nodemailer`（SMTP 客户端；腾讯云 SES `SendEmail` API 默认仅支持模板发送，`Simple` 已废弃，故走其 SMTP 通道）
- [ ] `apps/api/src/lib/mail/mailer.ts`：`Mailer` 接口 `send({ to, subject, html, text, idempotencyKey }): Promise<{ providerMessageId?: string }>` + 内存实现（测试用，记录调用）
- [ ] `apps/api/src/lib/mail/smtp-mailer.ts`：SMTP 适配；host/port/user/pass/发信地址从环境变量读取，缺失时构造处 throw（禁止裸 `process.env.X!`）
- [ ] `apps/api/src/lib/mail/templates/hackathon-connection-created.ts`：输入 `{ projectName, projectUrl, purpose, message, createdAt, connectionsUrl }`；用户输入全部 HTML 转义；同时产出 text 版本；邮件中**不含申请方任何联系方式，也不展示申请人昵称**
- [ ] `apps/api/src/worker/mail-worker.ts`：轮询 `connection_notification_deliveries`
  - 认领：条件 UPDATE `Pending → Sending`（或 `Sending` 且 `last_attempt_at` 早于 10 分钟），`affectedRows = 1` 才发送
  - 发送成功：`Sent` + `provider_message_id`（SMTP 返回的 `MessageId`）
  - 失败：`attempt_count < 3` 时按 1min/5min/30min 退避保持 `Pending`；第 3 次失败置 `Failed` + `last_error_code`
- [ ] `apps/api/src/index.ts` 按 `NOTIFICATION_WORKER`（默认生产 on / 测试 off）启动 worker，`NOTIFICATION_POLL_INTERVAL_MS` 默认 30000
- [ ] `.env.example` 追加：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`SMTP_FROM_EMAIL_ADDRESS`、`SMTP_REPLY_TO_ADDRESS`、`NOTIFICATION_WORKER`、`NOTIFICATION_POLL_INTERVAL_MS`（只追加行）
- [ ] 测试（`bun test`，用内存 Mailer）：
  - 模板：主题/正文含项目名与消息；消息含 `<script>` 等内容被转义；正文不含微信/邮箱明文
  - worker：Pending 被认领且只发一次；失败退避后重试；三次失败置 Failed；`Sending` 僵死行可回收；同幂等键不重复发
  - 环境变量缺失时 smtp-mailer 构造报错

**Implementation notes:**
- worker 与 API 同进程（评审文档 D6）；认领门闩使多实例部署天然安全
- 通知类型常量 `NOTIFICATION_TYPES.CONNECTION_CREATED = 'hackathon_connection_created'`，放 `lib/mail/` 或 shared，后续 Talent/平台项目复用时再加类型
- `last_error_code` 只存错误代码（如 `EAUTH`、`SMTP_550`、`UNKNOWN`），不存供应商原始报文
- 发信域名/发信地址沿用现有腾讯云 SES 配置（产品已确认），SMTP 专用密码由控制台生成，本票不涉及 DNS 配置
