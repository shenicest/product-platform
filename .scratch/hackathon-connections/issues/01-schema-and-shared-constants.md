# 01 — shared 常量 + 四张表 schema/迁移 + 预置数据脚本 + CONTEXT/ADR

**What to build:** 黑客松建联的数据地基。新增 `HACKATHON_CONNECTION_PURPOSES` 共享常量；新增四张平台表（接收主体映射、建联申请、每日限额、邮件投递）的 drizzle schema 与迁移；提供接收主体预置数据脚本；补 CONTEXT.md 术语和 ADR-0010。

**Blocked by:** —

**Status:** done

- [ ] `packages/shared/src/index.ts` 新增 `HACKATHON_CONNECTION_PURPOSES = ['试用产品', '合作交流', '加入项目', '提供专业帮助', '寻求反馈', '其他']` 及类型导出；`ConnectionRequestStatus` 复用，不新增状态枚举
- [ ] `apps/api/src/db/schema/hackathon-connection.ts`：`hackathonProjectContacts`、`hackathonConnectionRequests`、`hackathonConnectionDailyLimits`、`connectionNotificationDeliveries`（字段与索引见评审文档第 4 节；**无 `is_active`**）
- [ ] `hackathon_connection_requests.pair_key` 唯一可空索引（Pending 写入、终态置 NULL，模式同 Talent 的 `uq_connection_requests_active_pair`）
- [ ] `connection_notification_deliveries` 以 `(connection_request_id, notification_type)` 唯一
- [ ] schema 在 `apps/api/src/db/schema/index.ts` 追加导出
- [ ] `apps/api` 下 `bunx drizzle-kit generate` 生成迁移（0020+），不手写 SQL
- [ ] 预置数据脚本 `apps/api/src/db/seed-hackathon-contacts.ts`：幂等 upsert `(event_id, hackathon_project_id) → receiver_user_id + notification_email`，数据源为脚本内常量或 TSV 文件
- [ ] CONTEXT.md 新增术语：**HackathonConnectionRequest**（围绕外部黑客松项目的双向授权建联申请）、**HackathonProjectContact**（项目的平台接收主体映射，`receiver_user_id` 管权限、`notification_email` 只管投递）
- [ ] `docs/adr/0010-hackathon-connection-separate-table.md`：记录独立表 vs 扩展 `connection_requests` 的决策（评审文档 D1）

**Implementation notes:**
- 表结构以 `docs/tech-review-hackathon-project-connections.md` 第 4 节为实现基准；`tinyint` 状态复用 `ConnectionRequestStatus` 数值语义
- `hackathon_project_contacts.notification_email` 明文存储（与 `hackathon_connection_requests.recipient_email` 一致），属于受限数据但不加密——加密仅用于联系方式
- 迁移在测试库由 `test/setup.ts` 自动执行，本票的验证方式：`bun test` 全量通过 + `bunx drizzle-kit studio` 目检表结构
- 预置脚本参考 `src/db/seed.ts` 的运行方式（`bun src/db/seed-hackathon-contacts.ts`），package.json 可选加 `seed:hackathon-contacts` script
- 并行改动警告：`schema/index.ts` 无冲突，但根 `bun.lock` / `package.json` 有未提交改动，只追加
