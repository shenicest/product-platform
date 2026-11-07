# Context Map

BoomLand 产品线在本仓库内包含多个限界上下文（bounded context）。每个上下文有自己的词汇表；跨上下文只共享明确声明的资源。

## Contexts

- [Product Showcase](./CONTEXT.md) — 现有的 SheNicest 产品展示平台：Founder 提交项目、Operator 审核、Project 浏览/点赞/关注、Talent 档案与建联。
- [BoomLand](./docs/boomland/CONTEXT.md) — 赛季制共创平台：赛季生命周期、主办方组织、命题、预算/积分池、报名、选手与开赛前治理。
- [BoomLand API 契约](./docs/boomland/pre-start-season-api.md) — 开赛前赛季与报名的后端接口、数据模型与状态机。
- [BoomLand 前端契约](./docs/boomland/pre-start-season-frontend.md) — 公开页、主办方后台、管理员后台的路由与页面职责。

## Relationships

```text
External Auth (JWT user_id)
        │
        ├── Product Showcase ── users / user_identities / projects / talents / connections
        │
        └── BoomLand ───────── users (shared) / seasons / organizer_orgs / season_applications / ...
```

- **Shared kernel：User。** 两个上下文都消费外部认证系统签发的 JWT，并以 `user_id` 关联共享的 `users` 表。用户资料（昵称、头像）可跨上下文读取。
- **Role 复用，不新增平台角色。** 现有 `operator`（`Role.Operator`）在 BoomLand 中承担 **Platform Admin** 职责；不新增 `platform_admin` 角色，也不新增赛季级全局角色。主办方权限由 `organizer_org_members` + `season_organizers` 在赛季范围内授予。
- **领域表隔离。** BoomLand 不读写 Product Showcase 的 `projects` / `project_edit_proposals` / `talents` / `connections` / Founder 专属数据；Product Showcase 也不读写 BoomLand 的赛季表。
- **审计隔离。** 现有 `audit_records` 绑定 `project_id`，BoomLand 使用独立的通用 `audit_logs`。
- **UI 可共享基础组件与设计语言，但页面归属各自上下文。**

## Rules

- 修改任一上下文的领域模型前，先读该上下文的 `CONTEXT.md`。
- 跨上下文只允许通过上面声明的共享资源交互；新增共享资源必须先更新本文件并记录 ADR。
- 术语冲突时以各自 `CONTEXT.md` 为准，不要用 Product Showcase 的 Founder/Project 语义解释 BoomLand 的 Participant/Challenge。
