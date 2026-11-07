# 0015. BoomLand 是独立赛季上下文，只共享平台 User

## Status

Accepted

## Context

BoomLand 的词汇（Season、Organizer、Application、Participant、Challenge）与现有 Product Showcase 的词汇（Founder、Operator、Project、Talent）有重叠，但语义不同：

- Product Showcase 的权限是平台级角色（`founder` / `operator`）加属主关系。
- BoomLand 的主办方权限是**赛季级**的：用户先在某个主办方组织里，组织再被关联到具体赛季；同一个人可以在 A 赛季是主办方、在 B 赛季只是报名者。
- BoomLand 的报名、选手、命题、预算、积分池都与赛季强绑定，不能复用 Project 表。
- 现有 `audit_records` 带 `project_id`，无法表达赛季级审计。

如果把 BoomLand 塞进 Founder/Project 模型，会迫使平台角色膨胀（新增 `platform_admin`、`organizer` 等全局角色），并让赛季权限泄漏到项目管理。

## Decision

1. **BoomLand 是独立的限界上下文**，拥有自己的词汇表（`docs/boomland/CONTEXT.md`）与数据表。
2. **只共享平台 User**：外部认证系统签发的 JWT `user_id`、共享的 `users` 表，以及用户公开资料（昵称、头像）。
3. **复用 `operator` 作为 Platform Admin**：不新增平台角色。BoomLand 文档与代码中称其为 Platform Admin，但其身份判断仍是现有 `Role.Operator`。
4. **主办方权限由两张关联表授予**：`organizer_org_members`（用户属于组织）与 `season_organizers`（组织主办赛季）。没有全局 `organizer` 角色，也不在赛季内区分负责人。
5. **BoomLand 不读写 Product Showcase 的领域表**（`projects`、`project_edit_proposals`、`talents`、`connections` 等）；反之亦然。
6. **独立审计**：新建通用 `audit_logs`，不复用 `audit_records`。

## Consequences

- BoomLand 的鉴权守卫需要新增“赛季主办方”判断，不能只靠 `operatorOnly` / `founderOnly`。
- `operator` 在平台上有两个产品含义（Product Showcase Operator / BoomLand Platform Admin），文档必须写清楚上下文。
- 跨上下文共享只允许 User 与用户公开资料；若未来需要共享企业身份、项目或作品，必须先新增 ADR。
- BoomLand 的模块、表、错误码与测试可以独立演进，不会污染 Product Showcase。
- 好处是赛季权限不会泄漏：一个用户离开主办方组织或赛季后，自动失去该赛季的编辑权，无需清理全局角色。
