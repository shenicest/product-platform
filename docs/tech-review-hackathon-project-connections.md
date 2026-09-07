# 技术评审：黑客松项目建联

> 评审对象：[prd-hackathon-project-connections.md](./prd-hackathon-project-connections.md)
> 状态：Reviewed（结论已落入 [.scratch/hackathon-connections/issues/](../.scratch/hackathon-connections/issues/) 工单）
> 日期：2026-09-07

## 1. 结论摘要

PRD 的技术方案整体可行。核心改动落在后端一个新模块 + 邮件适配层与投递 worker、四张新表，前端两块（黑客松详情页入口、统一连接记录页）。已核实代码中的可复用点与偏差点，见下。工单拆分为 8 张（`01`–`08`），每张自带测试要求。

## 2. PRD 假设核对结果

| PRD 假设 | 核对结果 |
| --- | --- |
| 联系方式服务端 AES-GCM 加密能力可复用 | ✅ `apps/api/src/lib/contact-encryption.ts` 已有 `encryptContact` / `decryptContact`，模块加载时校验 `SHENICEST_CONTACT_ENCRYPTION_KEY`（测试 setup 已提供默认值） |
| 状态枚举可沿用 `ConnectionRequestStatus` | ✅ `packages/shared` 已导出（Pending 0 / Accepted 1 / Ignored 2 / Cancelled 3），无需新增 |
| 建联目的需要新枚举 | ✅ 现有 `CONNECTION_PURPOSES` 是 Talent 场景文案，黑客松需要独立 `HACKATHON_CONNECTION_PURPOSES` |
| 项目方需平台侧接收主体映射 | ✅ 黑客松项目在 `event_management.projects`（外部库），无平台 User 关联；`hackathon_project_contacts` 表必要 |
| 连接记录页可复用 | ✅ `/connections` 页面、`ConnectionsPanel`、接受弹窗、`connection-nav` 未读徽标均可扩展；但当前数据源是 `/talents/connections`，见 D4 |
| 每日限额可参考 Talent 实现 | ✅ Talent 用 `connection_daily_limits` 表 + 北京日期 + `FOR UPDATE` 行锁；黑客松采用同构新表（见 D2） |
| 邮件基础设施 | ⚠️ 仓库内无邮件依赖；确认沿用现有腾讯云 SES 配置（发信域名/发信地址/密钥已存在），见 D6 |
| Pending 唯一可用 pair_key 模式 | ✅ Talent 已验证该模式（`uq_connection_requests_active_pair` 唯一索引 + 终态置 NULL），黑客松照搬 |
| 邮件失败不回滚申请 | ✅ 用独立投递表 + 异步 worker，事务内只写任务行 |

## 3. 技术决策

### D1 — 黑客松建联使用独立表 `hackathon_connection_requests`（维持 PRD 10.1）

不复用/扩展 `connection_requests`。理由：

- 现有 `projectId` 语义是"发送方自己的 Live Project"（talent `service.ts` 中 `project.userId !== senderUserId` 校验），黑客松是"目标项目"，语义相反且指向外部库；
- Talent 接收方强制 Published TalentProfile，黑客松项目方没有该前提；
- 隔离改动面：Talent 模块及其测试零回归。

共享的部分已经天然共享：状态枚举（shared）、加密（lib）、pair_key 模式、连接记录 UI 与聚合 DTO。平台 Project 未来接入时再做统一抽象（PRD 19），本期不建多态表。

实现时需补：CONTEXT.md 新术语（HackathonConnectionRequest、HackathonProjectContact）+ ADR-0010 记录本决策。

### D2 — 每日限额用同构新表 `hackathon_connection_daily_limits`

不复用 `lib/rate-limit.ts`（`consumeRateLimit`）：它的窗口是 UTC 对齐的固定窗口，而"每日"在本仓库既有语义是北京日期（Talent 同类限制即如此）；且限额应只计创建成功数，走与 Talent 相同的"事务内 INSERT IGNORE + FOR UPDATE + 成功后自增"模式。表结构与 `connection_daily_limits` 同构（`sender_user_id + beijing_date` 唯一），限制 3 条/日。

> 后续更新：两张同构限额表已合并为带 `scope` 列的 `connection_daily_limits`，见 [ADR-0011](./adr/0011-unified-connection-daily-limits.md)。

### D3 — 项目隐藏的 Pending 取消采用"埋点 + 守卫"，不做后台清扫

- 项目唯一会变隐藏的入口是 `HackathonService.hideProject`：在其成功路径同步调用 `cancelPendingByProject(eventId, projectId)`（置 Cancelled + `handled_at`）；
- `accept` 时再次校验项目可见性，隐藏则先取消该申请再返回 409；
- `create` 时项目隐藏直接 404（与详情页一致）。

不在列表读取时做批量事件库回查（N+1 且无必要）。

### D4 — 统一连接记录用新增 `GET /connections` 聚合端点

PRD 11.2 写"扩展现有连接记录聚合接口"，但 API 层现状只有 `/talents/connections`（Talent 语义，测试锁定）。定案：新增 `GET /connections`（新 `connections` 模块），Talent 端点不动：

- Talent 部分委托 `TalentService.connections(userId)`（其已按 Accepted+双方嵌入 contacts），聚合层裁剪为统一 DTO（去掉 talentProfile 重负载字段）；
- Hackathon 部分由 `HackathonConnectionService.listForUser(userId)` 输出统一 DTO；
- 合并后按 Pending 优先 + `createdAt desc` 排序，支持 `source` / `direction` 过滤；`pendingReceived` 为两源之和（供 `connection-nav` 徽标切换数据源）；
- 联系方式只在 Accepted 且访问者为双方之一时内嵌 `mine` / `other`。

### D5 — 黑客松服务依赖缝隙：不给测试引外部活动库

`test/modules/` 下没有 hackathon 测试，`EVENT_MANAGEMENT_DATABASE_URL` 也不在 `test/setup.ts` 默认值中。因此 `HackathonConnectionService` 构造函数注入 `{ getVisibleProject, getProjectSummary }` 两个函数，模块 index 用真实 `HackathonService` 装配，测试注入桩。不修改 test setup 去引导事件库。

可见性判定以 `getProject`（hidden 表）为准——与详情页一致；列表接口额外的"量子"关键词过滤不参与建联可见性（详情页能看到的就能建联）。

### D6 — 邮件：腾讯云 SES 适配 + 进程内投递 worker

- SDK 用模块化的 `tencentcloud-sdk-nodejs-ses`（比整包 `tencentcloud-sdk-nodejs` 小），调自定义内容邮件接口，HTML + 纯文本双版本；
- `Mailer` 接口薄适配：`send({ to, subject, html, text, idempotencyKey })`；凭据/Region 走环境变量，缺省时在构造处报错（遵循 AGENTS.md 环境变量规范）；测试注入内存实现；
- 投递 worker 为 API 进程内 `setInterval` 轮询（PRD 规模足够），认领用条件 UPDATE（`Pending → Sending`，`affectedRows` 门闩；`Sending` 超过 10 分钟视为僵死可重新认领），多实例部署时天然安全；
- 退避 1 分钟 / 5 分钟 / 30 分钟，最多 3 次尝试，超出置 `Failed`；幂等键 `(connection_request_id, notification_type)` 唯一索引兜底；
- worker 由 `NOTIFICATION_WORKER` 环境变量门控（测试关闭）。

### D7 — 路由归属

| 路由 | 模块 |
| --- | --- |
| `POST /hackathon/projects/:id/connections` | `hackathon-connection` |
| `GET /hackathon/projects/:id/connections/me` | `hackathon-connection` |
| `POST /connections/hackathon/:id/accept` / `ignore`、`GET /connections/hackathon/:id/contacts` | `hackathon-connection`（按 PRD 11.2 路径） |
| `GET /connections` | `connections`（聚合，只读组合两服务输出） |

两模块均无前缀 Elysia 实例（与 `hackathonModule` 同风格），在 `src/app.ts` 显式 `.use()` 注册。注意：`app.ts` 当前有未提交的并行改动，实现时只追加注册行，不动其他内容。

### D8 — 错误码定案

| HTTP | code | 场景 |
| ---: | --- | --- |
| 401 | `UNAUTHORIZED` | 未登录 |
| 404 | `PROJECT_NOT_FOUND` | 项目不存在或已隐藏 |
| 404 | `REQUEST_NOT_FOUND` | 申请不存在或无权访问 |
| 409 | `NO_RECEIVER_CONFIGURED` | 无接收主体 |
| 409 | `PENDING_EXISTS` | 已有 Pending |
| 409 | `ALREADY_CONNECTED` | 已 Accepted |
| 409 | `RATE_LIMITED` | 超 3 条/日 |
| 409 | `REQUEST_NOT_PENDING` | 状态不允许该操作 |
| 409 | `RETRY_COOLDOWN` | Ignored 后 7 天内重申 |
| 400 | `CANNOT_CONNECT_SELF` | 申请对象是自己负责的项目 |
| 400 | `INVALID_CONTACT` / `INVALID_MESSAGE` / `INVALID_PURPOSE` | 字段校验 |
| 403 | `REQUEST_FORBIDDEN` / `CONTACTS_FORBIDDEN` | 非接收人 / 非双方 |

### D9 — `hackathon_project_contacts` 不含 `is_active`（产品已确认 P0 不做开关）

"项目可建联"的判定 = 项目可见 + 存在接收主体记录。开关作为 P1 再加列。

## 4. 最终数据模型（实现基准）

四张表均进 `apps/api/src/db/schema/hackathon-connection.ts`，由 `drizzle-kit generate` 生成迁移（当前最新为 0019，新迁移为 0020+）：

1. `hackathon_project_contacts` — `(event_id, hackathon_project_id)` 唯一；`receiver_user_id` 索引；无 `is_active`。
2. `hackathon_connection_requests` — `pair_key` 唯一可空（Pending 写入、终态置 NULL）；索引 `(receiver_user_id, status, created_at)`、`(sender_user_id, hackathon_project_id, status)`；`sender_contact` / `receiver_contact` 密文。
3. `hackathon_connection_daily_limits` — `(sender_user_id, beijing_date)` 唯一。
4. `connection_notification_deliveries` — `(connection_request_id, notification_type)` 唯一；`status`：Pending/Sending/Sent/Failed；`provider_message_id` 存 SES `MessageId`。

## 5. 环境变量

| 变量 | 说明 |
| --- | --- |
| `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY` | 沿用现有腾讯云凭据（若已有同名变量则直接复用） |
| `TENCENTCLOUD_SES_REGION` | 默认 `ap-guangzhou` |
| `SES_FROM_EMAIL_ADDRESS` | 现有已验证发信地址 |
| `SES_REPLY_TO_ADDRESS`（可选） | 回复地址 |
| `NOTIFICATION_WORKER` | `on`/`off`，默认生产 `on`、测试 `off` |
| `NOTIFICATION_POLL_INTERVAL_MS` | 默认 30000 |

`SHENICEST_CONTACT_ENCRYPTION_KEY` 已存在，复用。`.env.example` 当前有并行未提交改动，实现票只追加邮件相关行。

## 6. 测试策略

- **API**（`bun test`，隔离库自动迁移）：新表随测试库迁移自动建好；事件库通过 D5 缝隙打桩；并发用例（重复 Pending、认领竞争）用真实事务 + 断言 `affectedRows`；联系人密文断言复用 Talent 测试的"响应与 DB 均不含明文"模式。
- **Web**（Vitest + RTL + MSW，`onUnhandledRequest: 'error'`）：每个测试文件自声明命中的路由；Server 层用 `vi.mock('next/headers')` 桩 cookie。
- 不测 Server Components 本体，测 `server/*` 数据函数与交互组件。

## 7. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 接收主体配置缺失导致申请黑洞 | 无配置 → 409 且详情页不渲染可提交按钮；上线前完成导入清单（PRD 16） |
| worker 与 API 同进程，API 重启丢轮询周期 | 投递行持久化，重启后按状态继续；僵死认领 10 分钟回收 |
| 聚合接口 Talent 部分沿袭 N+1（`connectionView` 逐行查） | P0 数据量小；统一 DTO 裁剪重字段；平台 Project 接入时重构为批量查询 |
| `app.ts` / `.env.example` 有并行未提交改动 | 工单要求只追加行，不重排既有内容 |
| 邮件 HTML 注入 | 模板层对所有用户输入做 HTML 转义，纯文本版本同源生成；模板测试覆盖 |

## 8. 工单索引

详见 [.scratch/hackathon-connections/issues/](../.scratch/hackathon-connections/issues/)：

| # | 工单 | 阻塞于 |
| --- | --- | --- |
| 01 | shared 常量 + 4 张表 schema/迁移 + 预置数据脚本 + CONTEXT/ADR | — |
| 02 | Mailer（腾讯云 SES）+ 模板 + 投递 worker | 01 |
| 03 | 创建申请 + 状态查询（含限额、冷却、隐藏钩子） | 01 |
| 04 | 接受 / 忽略 / 联系方式解锁 | 03 |
| 05 | `GET /connections` 聚合接口 | 03（并行 04） |
| 06 | 前端：详情页建联入口 + 申请弹窗 + 登录回流 | 03 |
| 07 | 前端：统一连接记录页 + 处理动作 + 未读徽标 | 04、05 |
| 08 | 上线清单与灰度验收 | 01–07 |
