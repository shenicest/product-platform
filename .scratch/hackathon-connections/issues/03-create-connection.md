# 03 — 创建建联申请 + 状态查询（含限额、冷却、隐藏钩子）

**What to build:** `hackathon-connection` 模块的申请方侧：`POST /hackathon/projects/:id/connections` 创建 Pending 申请（写申请行 + 投递任务行，同事务），`GET /hackathon/projects/:id/connections/me` 返回当前用户针对该项目的状态摘要。包含每日限额、Pending 唯一、Accepted 阻断、忽略冷却、自我申请拦截、项目可见性校验，以及 `HackathonService.hideProject` 的取消钩子。

**Blocked by:** 01

**Status:** done

- [ ] `apps/api/src/modules/hackathon-connection/`（`index.ts` / `service.ts` / `model.ts`），无前缀 Elysia 实例，`app.ts` 追加注册
- [ ] `HackathonConnectionService` 构造注入 `{ getVisibleProject, getProjectSummary }`（评审 D5 缝隙）；模块 index 用真实 `HackathonService` 装配，测试注入桩
- [ ] 创建流程（单事务）：
  - 校验登录（`auth: true`）、目的在 `HACKATHON_CONNECTION_PURPOSES`、消息 30–500 字、联系方式（微信/邮箱至少一项，服务端规范化 + `encryptContact` 加密）
  - 项目存在且未隐藏（否则 404 `PROJECT_NOT_FOUND`）；存在接收主体（否则 409 `NO_RECEIVER_CONFIGURED`）
  - 申请方 ≠ `receiver_user_id`（400 `CANNOT_CONNECT_SELF`）
  - 同 (sender, project) 无 Pending（pair_key 唯一 + 事务锁，409 `PENDING_EXISTS`）、无 Accepted（409 `ALREADY_CONNECTED`）
  - 最近一条 Ignored 的 `handled_at` 在 7 天内 → 409 `RETRY_COOLDOWN`
  - 每日限额：`hackathon_connection_daily_limits` 北京日期 INSERT IGNORE + FOR UPDATE，成功创建后自增，超 3 → 409 `RATE_LIMITED`
  - 写入申请行（`pair_key = sender:projectId`，receiver 锁定为配置值）+ 投递任务行（幂等键）
- [ ] 状态查询：返回 `{ data: { id, status, createdAt } | null }`，不含联系方式
- [ ] 错误码按评审 D8 映射（onError 或 status 返回，风格对齐 talent 模块）
- [ ] `HackathonService.hideProject` 成功后调用 `cancelPendingByProject(eventId, projectId)`（Pending → Cancelled + `handled_at`）；改动保持最小
- [ ] 响应与日志不泄露联系方式明文/密文
- [ ] 测试（`test/modules/hackathon-connection/`，桩注入项目查询）：
  - 创建成功写入申请 + 投递任务（同事务）；limit/offset 无关字段正确
  - 401 / 404（不存在、隐藏）/ 409 `NO_RECEIVER_CONFIGURED` / 400 `CANNOT_CONNECT_SELF`
  - 重复 Pending 409（含并发：事务 + 唯一索引 `ER_DUP_ENTRY` → `PENDING_EXISTS`，参考 talent `send()` 的 catch 模式）
  - Accepted 后 409 `ALREADY_CONNECTED`；Ignored 7 天内 409 `RETRY_COOLDOWN`、7 天后成功
  - 限额第 3 条后 409 `RATE_LIMITED`（跨项目计数）
  - 消息/目的/联系方式非法 → 422 / 400；控制字符拒绝；邮箱规范化小写
  - DB 中 `sender_contact` 为密文；接口响应不含密文
  - `me` 状态：无记录 null、Pending/Accepted 正确
  - 隐藏钩子：hide 后 Pending 变 Cancelled，Accepted 保留

**Implementation notes:**
- 北京日期函数从 talent `service.ts` 的 `beijingDate()` 提取共用或复制（复制可接受，提取更佳）
- 接收主体在创建时锁定进申请行（`receiver_user_id`），后续配置变更不影响历史申请
- 投递任务行即使 `NOTIFICATION_WORKER=off` 也写入（数据完整性），worker 关闭时只是不投递
- `GET /hackathon/projects/:id/connections/me` 为 `auth: true`（未登录由前端不调用）
- `app.ts` 有并行未提交改动：只追加 `.use(hackathonConnectionModule)` 一行
