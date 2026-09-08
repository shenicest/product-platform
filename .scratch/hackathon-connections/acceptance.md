# 黑客松项目建联 — 验收记录（工单 08）

> 日期：2026-09-07 · 环境：本地（macOS，MySQL 8 本地实例 + bun 1.3）
> 结论：**代码与数据层验收通过**；部署环境配置、SES 实发验证、内部账号全流程走查为上线前人工项（见「待办」）。

## 1. 全量测试

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 后端测试 | `bun run test:api` | ✅ 348 pass / 0 fail（29 文件） |
| 前端测试 | `bun run test:web` | ✅ 224 pass / 0 fail（40 文件） |
| 后端类型检查 | `bunx tsc --noEmit`（apps/api） | ✅ 无错误 |
| 前端 Lint | `bun run lint`（apps/web） | ✅ 0 error（3 条既有 warning，均不在本次改动文件） |
| 构建 | `bun run build` | ✅ api + web 均通过（web build 含类型检查） |

## 2. 环境变量（评审文档第 5 节）

- ✅ `apps/api/.env.example` 已含全部条目：`SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS`、`SMTP_FROM_EMAIL_ADDRESS`、`SMTP_REPLY_TO_ADDRESS`（可选）、`NOTIFICATION_WORKER`、`NOTIFICATION_POLL_INTERVAL_MS`、`SHENICEST_WEB_BASE_URL`；`SHENICEST_CONTACT_ENCRYPTION_KEY` 复用既有变量。
- ✅ 缺失即报错：`SmtpMailer` 构造时校验必填项并列出缺失名（`test/lib/mail/smtp-mailer.test.ts`）；`index.ts:17` 在 worker 开启但缺 `SHENICEST_WEB_BASE_URL` 时启动即抛错。
- ✅ Worker 门控行为：`NOTIFICATION_WORKER !== 'off'` 才启动（生产默认 on，测试 setup 默认 off）；投递行在 worker 关闭时依然写入（`create` 事务内），开启后按 Pending/退避继续投递，不丢请求（`apps/api/src/index.ts:15-38`、`apps/api/src/worker/mail-worker.ts`）。
- ⬜ **部署环境**实际注入上述变量并确认 worker 日志出现 `Mail worker started (poll every ...ms)` — 人工项。

## 3. SMTP（腾讯云 SES 通道）发信验证

- ⬜ **人工项**：用部署环境 SMTP 凭据向内部邮箱发一封测试邮件，确认 SMTP 服务地址、端口、SMTP 密码与发信地址可用。
- 已验证的代码层等价物：`SmtpMailer.send` 经 `nodemailer` 发送原始 HTML/Text（无模板），失败规范化为 `MailSendError`（`errorCode()` 只保留 nodemailer 错误码 / SMTP 响应码，不落原始响应）。

## 4. 预置数据（seed-hackathon-contacts）

在一次性临时库上完整走了一遍（非 dev 库）：

1. 建空库 `shenicest_test` → `drizzle-kit migrate` 全部迁移应用成功；
2. `bun src/db/seed-hackathon-contacts.ts` 首次运行 upsert 成功；
3. 重复运行 → 仍为 1 行（幂等，`ON DUPLICATE KEY UPDATE`）；
4. 验证后 drop 库，未触碰 dev 数据。

⬜ **人工项**（正式导入首批数据时逐条确认）：
- `receiver_user_id` 在共享 users 表存在（该字段为外系统 varchar，seed 脚本不做外键校验）；
- `notification_email` 归属经平台确认（PRD 21.2）。

## 5. 灰度（仅对已配置接收主体的项目生效）

本次补齐了灰度门控（此前 ticket 06 按「前端不预判」实现，按钮恒渲染，仅靠 409 兜底）：

- **API**：`GET /hackathon/projects/:id/connections/me` 响应改为 `{ data, receiverConfigured, viewerIsReceiver }`（附加字段，`data` 形状不变；PRD 11.1 定义该接口用途即「供详情页决定按钮状态」）。
- **Web**：项目无接收主体（`receiverConfigured=false`）或访问者即接收人（`viewerIsReceiver=true`）时，详情页不渲染「联系项目方」按钮；登录访客门控未知（null）仍渲染按钮，登录后服务端复评。严格按 PRD 16 字面（「不得显示可用的建联按钮」）未登录访客在未配置项目上仍可见按钮 — 属已知权衡，登录后即被门控覆盖。
- **兜底不变**：`POST` 创建接口对无配置项目仍返回 409 `NO_RECEIVER_CONFIGURED`（并发/绕过 UI 的防线）。`viewerIsReceiver` 隐藏接收人自己的按钮虽非票面明文，但与服务端 400 `CANNOT_CONNECT_SELF` 语义一致。
- 测试：api `test/modules/hackathon-connection/index.test.ts`（statusFor 门控标志）、web `test/server/hackathon-connections.test.ts`、`test/components/hackathon-connection-dialog.test.tsx`（未配置/接收人不渲染）。

## 6. PRD 20 验收走查（逐条对照自动化测试）

| # | 验收项 | 结果 | 依据 |
| --- | --- | --- | --- |
| 1 | 预置数据配置接收人+通知邮箱 | ✅ | 见第 4 节 |
| 2 | 详情页点击「联系项目方」 | ✅ | `hackathon-connection-dialog.test.tsx`（登录回流、弹窗） |
| 3 | 填写目的/消息/联系方式提交 | ✅ | 表单校验分支 + api 参数校验测试 |
| 4 | DB 生成 Pending、联系方式密文 | ✅ | api create 测试：DB 行密文、响应无密文 |
| 5 | 项目方收邮件、不含申请方联系方式 | ✅* | `templates.test.ts`「never includes contact info fields or mailto links」+ worker 发送测试；*实发邮件人工项见第 3 节 |
| 6 | 项目方在 /connections 处理；非项目方不可见 | ✅ | `connections/index.test.ts`（仅返回与 viewer 相关行）+ accept/ignore 仅锁定接收人（404 伪装） |
| 7 | 接受并填写联系方式 | ✅ | api accept 测试（密文入库、时间戳） |
| 8 | Accepted 后双方解锁 | ✅ | api contacts 测试（双方 mine/other） |
| 9 | 未接受不可见 | ✅ | contacts 非 Accepted/非双方 403；聚合接口密文不泄露测试 |
| 10 | 重复提交/接受/忽略幂等 | ✅ | PENDING_EXISTS（含并发事务+唯一索引）、重复接受不覆盖联系方式、忽略幂等 |
| 11 | 异常场景状态可追踪 | ✅ | 隐藏→Pending 转 Cancelled（Accepted 保留）；无配置 409；邮件失败 Pending/退避/3 次后 Failed + `last_error_code`（`mail-worker.test.ts`） |

## 7. 邮件失败演练

- **自动化等价已覆盖**：`mail-worker.test.ts`「marks a delivery Failed after the third failed attempt」（3 次失败 → Failed，之后不再重试）+「retries when content resolution fails transiently」；申请记录独立于投递状态，不受影响（create 事务与 worker 解耦）。
- ⬜ **人工项**：在部署环境临时注入错误凭据，观察退避（1min/5min/30min）后 3 次尝试 → `Failed`。
- 灰度期每日检查 SQL：

```sql
SELECT status, last_error_code, COUNT(*) FROM connection_notification_deliveries
GROUP BY status, last_error_code;
-- Failed 行数 > 0 时按 last_error_code + last_attempt_at 人工排查
```

## 8. 埋点/漏斗基线（PRD 15）

> 追加决策（2026-09-08 产品确认）：接受结果邮件从 P1 提前 — 项目方接受时向发送方平台账号邮箱（共享 users 表）发送通知，复用投递 worker 与幂等投递表；收不到账号邮箱或项目隐藏/重复接受路径静默跳过；忽略仍不发邮件。徽标未读方案未启用（邮件替代了该提示职责）。

无埋点系统，按票面回退为**结构化日志**，本次实现：

- `apps/api/src/lib/log-event.ts`：单行 JSON 到 stdout（`event`、`time` + PRD 15.2 白名单字段：eventId / hackathonProjectId / requestId / source / status / errorCode），单测保证单行与字段集合。
- 事件接入：
  - `connection_submit_success` / `connection_submit_failed`（含错误码）— 创建接口；
  - `connection_accept_success` / `connection_ignore_success` / `connection_contacts_unlocked` — 接收方动作与解锁；
  - `mail_delivery_sent` / `mail_delivery_failed`（含 errorCode，仅终态）— 投递 worker。
- 隐私：无微信号/邮箱/消息正文/密文/通知邮箱（PRD 15.2 禁止项）。
- 边界：事件在 HTTP 边界（controller / worker）发出，语义是「一次调用以 X 结束」；成功事件携带数字状态枚举（CONTEXT.md 的 ConnectionRequestStatus 语义）。
- 已知缺口（评审确认记录在案）：
  - 纯前端事件（详情曝光、按钮点击、表单打开、邮件链接点击）P0 无客户端上报通道，接埋点系统时补；
  - 「项目方查看申请量」需 /connections 页面级事件，同样待客户端通道；
  - TypeBox 校验层（422/400）在 handler 之前拒绝，不产生 `connection_submit_failed`；服务层 INVALID_* 错误已覆盖（PRD 提交失败量的主要构成）；
  - `connection_contacts_unlocked` 统计的是解锁查看次数（行为指标）；「有效建联量」按 Accepted 行数从 DB 统计更准确，不加事件。

## 9. 隐私政策/服务条款提醒

建联说明补充（PRD 阶段 0）由产品跟进 — **待办提醒**，本票不阻塞技术上线。

## 10. 上线前人工待办汇总

1. 部署环境注入第 2 节环境变量，确认 worker 启动日志；
2. SMTP 实发测试邮件（第 3 节）；
3. 正式导入首批接收主体并完成账号/邮箱归属确认（第 4 节）；
4. 内部账号走通全流程（PRD 20 闭环在真实部署上复走一遍）；
5. 错误凭据失败演练（第 7 节）；
6. 隐私政策/条款建联说明（第 9 节）。
