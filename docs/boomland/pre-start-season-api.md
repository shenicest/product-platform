# BoomLand 开赛前赛季与报名 API 契约

> 状态：实施基线（draft for implementation）
> 范围：BoomLand PRD V2.6 的「开赛前赛季 + 用户报名」；不含评分、结算、作品、里程碑、项目、企业身份、命题冻结、开赛后取消、通知红点。
> 领域词汇以 [CONTEXT.md](./CONTEXT.md) 为准；跨上下文边界见 [ADR-0015](../adr/0015-boomland-season-context-and-identity-boundary.md)。

## 0. 范围与不变量

本批实现：

1. 主办方组织与成员（Platform Admin 管理）。
2. 赛季草稿、赛程、主题、类型化规则、规则卡、公告、审计。
3. 赛季提交 → 待批 → 批准/驳回 → 开赛；暂停/恢复；开赛前取消；复制上季。
4. 九项发布就绪硬校验。
5. 命题五件套（创建、编辑、发布、关闭、归档、版本计数）。
6. 最小预算、积分池、评委分配、核验员授权（只为让发布门槛成立）。
7. 个人报名、报名审核、赛季选手创建、微信群状态人工记录。
8. 公开赛季列表/详情、我的报名、主办方后台、管理员后台。

不变量：

- 一个用户在一个赛季最多一条报名；一个用户在一个赛季最多一个选手记录。
- 一个赛季必须至少关联一个 Organizer Org，且该组织至少有一名成员，才能发布。
- `season.code` 全局唯一，创建后不可修改。
- 只有 `upcoming` 且 `approvedAt` 非空的赛季可以开赛；且当前时间必须 `>= startAt`。
- 只有 `draft` / `upcoming` 可以取消；`active` 取消不在本批。
- 报名只在已批准、未暂停、未取消、且当前时间在 `[applyOpen, applyClose]` 内时开放。
- 报名接受后报名状态为终态；本批不支持撤回。
- 报名联系方式永远不公开；只有本人、该赛季主办方、Platform Admin 可见。
- 所有管理动作写 `audit_logs`；赛程/规则变更额外递增 `rulesVersion`，可选写公告。
- 全平台最多一个置顶赛季；只有已批准且未取消的赛季可置顶。

## 1. 通用约定

### 1.1 路由与客户端

- 后端路由挂在根路径：`GET /seasons`、`POST /seasons/:id/submit`。
- Web 端通过 Next.js rewrite 调用 `/api/seasons`；rewrite 去掉 `/api` 前缀，见 `apps/web/next.config.ts`。
- 本契约中的路径均为**后端路径**。

### 1.2 认证

- JWT 由外部认证系统签发，支持 `Authorization: Bearer <token>` 与 httpOnly cookie `shenicest_token`。
- 复用 `apps/api/src/plugins/auth.ts` 的 `auth` / `optionalAuth`。
- 身份只提供 `userId` 与 `role`（`founder` / `operator`）。
- BoomLand 的 **Platform Admin** = `role === operator`。
- BoomLand 的 **Season Organizer** = 用户属于该赛季 `season_organizers` 中任一组织的成员。
- 不新增平台角色。

### 1.3 请求/响应格式

- 请求与响应均为 JSON（`content-type: application/json`）。
- 时间统一 ISO 8601 字符串（UTC），例如 `2026-03-01T00:00:00.000Z`。
- ID 为 number。
- 成功：`200 OK`；新建资源：`201 Created`；删除成功：`204 No Content`。
- 失败统一使用现有错误包：

```json
{
  "error": {
    "code": "SEASON_NOT_READY",
    "message": "赛季尚未满足发布条件",
    "field": "readiness"
  }
}
```

`field` 可选，仅用于表单定位。

### 1.4 分页

列表接口统一：

```ts
type PaginationQuery = {
  page?: number      // 1-based, default 1
  pageSize?: number  // default 20, max 100
}

type Paginated<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}
```

### 1.5 加密

- 报名联系方式使用 AES-256-GCM。
- 环境变量 `BOOMLAND_CONTACT_KEY`：base64 编码的 32 字节密钥；模块加载时校验，缺失直接启动失败。
- 存储格式（`season_applications.contact_encrypted`）：

```json
{
  "v": 1,
  "iv": "<base64>",
  "tag": "<base64>",
  "data": "<base64>"
}
```

- 明文结构：`{ "wechat"?: string, "phone"?: string }`，至少一个非空。
- AAD：`boomland-contact:v1`。
- 任何列表接口不得返回密文；列表只返回 `contactMasked`，详情按权限返回解密后的 `contact`。

### 1.6 共享枚举（新增到 `@shenicest/shared`）

```ts
export const SeasonType = {
  Season: 'season',
  Hackathon: 'hackathon',
} as const
export type SeasonType = (typeof SeasonType)[keyof typeof SeasonType]

export const SeasonStatus = {
  Draft: 'draft',
  Upcoming: 'upcoming',
  Active: 'active',
  Suspended: 'suspended',
  Cancelled: 'cancelled',
} as const
export type SeasonStatus = (typeof SeasonStatus)[keyof typeof SeasonStatus]

export const SeasonApplicationStatus = {
  Submitted: 'submitted',
  Accepted: 'accepted',
  Pending: 'pending',
  Waitlisted: 'waitlisted',
  Rejected: 'rejected',
  Withdrawn: 'withdrawn',
} as const
export type SeasonApplicationStatus =
  (typeof SeasonApplicationStatus)[keyof typeof SeasonApplicationStatus]

export const SeasonParticipantStatus = {
  Active: 'active',
  Withdrawn: 'withdrawn',
} as const
export type SeasonParticipantStatus =
  (typeof SeasonParticipantStatus)[keyof typeof SeasonParticipantStatus]

export const ApplicationVisibility = {
  Public: 'public',
  OrganizerOnly: 'organizer_only',
} as const
export type ApplicationVisibility =
  (typeof ApplicationVisibility)[keyof typeof ApplicationVisibility]

export const WechatStatus = {
  NotInvited: 'not_invited',
  Invited: 'invited',
  Joined: 'joined',
  Failed: 'failed',
} as const
export type WechatStatus = (typeof WechatStatus)[keyof typeof WechatStatus]

export const ChallengeStatus = {
  Draft: 'draft',
  Reference: 'reference',
  Published: 'published',
  Closed: 'closed',
  Archived: 'archived',
} as const
export type ChallengeStatus = (typeof ChallengeStatus)[keyof typeof ChallengeStatus]

export const BudgetStatus = {
  Active: 'active',
  Superseded: 'superseded',
} as const
export type BudgetStatus = (typeof BudgetStatus)[keyof typeof BudgetStatus]

export const PointPoolStatus = {
  Active: 'active',
  Closed: 'closed',
} as const
export type PointPoolStatus = (typeof PointPoolStatus)[keyof typeof PointPoolStatus]

export const PointAllocationStatus = {
  Active: 'active',
  Reclaimed: 'reclaimed',
} as const
export type PointAllocationStatus =
  (typeof PointAllocationStatus)[keyof typeof PointAllocationStatus]

export const VerifierGrantStatus = {
  Active: 'active',
  Revoked: 'revoked',
} as const
export type VerifierGrantStatus =
  (typeof VerifierGrantStatus)[keyof typeof VerifierGrantStatus]

export const AnnouncementCategory = {
  General: 'general',
  Schedule: 'schedule',
  Rules: 'rules',
} as const
export type AnnouncementCategory =
  (typeof AnnouncementCategory)[keyof typeof AnnouncementCategory]
```

状态字段在 DB 使用 `varchar(16)`（不是 tinyint），因为状态会出现在 URL、查询与对外文案中。`@shenicest/shared` 是唯一真相源，禁止硬编码字符串。

## 2. 角色与权限矩阵

| 动作 | 公开 | 登录用户 | 报名本人 | Season Organizer | Platform Admin |
|---|---:|---:|---:|---:|---:|
| 公开赛季列表/详情 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 公开公告/已发布命题 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 查看自己的报名 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 查看自己所属组织 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 创建赛季 | ❌ | ❌ | ❌ | ✅（仅自己的组织） | ✅（任意组织） |
| 编辑赛季核心字段 | ❌ | ❌ | ❌ | ✅（本人赛季，draft） | ✅（draft） |
| 提交/开赛/暂停/恢复/取消/复制 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 批准/驳回/置顶 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 管理组织与成员 | ❌ | ❌ | ❌ | ❌ | ✅ |
| 提交报名 | ❌ | ✅ | — | ✅ | ✅ |
| 审核报名/拉群 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 命题 CRUD/发布 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 预算/积分池/评委分配/核验员 | ❌ | ❌ | ❌ | ✅ | ✅ |
| 公告/审计 | ❌ | ❌ | ❌ | ✅ | ✅ |

补充：

- “Season Organizer”按**赛季范围**判断：`EXISTS(season_organizers so JOIN organizer_org_members m ON m.org_id = so.org_id WHERE so.season_id = ? AND m.user_id = ?)`。
- 企业身份不在本批；没有“企业不能审核报名/发布命题”的独立主体。所有主办方能力都属于 Organizer Org 的成员。
- 公开端不得因权限差异返回 403；非公开赛季统一 404，避免泄漏草稿存在。

## 3. 状态机

### 3.1 Season

```text
draft ──submit──▶ upcoming (approvedAt = null)   [主办方提交]
draft ──submit──▶ upcoming (approvedAt = now)    [管理员提交，自动批准]

upcoming(pending) ──approve──▶ upcoming(approvedAt = now)   [管理员]
upcoming(pending) ──reject───▶ draft (记录驳回原因)          [管理员]

upcoming(approved) ──start──▶ active                         [主办方/管理员]
upcoming / active ──suspend──▶ suspended (记录 statusBeforeSuspend)
suspended ──resume──▶ statusBeforeSuspend
draft / upcoming / suspended(前态=upcoming) ──cancel──▶ cancelled
```

规则：

| 动作 | 允许前态 | 允许角色 | 额外条件 |
|---|---|---|---|
| `submit` | `draft` | Season Organizer / Admin | 九项 readiness 全过 |
| `approve` | `upcoming` + `approvedAt=null` | Admin | readiness 全过 |
| `reject` | `upcoming` + `approvedAt=null` | Admin | 原因 ≥ 2 字符 |
| `start` | `upcoming` + `approvedAt≠null` | Season Organizer / Admin | 当前时间 `>= startAt` |
| `suspend` | `upcoming` / `active` | Season Organizer / Admin | 记录 `statusBeforeSuspend` |
| `resume` | `suspended` | Season Organizer / Admin | 恢复前态 |
| `cancel` | `draft` / `upcoming` / `suspended` 且前态为 `upcoming` | Season Organizer / Admin | 原因 ≥ 2 字符；关闭积分池 |
| `pin` | `upcoming`/`active`/`suspended` 且 `approvedAt≠null` | Admin | 全平台唯一 |
| `clone` | 任意可管理赛季（含 `cancelled`） | Season Organizer / Admin | 生成新 `draft` |

`cancelled` 为终态；`active` 取消返回 `409 SEASON_ALREADY_STARTED`。

编辑窗口：

| 字段组 | 允许状态 | 说明 |
|---|---|---|
| 核心字段（`name/type/city/intro/themes/agreementVersion/awardingEntity`） | `draft` | `code` 永不可改 |
| `organizerOrgIds` | `draft`（主办方限自己的组织）；`upcoming` 起仅 Admin | 至少一个组织 |
| 赛程 | `draft` / `upcoming` / `active` / `suspended` | 递增 `rulesVersion`；已批准赛季可写公告 |
| 类型化规则 | `draft` / `upcoming` | 递增 `rulesVersion`；已批准赛季可写公告 |
| 规则卡 | `draft` / `upcoming` / `active` / `suspended` | 不递增 `rulesVersion`；可写公告 |
| 命题 | `draft` 起可用，`cancelled` 只读 | 发布后编辑递增命题 `version` |
| 预算/积分池/分配/核验员 | `draft` 起可用，`cancelled` 只读 | 只为 readiness |

### 3.2 Season Application

```text
submitted ──withdraw──▶ withdrawn ──reapply（窗口内）──▶ submitted
submitted ⇄ pending ⇄ waitlisted ⇄ rejected
    任意非 accepted ──accept──▶ accepted（终态，创建/关联 SeasonParticipant）
```

- 非 `accepted` 之间可自由流转。
- 仅 `submitted`（审核前）可由本人撤回为 `withdrawn`；进入审核流程后不可撤回。
- `withdrawn` 为待本人重新报名的状态，主办方不能直接改回其他状态；窗口内重新报名会复用同一条记录并重置审核字段。
- `accepted → 任意` 返回 `409 APPLICATION_STATUS_LOCKED`；`accepted → accepted` 幂等返回 200。
- 审核为 `rejected` 时必须提供 `reason` ≥ 2 字符；其他状态 `reason` 可选。
- 选手可在组队截止前自行退出赛季；报名记录仍保持 `accepted`，选手记录标记为 `withdrawn`。
- 设置了选手名额且组队截止前仍有空位时，选手退出会自动按候补队列顺序递补 `waitlisted` 报名。

### 3.3 WeChat Status

```text
not_invited ──invite──▶ invited ──join──▶ joined（终态）
                           │
                           └──fail──▶ failed ──invite──▶ invited
```

- 相同状态重复提交幂等返回 200。
- 其他非法跳转返回 `409 WECHAT_STATUS_INVALID`。
- `joined` 为终态。

### 3.4 Challenge

```text
draft ──reference──▶ reference
draft / reference ──publish──▶ published（五件套完整）
published ──close──▶ closed
published / closed ──archive──▶ archived
```

- `draft` / `reference` 可自由编辑。
- `published` 可编辑，但每次编辑 `version += 1` 并写审计。
- `closed` / `archived` 只读。
- 发布后不能回退到 `draft`。

## 4. 数据模型（Drizzle / MySQL 8）

通用约定：

- 使用 `int` 自增主键、`varchar(255)` 存 `user_id`、`timestamp` 存时间。
- 不建数据库外键，沿用现有 schema 的索引 + 应用层校验。
- 所有 `status` 字段为 `varchar(16)`，取值来自 `@shenicest/shared`。
- JSON 字段使用 `json().$type<...>()`。

### 4.1 `organizer_orgs`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `name` | varchar(100) | not null, unique |
| `created_at` | timestamp | not null default now |
| `updated_at` | timestamp | not null default now on update |

### 4.2 `organizer_org_members`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `org_id` | int | not null |
| `user_id` | varchar(255) | not null |
| `created_at` | timestamp | not null default now |

索引/唯一：

- `uniqueIndex('uq_organizer_org_members_org_user').on(orgId, userId)`
- `index('idx_organizer_org_members_user').on(userId)`

### 4.3 `season_organizers`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `season_id` | int | not null |
| `org_id` | int | not null |
| `created_at` | timestamp | not null default now |

索引/唯一：

- `uniqueIndex('uq_season_organizers_season_org').on(seasonId, orgId)`
- `index('idx_season_organizers_org').on(orgId)`

### 4.4 `seasons`

| 列 | 类型 | 约束/默认 |
|---|---|---|
| `id` | int | PK autoincrement |
| `code` | varchar(32) | not null, unique, `[A-Za-z0-9_-]{1,32}` |
| `name` | varchar(255) | not null, 2–255 |
| `type` | varchar(16) | not null default `'season'` |
| `city` | varchar(100) | null；`type=hackathon` 时必填 |
| `intro` | text | null |
| `themes` | json | `string[]`, not null default `[]` |
| `apply_open` | timestamp | null |
| `apply_close` | timestamp | null |
| `start_at` | timestamp | null |
| `team_deadline` | timestamp | null |
| `challenge_freeze_at` | timestamp | null |
| `work_deadline` | timestamp | null |
| `score_deadline` | timestamp | null |
| `settle_date` | timestamp | null |
| `status` | varchar(16) | not null default `'draft'` |
| `approved_at` | timestamp | null |
| `approved_by` | varchar(255) | null |
| `submitted_at` | timestamp | null |
| `rejected_at` | timestamp | null |
| `rejected_by` | varchar(255) | null |
| `rejection_reason` | text | null |
| `started_at` | timestamp | null |
| `suspended_at` | timestamp | null |
| `status_before_suspend` | varchar(16) | null |
| `resumed_at` | timestamp | null |
| `cancelled_at` | timestamp | null |
| `cancel_reason` | text | null |
| `pinned` | boolean | not null default false |
| `participant_capacity` | int | null；选手名额，空表示不限 |
| `awarding_entity` | varchar(255) | null |
| `agreement_version` | varchar(32) | not null default `'v1'` |
| `rules_version` | int | not null default 1 |
| `rules` | json | `SeasonRules`, not null |
| `created_by` | varchar(255) | not null |
| `created_at` | timestamp | not null default now |
| `updated_at` | timestamp | not null default now on update |

索引：

- `uniqueIndex('uq_seasons_code').on(code)`（MySQL 默认排序规则下大小写不敏感）
- `index('idx_seasons_status_start').on(status, startAt)`
- `index('idx_seasons_pinned').on(pinned)`
- `index('idx_seasons_approved').on(approvedAt)`

`SeasonRules`：

```ts
type SeasonRules = {
  maxChallengesPerProject: number   // 1–3, default 3
  maxProjectsPerParticipant: number // 1–20, default 1
  maxCoreMembers: number            // 1–3, default 3
  singleWorkCap: number             // integer >= 1, default 100
  exchangeRatio: number             // number > 0, default 1
  reviewThreshold: number           // number >= 0, default 50
  dailyQuotaEnabled: boolean        // default false
}
```

`SeasonSchedule`（API 聚合对象，DB 为独立列）：

```ts
type SeasonSchedule = {
  applyOpen: string
  applyClose: string
  startAt: string
  teamDeadline: string
  challengeFreezeAt: string
  workDeadline: string
  scoreDeadline: string
  settleDate: string
}
```

赛程校验：八个时间全部非空。以下六个时间点严格递增：
`applyOpen < applyClose < startAt < teamDeadline < scoreDeadline < settleDate`。
额外约束：`workDeadline <= scoreDeadline`、`challengeFreezeAt <= teamDeadline`。
允许编辑时整体替换；不允许只改一个导致顺序错误。

### 4.5 `season_rule_card_items`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `season_id` | int | not null |
| `key` | varchar(64) | not null |
| `label` | varchar(255) | not null |
| `value` | text | not null |
| `required` | boolean | not null default false |
| `visible` | boolean | not null default true |
| `sort_order` | int | not null default 0 |
| `created_at` | timestamp | not null default now |
| `updated_at` | timestamp | not null default now on update |

唯一：`uniqueIndex('uq_season_rule_card_season_key').on(seasonId, key)`。

必要项（创建赛季时自动种入，不可删除、不可隐藏）：

| key | label 默认 |
|---|---|
| `max_project_challenges` | 每个项目可选命题上限 |
| `max_projects_per_participant` | 每人最多参与项目数 |
| `max_core_members` | 团队核心成员上限 |
| `single_work_cap` | 单次评分上限 |
| `exchange_ratio` | 积分兑换比例 |
| `review_threshold` | 复核阈值 |
| `work_deadline` | 作品提交截止 |
| `score_deadline` | 评分截止 |
| `point_pool_and_awards` | 积分池与奖励口径 |
| `submission_requirements` | 提交要求 |
| `review_process` | 评审流程 |
| `milestone_rewards` | 阶段奖励 |
| `scoring_rewards` | 评分奖励 |

必要项的 `value` 可在创建后编辑；`required=true`、`visible=true` 不可改。可选条目 `key` 不得与必要项冲突，`required=false`，可增删排序。

### 4.6 `season_announcements`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `season_id` | int | not null |
| `title` | varchar(255) | not null, 2–255 |
| `content` | text | not null, 1–5000 |
| `category` | varchar(16) | not null default `'general'` |
| `created_by` | varchar(255) | not null |
| `created_at` | timestamp | not null default now |

索引：`index('idx_season_announcements_season_created').on(seasonId, createdAt)`。

### 4.7 `audit_logs`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `actor_user_id` | varchar(255) | not null |
| `action` | varchar(64) | not null |
| `target_type` | varchar(32) | not null |
| `target_id` | varchar(64) | not null |
| `season_id` | int | null |
| `detail` | json | null |
| `created_at` | timestamp | not null default now |

索引：

- `index('idx_audit_logs_season_created').on(seasonId, createdAt)`
- `index('idx_audit_logs_actor').on(actorUserId)`
- `index('idx_audit_logs_action').on(action)`

`target_type` 取值：`organizer_org` / `season` / `application` / `participant` / `challenge` / `budget` / `point_pool` / `point_allocation` / `verifier_grant`。

动作命名：`season.created`、`season.updated`、`season.schedule_updated`、`season.rules_updated`、`season.rule_card_updated`、`season.organizers_updated`、`season.announcement_created`、`season.submitted`、`season.approved`、`season.rejected`、`season.started`、`season.suspended`、`season.resumed`、`season.cancelled`、`season.cloned`、`season.pinned`、`season.unpinned`、`application.submitted`、`application.withdrawn`、`application.status_changed`、`application.promoted`、`participant.withdrawn`、`participant.wechat_changed`、`challenge.created`、`challenge.updated`、`challenge.published`、`challenge.closed`、`challenge.archived`、`challenge.referenced`、`budget.added`、`point_pool.added`、`allocation.assigned`、`allocation.reclaimed`、`verifier.granted`、`verifier.revoked`、`organizer_org.created`、`organizer_org.updated`、`organizer_org.deleted`、`organizer_member.added`、`organizer_member.removed`。

### 4.8 `season_applications`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `season_id` | int | not null |
| `user_id` | varchar(255) | not null |
| `skills` | text | not null |
| `experience` | text | not null |
| `themes` | json | `string[]`, not null default `[]` |
| `team_intent` | text | not null |
| `accepts_solo` | boolean | not null |
| `availability` | text | not null |
| `city_mode` | text | not null |
| `contact_encrypted` | text | not null |
| `visibility` | varchar(16) | not null default `'organizer_only'` |
| `agreement_version` | varchar(32) | not null |
| `status` | varchar(16) | not null default `'submitted'` |
| `reviewed_by` | varchar(255) | null |
| `review_reason` | text | null |
| `reviewed_at` | timestamp | null |
| `withdrawn_at` | timestamp | null |
| `created_at` | timestamp | not null default now |
| `updated_at` | timestamp | not null default now on update |

索引/唯一：

- `uniqueIndex('uq_season_applications_season_user').on(seasonId, userId)`
- `index('idx_season_applications_season_status').on(seasonId, status)`
- `index('idx_season_applications_user').on(userId)`

### 4.9 `season_participants`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `season_id` | int | not null |
| `user_id` | varchar(255) | not null |
| `application_id` | int | not null |
| `wechat_status` | varchar(16) | not null default `'not_invited'` |
| `wechat_invited_by` | varchar(255) | null |
| `wechat_invited_at` | timestamp | null |
| `joined_at` | timestamp | null |
| `status` | varchar(16) | not null default `'active'` |
| `withdrawn_at` | timestamp | null |
| `withdrawn_by` | varchar(255) | null |
| `withdraw_reason` | text | null |
| `created_at` | timestamp | not null default now |
| `updated_at` | timestamp | not null default now on update |

索引/唯一：

- `uniqueIndex('uq_season_participants_season_user').on(seasonId, userId)`
- `uniqueIndex('uq_season_participants_application').on(applicationId)`
- `index('idx_season_participants_season_wechat').on(seasonId, wechatStatus)`
- `index('idx_season_participants_season_status').on(seasonId, status)`

### 4.10 `challenges`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `season_id` | int | not null |
| `title` | varchar(255) | not null, 2–255 |
| `real_problem` | text | null |
| `target_customer` | text | null |
| `minimum_deliverable` | text | null |
| `resource_commitment` | text | null |
| `result_evidence_rules` | text | null |
| `status` | varchar(16) | not null default `'draft'` |
| `version` | int | not null default 1 |
| `created_by` | varchar(255) | not null |
| `created_at` | timestamp | not null default now |
| `updated_at` | timestamp | not null default now on update |

索引：`index('idx_challenges_season_status').on(seasonId, status)`。

### 4.11 `season_budgets`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `season_id` | int | not null |
| `version` | int | not null |
| `total_amount` | int | not null, 金额（元），> 0 |
| `status` | varchar(16) | not null default `'active'` |
| `reason` | varchar(255) | not null, ≥ 6 字符 |
| `created_by` | varchar(255) | not null |
| `created_at` | timestamp | not null default now |

索引/唯一：

- `uniqueIndex('uq_season_budgets_season_version').on(seasonId, version)`
- `index('idx_season_budgets_season_status').on(seasonId, status)`

不变量：每个赛季最多一条 `active`；新版本金额必须大于当前 active 金额。

### 4.12 `season_point_pools`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `season_id` | int | not null, unique |
| `total_points` | int | not null default 0 |
| `allocated_points` | int | not null default 0 |
| `used_points` | int | not null default 0 |
| `version` | int | not null default 1 |
| `status` | varchar(16) | not null default `'active'` |
| `created_by` | varchar(255) | null |
| `created_at` | timestamp | not null default now |
| `updated_at` | timestamp | not null default now on update |

索引/唯一：`uniqueIndex('uq_season_point_pools_season').on(seasonId)`。

不变量：`0 <= allocated_points <= total_points`；`0 <= used_points <= allocated_points`。

### 4.13 `point_allocations`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `season_id` | int | not null |
| `pool_id` | int | not null |
| `scorer_user_id` | varchar(255) | not null |
| `amount` | int | not null, > 0 |
| `used_amount` | int | not null default 0 |
| `status` | varchar(16) | not null default `'active'` |
| `created_by` | varchar(255) | not null |
| `created_at` | timestamp | not null default now |
| `updated_at` | timestamp | not null default now on update |

索引/唯一：

- `uniqueIndex('uq_point_allocations_season_scorer').on(seasonId, scorerUserId)`
- `index('idx_point_allocations_season_status').on(seasonId, status)`

不变量：`0 <= used_amount <= amount`；所有 active 分配的 `amount` 之和 ≤ `pool.total_points`。

### 4.14 `season_verifier_grants`

| 列 | 类型 | 约束 |
|---|---|---|
| `id` | int | PK autoincrement |
| `season_id` | int | not null |
| `user_id` | varchar(255) | not null |
| `status` | varchar(16) | not null default `'active'` |
| `granted_by` | varchar(255) | not null |
| `granted_at` | timestamp | not null default now |
| `revoked_by` | varchar(255) | null |
| `revoked_at` | timestamp | null |
| `revoke_reason` | text | null |
| `created_at` | timestamp | not null default now |
| `updated_at` | timestamp | not null default now on update |

索引/唯一：

- `uniqueIndex('uq_season_verifier_grants_season_user').on(seasonId, userId)`
- `index('idx_season_verifier_grants_season_status').on(seasonId, status)`

## 5. 发布就绪（Readiness）

```ts
type ReadinessCheck = {
  key: string
  label: string
  passed: boolean
  detail?: string
}

type Readiness = {
  seasonId: number
  ready: boolean
  checks: ReadinessCheck[]
  generatedAt: string
}
```

九项检查，全部硬校验：

| key | label | 通过条件 |
|---|---|---|
| `schedule` | 赛程完整 | 八个时间非空，六个主时间点严格递增，并满足作品/命题冻结约束 |
| `challenges` | 至少一个已发布命题 | `published` 命题数 ≥ 1 |
| `budget` | 预算已配置 | 存在 active 预算且 `total_amount > 0` |
| `point_pool` | 积分池已充值 | `total_points > 0` |
| `scorers` | 至少一名评委已分配积分 | active 分配数 ≥ 1 |
| `verifiers` | 至少一名核验员 | active 授权数 ≥ 1 |
| `rules` | 规则与协议完整 | `rules` 全部字段合法，`agreement_version` 非空 |
| `organizers` | 主办方组织有效 | 至少一个关联组织，且该组织至少一名成员 |
| `awarding_entity` | 授奖主体已填写 | `awarding_entity` 去空格后非空 |

- `submit` 与 `approve` 都重新计算 readiness；失败返回 `409 SEASON_NOT_READY`，响应 `error.detail` 带完整 `checks`。
- `start` 不重新计算 readiness，只要求 `approvedAt` 非空。
- 复制赛季、编辑配置后 readiness 会变化；前端在管理页实时展示。

## 6. 接口

### 6.1 主办方组织

#### `GET /organizer-orgs`

- 认证：登录用户。
- 说明：返回所有组织及当前用户是否为成员。组织名称本身是公开信息（会出现在赛季详情）。
- 响应：

```ts
type OrganizerOrgSummary = {
  id: number
  name: string
  memberCount: number
  isMember: boolean
  createdAt: string
}
```

#### `GET /organizer-orgs/:id/members`

- 认证：该组织成员或 Platform Admin。
- 响应：

```ts
type OrganizerMember = {
  userId: string
  name: string | null
  avatarUrl: string | null
  joinedAt: string
}
```

#### `POST /admin/organizer-orgs`

- 认证：Platform Admin。
- 请求：`{ name: string }`（2–100，全局唯一）。
- 响应 `201`：`OrganizerOrgSummary`。
- 审计：`organizer_org.created`。
- 错误：`ORGANIZER_ORG_NAME_TAKEN`。

#### `PATCH /admin/organizer-orgs/:id`

- 认证：Platform Admin。
- 请求：`{ name: string }`。
- 响应：`OrganizerOrgSummary`。
- 审计：`organizer_org.updated`。

#### `DELETE /admin/organizer-orgs/:id`

- 认证：Platform Admin。
- 约束：没有赛季关联该组织；否则 `409 ORGANIZER_ORG_IN_USE`。
- 响应：`204`。
- 审计：`organizer_org.deleted`。

#### `POST /admin/organizer-orgs/:id/members`

- 认证：Platform Admin。
- 请求：`{ userId: string }`。
- 校验用户存在；重复返回 `409 ORGANIZER_MEMBER_EXISTS`。
- 响应 `201`：`OrganizerMember`。
- 审计：`organizer_member.added`。

#### `DELETE /admin/organizer-orgs/:id/members/:userId`

- 认证：Platform Admin。
- 约束：若该组织关联了未取消赛季且这是最后一名成员，返回 `409 ORGANIZER_ORG_LAST_MEMBER`；先补齐成员或移除赛季关联。
- 响应：`204`。
- 审计：`organizer_member.removed`。

### 6.2 公开赛季

#### `GET /seasons`

- 认证：可选。
- 说明：只返回 `approved_at != null`、`status != 'cancelled'` 的赛季；`draft` / 待批不出现。
- Query：

```ts
type ListSeasonsQuery = PaginationQuery & {
  status?: string        // 逗号分隔，默认 upcoming,active,suspended
  type?: 'season' | 'hackathon'
  city?: string
  theme?: string         // 匹配 themes JSON 数组
  q?: string             // 匹配 name/code
}
```

- 排序：`pinned DESC`，然后 `status` 顺序 `active → upcoming → suspended`，再 `start_at ASC`，最后 `id DESC`。
- 响应：`Paginated<SeasonSummary>`。

```ts
type SeasonSummary = {
  id: number
  code: string
  name: string
  type: SeasonType
  city: string | null
  status: SeasonStatus
  themes: string[]
  schedule: SeasonSchedule | null
  organizerOrgs: Array<{ id: number; name: string }>
  pinned: boolean
  approvedAt: string | null
  participantCapacity: number | null
  participantCount: number
  publishedChallengeCount: number
}
```

#### `GET /seasons/:id`

- 认证：可选。
- 说明：仅已批准且未取消的赛季公开；否则 `404 SEASON_NOT_FOUND`。
- 响应 `SeasonDetail`：

```ts
type SeasonDetail = SeasonSummary & {
  intro: string | null
  ruleCard: RuleCardItem[]
  rulesVersion: number
  awardingEntity: string | null
  startedAt: string | null
  applicationWindow: {
    opensAt: string | null
    closesAt: string | null
    isOpen: boolean
  }
  createdAt: string
  updatedAt: string
}
```

`isOpen` 为时间与状态推导，不包含当前用户是否已报名；用户态通过 `GET /me/applications` 获取。

#### `GET /seasons/:id/announcements`

- 认证：可选；非公开赛季需 Season Organizer / Admin。
- 响应：`{ items: Announcement[] }`，按 `createdAt DESC`。

```ts
type Announcement = {
  id: number
  seasonId: number
  title: string
  content: string
  category: AnnouncementCategory
  createdBy: string
  createdAt: string
}
```

#### `GET /seasons/:id/challenges`

- 认证：可选。
- 公开：只返回 `published` / `closed`（`archived` 不公开）。
- Season Organizer / Admin 可加 `?includeDrafts=true` 返回全部状态。
- 响应：`{ items: Challenge[] }`，按 `createdAt DESC`。

### 6.3 赛季管理

#### `POST /seasons`

- 认证：Season Organizer（`organizerOrgIds` 必须是自己的组织）或 Platform Admin。
- 请求：

```ts
type CreateSeasonBody = {
  code: string
  name: string
  type?: SeasonType                  // default 'season'
  city?: string | null
  intro?: string | null
  themes?: string[]                  // default []
  schedule?: SeasonSchedule | null
  rules?: Partial<SeasonRules>
  organizerOrgIds: number[]
  agreementVersion?: string          // default 'v1'
  awardingEntity?: string | null
  participantCapacity?: number | null // 空表示不限
}
```

- 校验：
  - `code` 唯一、1–32、`[A-Za-z0-9_-]`。
  - `name` 2–255。
  - `type=hackathon` 时 `city` 必填。
  - `organizerOrgIds` 非空、去重、组织存在；主办方创建时必须是这些组织的成员。
  - `schedule` 若提供，必须完整且严格递增。
  - `rules` 合并默认值后合法。
  - `themes` 每项 1–50 字符，去重，最多 20 个。
  - `participantCapacity` 若提供必须为正整数。
- 副作用：
  - 创建 `seasons`（`status=draft`，`rules_version=1`）。
  - 创建 `season_organizers`。
  - 创建 `season_point_pools`（`total=0, allocated=0, used=0, version=1`）。
  - 种入十三个必要规则卡条目，`value` 从 `rules` / `schedule` 生成可读文本（提交要求 / 评审流程 / 阶段奖励 / 评分奖励使用默认文案，创建后可在规则卡中编辑）。
  - 写 `audit_logs`：`season.created`。
- 响应 `201`：`SeasonManageDetail`。
- 错误：`SEASON_CODE_TAKEN`、`ORGANIZER_ORG_NOT_FOUND`、`NOT_SEASON_ORGANIZER`、`SCHEDULE_INVALID`、`RULES_INVALID`、`VALIDATION_ERROR`。

#### `GET /organizer/seasons`

- 认证：登录用户。
- 说明：返回当前用户作为成员的组织所主办的赛季；Platform Admin 返回全部。
- Query：`status?`、`pendingApproval?`。
- 响应：`Paginated<SeasonManageSummary>`。

```ts
type SeasonManageSummary = SeasonSummary & {
  pendingApproval: boolean
  readinessReady: boolean
  applicationCount: number
  acceptedCount: number
}
```

#### `GET /admin/seasons`

- 认证：Platform Admin。
- 说明：全部赛季；Query 同 `GET /organizer/seasons`，额外支持 `status=cancelled`。
- 响应：`Paginated<SeasonManageSummary>`。

#### `GET /seasons/:id/manage`

- 认证：Season Organizer / Platform Admin。
- 响应 `SeasonManageDetail`：

```ts
type SeasonManageDetail = SeasonDetail & {
  rules: SeasonRules
  organizerOrgIds: number[]
  pendingApproval: boolean
  rejection: {
    reason: string
    at: string
    by: string
  } | null
  timestamps: {
    submittedAt: string | null
    approvedAt: string | null
    approvedBy: string | null
    startedAt: string | null
    suspendedAt: string | null
    statusBeforeSuspend: SeasonStatus | null
    resumedAt: string | null
    cancelledAt: string | null
    cancelReason: string | null
  }
  createdAt: string
  updatedAt: string
}
```

- 非公开赛季也可以读；`cancelled` 也可读。

#### `PATCH /seasons/:id`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`draft`。
- 请求：`name`、`type`、`city`、`intro`、`themes`、`agreementVersion`、`awardingEntity`、`participantCapacity` 的任意子集；不允许 `code`、`status`、`createdBy`、`organizerOrgIds`（组织关联用 `PUT /seasons/:id/organizers`）。
- 审计：`season.updated`。
- 响应：`SeasonManageDetail`。

#### `PUT /seasons/:id/schedule`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`draft` / `upcoming` / `active` / `suspended`。
- 请求：

```ts
type UpdateScheduleBody = {
  schedule: SeasonSchedule
  announcement?: { title?: string; content?: string }
}
```

- 校验八个时间非空、六个主时间点严格递增，以及 `workDeadline <= scoreDeadline`、`challengeFreezeAt <= teamDeadline`；否则 `400 SCHEDULE_INVALID`。
- 副作用：
  - 更新七列；`rules_version += 1`。
  - 写 `audit_logs`：`season.schedule_updated`（detail 含 before/after）。
  - 若赛季已批准（`approvedAt != null`）：创建公告。未提供 `announcement` 时生成自动摘要；提供时标题/内容必须非空。
- 响应：`SeasonManageDetail`。

#### `PUT /seasons/:id/rules`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`draft` / `upcoming`。
- 请求：

```ts
type UpdateRulesBody = {
  rules: SeasonRules
  announcement?: { title?: string; content?: string }
}
```

- 校验范围；`rules_version += 1`；审计 `season.rules_updated`；已批准时写公告（同上）。
- 响应：`SeasonManageDetail`。

#### `PUT /seasons/:id/rule-card`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`draft` / `upcoming` / `active` / `suspended`。
- 请求：

```ts
type UpdateRuleCardBody = {
  items: Array<{
    key: string
    label: string
    value: string
    visible?: boolean   // default true
  }>
  announcement?: { title?: string; content?: string }
}
```

- 数组顺序即展示顺序；服务端写入 `sort_order = index`。
- 校验：
  - 九个必要项必须全部出现，且 `visible !== false`；否则 `400 RULE_CARD_REQUIRED_ITEM`。
  - `key` 唯一；`label` 1–255；`value` 非空。
  - 可选条目可增删。
- 副作用：替换该赛季全部规则卡条目；审计 `season.rule_card_updated`；已批准时可选公告。不改变 `rules_version`。
- 响应：`{ items: RuleCardItem[] }`。

#### `PUT /seasons/:id/organizers`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`draft`（主办方/Admin）；`upcoming` 起仅 Admin。
- 请求：`{ organizerOrgIds: number[] }`（非空、去重、组织存在；主办方限自己的组织）。
- 副作用：替换 `season_organizers`；审计 `season.organizers_updated`。
- 响应：`{ organizerOrgs: Array<{ id: number; name: string }> }`。

#### `POST /seasons/:id/submit`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`draft`。
- 行为：
  - 计算 readiness；失败 `409 SEASON_NOT_READY`（`error.detail.checks`）。
  - 设置 `status=upcoming`、`submitted_at=now`、清空 `rejected_*`。
  - 若操作者是 Platform Admin：同时 `approved_at=now`、`approved_by=actor`。
  - 若操作者是主办方：`approved_at=null`。
  - 审计 `season.submitted`；Admin 自动批准再写 `season.approved`。
- 响应：`SeasonManageDetail`。

#### `POST /seasons/:id/approve`

- 认证：Platform Admin。
- 允许状态：`upcoming` 且 `approvedAt=null`；否则 `409 SEASON_NOT_PENDING`。
- 重新计算 readiness；失败 `409 SEASON_NOT_READY`。
- 设置 `approved_at=now`、`approved_by=actor`；审计 `season.approved`。
- 响应：`SeasonManageDetail`。

#### `POST /seasons/:id/reject`

- 认证：Platform Admin。
- 允许状态：`upcoming` 且 `approvedAt=null`。
- 请求：`{ reason: string }`（≥ 2 字符）。
- 设置 `status=draft`、`rejected_at=now`、`rejected_by=actor`、`rejection_reason=reason`、`approved_at=null`；审计 `season.rejected`。
- 响应：`SeasonManageDetail`。

#### `POST /seasons/:id/start`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`upcoming` 且 `approvedAt != null`；否则 `409 SEASON_NOT_APPROVED`。
- 设置 `status=active`、`started_at=now`；审计 `season.started`。
- 当前时间必须 `>= startAt`，否则返回 `409 SEASON_NOT_STARTED`。
- 响应：`SeasonManageDetail`。

#### `POST /seasons/:id/suspend`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`upcoming` / `active`；否则 `409 SEASON_INVALID_STATUS`。
- 设置 `status_before_suspend=当前状态`、`status=suspended`、`suspended_at=now`；审计 `season.suspended`。
- 暂停期间报名关闭；已提交报名仍可审核。
- 响应：`SeasonManageDetail`。

#### `POST /seasons/:id/resume`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`suspended`。
- 设置 `status=status_before_suspend`、`resumed_at=now`、清空 `status_before_suspend`；审计 `season.resumed`。
- 响应：`SeasonManageDetail`。

#### `POST /seasons/:id/cancel`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`draft` / `upcoming` / `suspended` 且前态为 `upcoming`。
- 请求：`{ reason: string }`（≥ 2 字符）。
- 设置 `status=cancelled`、`cancelled_at=now`、`cancel_reason=reason`；`pinned=false`；积分池 `status=closed`。
- 若当前是 `active`，返回 `409 SEASON_ALREADY_STARTED`（开赛后取消不在本批）。
- 审计 `season.cancelled`。
- 响应：`SeasonManageDetail`。

#### `POST /seasons/:id/clone`

- 认证：Season Organizer / Platform Admin。
- 请求：`{ code: string; name?: string }`。
- 复制：`type/city/intro/themes/rules/rule_card/awarding_entity/agreement_version/organizer_org_ids`。
- 清空：赛程七列、`approved_*`、`submitted_*`、`rejected_*`、`started_*`、`suspended_*`、`cancelled_*`、`pinned`。
- 不复制：预算、积分池余额/分配、核验员、命题、报名、选手、公告、审计。
- 新赛季：`status=draft`、`rules_version=1`、`name` 默认为 `${source.name}（副本）`；创建空积分池（`total=0`）；种入必要规则卡（复制来源的 label/value）。
- 审计 `season.cloned`。
- 响应 `201`：`SeasonManageDetail`。
- 错误：`SEASON_CODE_TAKEN`。

#### `PUT /seasons/:id/pin`

- 认证：Platform Admin。
- 请求：`{ pinned: boolean }`。
- `pinned=true` 时要求 `approvedAt != null`、`status != cancelled`；否则 `409 PIN_NOT_ALLOWED`。
- 事务：`pinned=true` 先把所有赛季 `pinned=false`，再置目标；`pinned=false` 直接置 false。
- 审计 `season.pinned` / `season.unpinned`。
- 响应：`SeasonSummary`。

#### `GET /seasons/:id/readiness`

- 认证：Season Organizer / Platform Admin。
- 响应：`Readiness`。

#### `POST /seasons/:id/announcements`

- 认证：Season Organizer / Platform Admin。
- 允许状态：已批准（`approvedAt != null`）且未取消。
- 请求：`{ title: string; content: string; category?: AnnouncementCategory }`。
- 审计 `season.announcement_created`（可按需补充到动作表）。
- 响应 `201`：`Announcement`。

#### `GET /seasons/:id/audit-logs`

- 认证：Season Organizer / Platform Admin。
- Query：`action?`、`targetType?`、`targetId?`、`page?`、`pageSize?`。
- 响应：`Paginated<AuditLog>`。

```ts
type AuditLog = {
  id: number
  actorUserId: string
  actorName: string | null
  action: string
  targetType: string
  targetId: string
  seasonId: number | null
  detail: unknown
  createdAt: string
}
```

### 6.4 命题

#### `GET /seasons/:id/challenges`

见 6.2。管理端加 `includeDrafts=true`。

冻结规则：当前时间 `>= challengeFreezeAt` 后，禁止新增命题、关闭命题、归档命题；`PATCH /challenges/:id` 仍可编辑并生成新版本。

#### `GET /challenges/:id`

- 认证：可选。
- `published` / `closed` 公开；`draft` / `reference` / `archived` 仅 Season Organizer / Admin。
- 响应：`Challenge`。

```ts
type Challenge = {
  id: number
  seasonId: number
  title: string
  realProblem: string | null
  targetCustomer: string | null
  minimumDeliverable: string | null
  resourceCommitment: string | null
  resultEvidenceRules: string | null
  status: ChallengeStatus
  version: number
  createdBy: string
  createdAt: string
  updatedAt: string
}
```

#### `POST /seasons/:id/challenges`

- 认证：Season Organizer / Platform Admin。
- 请求：`{ title: string }` + 五件套可选字段。
- 创建 `status=draft`、`version=1`；审计 `challenge.created`。
- 响应 `201`：`Challenge`。

#### `PATCH /challenges/:id`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`draft` / `reference` / `published`（`published` 编辑会 `version += 1`）；`closed` / `archived` 返回 `409 CHALLENGE_STATUS_LOCKED`。
- 请求：`title` 与五件套任意子集。
- 审计 `challenge.updated`。
- 响应：`Challenge`。

#### `POST /challenges/:id/reference`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`draft`。
- 设置 `status=reference`；审计 `challenge.referenced`。
- 响应：`Challenge`。

#### `POST /challenges/:id/publish`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`draft` / `reference`。
- 校验五件套全部非空；失败 `409 CHALLENGE_INCOMPLETE`，`error.detail.missing` 列出缺失字段。
- 设置 `status=published`；审计 `challenge.published`。
- 响应：`Challenge`。

#### `POST /challenges/:id/close`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`published`；`status=closed`；审计 `challenge.closed`。
- 响应：`Challenge`。

#### `POST /challenges/:id/archive`

- 认证：Season Organizer / Platform Admin。
- 允许状态：`published` / `closed`；`status=archived`；审计 `challenge.archived`。
- 响应：`Challenge`。

### 6.5 预算

#### `GET /seasons/:id/budgets`

- 认证：Season Organizer / Platform Admin。
- 响应：`{ items: BudgetVersion[] }`，按 `version DESC`。

```ts
type BudgetVersion = {
  id: number
  seasonId: number
  version: number
  totalAmount: number
  status: BudgetStatus
  reason: string
  createdBy: string
  createdAt: string
}
```

#### `POST /seasons/:id/budgets`

- 认证：Season Organizer / Platform Admin。
- 允许状态：未取消。
- 请求：`{ totalAmount: number; reason: string }`。
- 校验：`totalAmount` 为正整数；`reason` ≥ 6 字符；若已有 active 预算，`totalAmount > active.totalAmount`（否则 `409 BUDGET_NOT_INCREASING`）。
- 事务：当前 active → `superseded`；插入新 active，`version = max(version)+1`。
- 审计 `budget.added`（detail 含 old/new）。
- 响应 `201`：`BudgetVersion`。

### 6.6 积分池

#### `GET /seasons/:id/point-pool`

- 认证：Season Organizer / Platform Admin。
- 响应：

```ts
type PointPool = {
  seasonId: number
  totalPoints: number
  allocatedPoints: number
  usedPoints: number
  unallocatedPoints: number
  version: number
  status: PointPoolStatus
  updatedAt: string
}
```

#### `POST /seasons/:id/point-pool`

- 认证：Season Organizer / Platform Admin。
- 允许状态：pool `active` 且赛季未取消。
- 请求：`{ addPoints: number }`（正整数）。
- 行为：`total_points += addPoints`；`version += 1`；审计 `point_pool.added`。
- 响应：`PointPool`。

### 6.7 评委积分分配

#### `GET /seasons/:id/allocations`

- 认证：Season Organizer / Platform Admin。
- 响应：`{ items: PointAllocation[] }`。

```ts
type PointAllocation = {
  id: number
  seasonId: number
  scorerUserId: string
  amount: number
  usedAmount: number
  remaining: number
  status: PointAllocationStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}
```

#### `POST /seasons/:id/allocations`

- 认证：Season Organizer / Platform Admin。
- 请求：`{ scorerUserId: string; amount: number }`。
- 校验：
  - 用户存在。
  - `amount > 0`。
  - `pool.allocated_points + amount <= pool.total_points`；否则 `409 POOL_EXCEEDED`。
  - 同赛季同评委已有 active 分配 → `409 ALLOCATION_EXISTS`。
  - 若已有 reclaimed 分配，则复用该行：`amount = 新值`、`used_amount = 0`、`status = active`，并相应增加池的 `allocated_points`。
- 审计 `allocation.assigned`。
- 响应 `201`：`PointAllocation`。

#### `POST /seasons/:id/allocations/:allocationId/reclaim`

- 认证：Season Organizer / Platform Admin。
- 请求：`{ reason: string }`（≥ 2 字符）。
- 允许状态：`active`；否则 `409 ALLOCATION_ALREADY_RECLAIMED`。
- 行为：`status = reclaimed`；`pool.allocated_points -= (amount - used_amount)`；审计 `allocation.reclaimed`。
- 响应：`PointAllocation`。

### 6.8 核验员

#### `GET /seasons/:id/verifiers`

- 认证：Season Organizer / Platform Admin。
- 响应：`{ items: VerifierGrant[] }`。

```ts
type VerifierGrant = {
  id: number
  seasonId: number
  userId: string
  status: VerifierGrantStatus
  grantedBy: string
  grantedAt: string
  revokedBy: string | null
  revokedAt: string | null
  revokeReason: string | null
}
```

#### `POST /seasons/:id/verifiers`

- 认证：Season Organizer / Platform Admin。
- 请求：`{ userId: string }`。
- 校验用户存在。
- 已有 active → `409 VERIFIER_ALREADY_ACTIVE`。
- 已有 revoked → 复用该行，重置为 active，清空撤销字段。
- 审计 `verifier.granted`。
- 响应 `201`：`VerifierGrant`。

#### `POST /seasons/:id/verifiers/:userId/revoke`

- 认证：Season Organizer / Platform Admin。
- 请求：`{ reason: string }`（≥ 2 字符）。
- 允许状态：`active`；否则 `409 VERIFIER_ALREADY_REVOKED`。
- 设置 `status=revoked`、`revoked_by/at/reason`；审计 `verifier.revoked`。
- 响应：`VerifierGrant`。

### 6.9 报名

#### `POST /seasons/:id/applications`

- 认证：登录用户。
- 准入：
  - 赛季 `approvedAt != null`。
  - `status` 为 `upcoming` 或 `active`。
  - 当前时间在 `[applyOpen, applyClose]` 内。
  - 未暂停、未取消。
  - 该用户在该赛季没有报名；若仅有 `withdrawn` 报名，则复用该记录重新报名。
  - 该用户不是该赛季选手。
- 请求：

```ts
type CreateApplicationBody = {
  skills: string          // 1–2000
  experience: string      // 1–4000
  themes: string[]        // 0–3，必须是赛季 themes 的子集
  teamIntent: string      // 1–1000
  acceptsSolo: boolean
  availability: string    // 1–500
  cityMode: string        // 1–200
  contact: {
    wechat?: string       // 1–100
    phone?: string        // 1–50
  }
  visibility?: ApplicationVisibility // default 'organizer_only'
  agreementVersion: string
}
```

- 校验：
  - `contact.wechat` 与 `contact.phone` 至少一个非空；否则 `400 CONTACT_REQUIRED`。
  - `agreementVersion` 必须等于赛季当前值；否则 `409 AGREEMENT_VERSION_MISMATCH`。
  - `themes` 必须是赛季 `themes` 的子集；否则 `400 APPLICATION_THEME_INVALID`。
- 副作用：
  - 加密联系方式。
  - 插入 `season_applications`，`status=submitted`。
  - 审计 `application.submitted`（detail 不含联系方式明文/密文）。
- 响应 `201`：`SeasonApplication`（本人视图，含解密后的 `contact`）。
- 错误：`APPLICATION_WINDOW_CLOSED`、`APPLICATION_DUPLICATED`、`ALREADY_PARTICIPANT`、`SEASON_SUSPENDED`、`SEASON_CANCELLED`。
- 重新报名：`withdrawn` 记录会被更新，`status=submitted`，清空 `reviewed_by/reviewed_at/review_reason/withdrawn_at`；审计 detail 标 `reapplied=true`。

#### `POST /applications/:id/withdraw`

- 认证：本人。
- 允许状态：仅 `submitted`（审核前）。
- 行为：`status=withdrawn`、写 `withdrawn_at`；审计 `application.withdrawn`。
- 响应：`SeasonApplication`（本人视图，含 `contact`）。
- 错误：`FORBIDDEN`（非本人）、`APPLICATION_WITHDRAW_LOCKED`（已进入审核流程）。

#### `GET /me/applications`

- 认证：登录用户。
- Query：`seasonId?`、`page?`、`pageSize?`。
- 响应：`Paginated<MyApplication>`。

```ts
type MyApplication = {
  application: SeasonApplication
  season: SeasonSummary
  wechatStatus: WechatStatus | null   // 未成为选手时为 null
}
```

#### `GET /applications/:id`

- 认证：本人 / Season Organizer / Platform Admin。
- 响应：`SeasonApplication`。
- 本人：返回解密后的 `contact`。
- 主办方/Admin：返回解密后的 `contact` + `applicant` 公开资料。
- 其他人：`403 FORBIDDEN`。

```ts
type SeasonApplication = {
  id: number
  seasonId: number
  userId: string
  skills: string
  experience: string
  themes: string[]
  teamIntent: string
  acceptsSolo: boolean
  availability: string
  cityMode: string
  visibility: ApplicationVisibility
  agreementVersion: string
  status: SeasonApplicationStatus
  reviewedBy: string | null
  reviewReason: string | null
  reviewedAt: string | null
  withdrawnAt: string | null
  contact: { wechat?: string; phone?: string } | null
  applicant?: {
    userId: string
    name: string | null
    avatarUrl: string | null
  }
  createdAt: string
  updatedAt: string
}
```

#### `GET /seasons/:id/applications`

- 认证：Season Organizer / Platform Admin。
- Query：`status?`、`visibility?`、`q?`（匹配技能/经历）、`page?`、`pageSize?`。
- 响应：`Paginated<ApplicationListItem>`。

```ts
type ApplicationListItem = Omit<SeasonApplication, 'contact'> & {
  contactMasked: string | null
}
```

- 列表不返回完整联系方式；点击详情再取。
- `contactMasked` 规则：微信保留前 2 后 2，手机保留前 3 后 4，中间用 `***`；只有一个时只掩码该字段。

#### `PATCH /applications/:id/status`

- 认证：Season Organizer / Platform Admin。
- 请求：`{ status: SeasonApplicationStatus; reason?: string }`。
- 规则：
  - 当前 `withdrawn` → `409 APPLICATION_WITHDRAW_LOCKED`（须本人重新报名）。
  - 当前 `accepted` 且目标不是 `accepted` → `409 APPLICATION_STATUS_LOCKED`。
  - 当前 `accepted` 且目标 `accepted` → 幂等 200。
  - 目标 `rejected` 时 `reason` 必填（≥ 2 字符）。
  - 任意非 `accepted` → `accepted`：事务内更新报名状态并创建/关联 `season_participants`；若已有选手记录，复用并关联当前 `application_id`。
  - 赛季设置了 `participantCapacity` 且当前 `active` 选手已满：
    - 组队截止前，接受操作自动降级为 `waitlisted`（按 `reviewed_at ASC, id ASC` 排队）；
    - 组队截止后返回 `409 CAPACITY_FULL`。
- 副作用：
  - 更新 `reviewed_by`、`reviewed_at`、`review_reason = reason ?? null`（离开 `rejected` 时不保留旧原因；历史在审计里）。
  - 审计 `application.status_changed`（detail 含 from/to/reason）。
- 响应：`SeasonApplication`（管理视图，含 `contact` 与 `applicant`）。

#### `GET /seasons/:id/participants`

- 认证：Season Organizer / Platform Admin。
- Query：`status?`、`wechatStatus?`、`q?`、`page?`、`pageSize?`。
- 响应：`Paginated<SeasonParticipant>`。

```ts
type SeasonParticipant = {
  id: number
  seasonId: number
  userId: string
  applicationId: number
  wechatStatus: WechatStatus
  wechatInvitedBy: string | null
  wechatInvitedAt: string | null
  joinedAt: string | null
  status: SeasonParticipantStatus
  withdrawnAt: string | null
  withdrawnBy: string | null
  withdrawReason: string | null
  applicant: {
    userId: string
    name: string | null
    avatarUrl: string | null
  }
  createdAt: string
  updatedAt: string
}
```

#### `POST /seasons/:id/participants/:userId/withdraw`

- 认证：本人 / Season Organizer / Platform Admin。
- 请求：`{ confirm: boolean; reason?: string }`。
- 规则：
  - 本人退出必须 `confirm=true`（二次确认），否则 `400 VALIDATION_ERROR`。
  - 本人退出仅限组队截止前；截止后返回 `409 PARTICIPANT_WITHDRAW_LOCKED`，由主办方/管理员处理。
  - 主办方/管理员不受组队截止限制。
  - 已退出的选手重复调用幂等返回 200。
- 行为：选手 `status=withdrawn`，写 `withdrawn_at/withdrawn_by/withdraw_reason`；不删除作品、积分与 Track Record。
- 递补：若设置了 `participantCapacity`、当前未到组队截止、且退出后仍有空位，自动将最早进入 `waitlisted` 的报名提升为 `accepted` 并创建 `active` 选手。
- 审计：`participant.withdrawn`；递补时额外写 `application.promoted`。
- 响应：`SeasonParticipant`。

#### `PATCH /seasons/:id/participants/:userId/wechat`

- 认证：Season Organizer / Platform Admin。
- 请求：`{ status: WechatStatus }`。
- 状态机见 3.3；相同状态幂等 200；非法跳转 `409 WECHAT_STATUS_INVALID`；已退出选手返回 `409 PARTICIPANT_WITHDRAW_LOCKED`。
- 副作用：
  - `invited`：写 `wechat_invited_by`、`wechat_invited_at`。
  - `joined`：写 `joined_at`。
  - 审计 `participant.wechat_changed`（detail 含 from/to）。
- 响应：`SeasonParticipant`。

## 7. 错误码

统一包：`{ error: { code, message, field?, detail? } }`。

| code | HTTP | 场景 |
|---|---:|---|
| `UNAUTHORIZED` | 401 | 未登录（复用现有） |
| `FORBIDDEN` | 403 | 无权限（复用现有） |
| `VALIDATION_ERROR` | 400 | 字段校验失败 |
| `SEASON_NOT_FOUND` | 404 | 赛季不存在或公开端不可见 |
| `SEASON_CODE_TAKEN` | 409 | 编号重复 |
| `SEASON_INVALID_STATUS` | 409 | 当前状态不允许该动作 |
| `SEASON_NOT_READY` | 409 | readiness 未全过；`detail.checks` |
| `SEASON_NOT_PENDING` | 409 | 不是待批赛季，不能批准/驳回 |
| `SEASON_NOT_APPROVED` | 409 | 未批准就开赛 |
| `SEASON_ALREADY_STARTED` | 409 | 开赛后取消 |
| `SEASON_NOT_STARTED` | 409 | 未到 `startAt` 就开赛 |
| `SEASON_SUSPENDED` | 409 | 暂停期间报名/开赛 |
| `SEASON_CANCELLED` | 409 | 已取消赛季的写操作 |
| `SCHEDULE_INVALID` | 400 | 赛程缺失或顺序错误 |
| `RULES_INVALID` | 400 | 规则字段非法 |
| `RULE_CARD_REQUIRED_ITEM` | 400 | 必要规则卡条目缺失或被隐藏 |
| `NOT_SEASON_ORGANIZER` | 403 | 非本赛季主办方 |
| `ORGANIZER_ORG_NOT_FOUND` | 404 | 组织不存在 |
| `ORGANIZER_ORG_NAME_TAKEN` | 409 | 组织名重复 |
| `ORGANIZER_ORG_IN_USE` | 409 | 组织仍有赛季关联，不能删除 |
| `ORGANIZER_ORG_LAST_MEMBER` | 409 | 不能移除关联中组织的最后一名成员 |
| `ORGANIZER_MEMBER_EXISTS` | 409 | 成员已存在 |
| `USER_NOT_FOUND` | 404 | 共享用户不存在 |
| `APPLICATION_NOT_FOUND` | 404 | 报名不存在 |
| `APPLICATION_DUPLICATED` | 409 | 同赛季重复报名 |
| `ALREADY_PARTICIPANT` | 409 | 已是本赛季选手 |
| `APPLICATION_WINDOW_CLOSED` | 409 | 不在报名窗口 |
| `APPLICATION_STATUS_LOCKED` | 409 | accepted 终态 |
| `APPLICATION_WITHDRAW_LOCKED` | 409 | 报名已进入审核流程不能撤回；或已撤回需本人重新报名 |
| `APPLICATION_THEME_INVALID` | 400 | 方向不在赛季主题内 |
| `AGREEMENT_VERSION_MISMATCH` | 409 | 协议版本过期 |
| `CONTACT_REQUIRED` | 400 | 微信/手机都为空 |
| `PARTICIPANT_NOT_FOUND` | 404 | 选手不存在 |
| `PARTICIPANT_WITHDRAW_LOCKED` | 409 | 已退出，或组队截止后本人不能退出 |
| `CAPACITY_FULL` | 409 | 组队截止后名额已满，不能再接受 |
| `WECHAT_STATUS_INVALID` | 409 | 微信状态非法跳转 |
| `CHALLENGE_NOT_FOUND` | 404 | 命题不存在 |
| `CHALLENGE_INCOMPLETE` | 409 | 五件套不完整；`detail.missing` |
| `CHALLENGE_STATUS_LOCKED` | 409 | 已关闭/归档命题不可编辑 |
| `CHALLENGE_FROZEN` | 409 | 已过 `challengeFreezeAt`，不能新增或下线命题 |
| `BUDGET_NOT_INCREASING` | 409 | 新预算不高于当前 active |
| `POOL_EXCEEDED` | 409 | 分配超过积分池 |
| `POOL_CLOSED` | 409 | 积分池已关闭 |
| `ALLOCATION_EXISTS` | 409 | 该评委已有 active 分配 |
| `ALLOCATION_NOT_FOUND` | 404 | 分配不存在 |
| `ALLOCATION_ALREADY_RECLAIMED` | 409 | 分配已回收 |
| `VERIFIER_ALREADY_ACTIVE` | 409 | 核验员已生效 |
| `VERIFIER_ALREADY_REVOKED` | 409 | 核验员已撤销 |
| `PIN_NOT_ALLOWED` | 409 | 未批准/已取消赛季不能置顶 |
| `ANNOUNCEMENT_NOT_ALLOWED` | 409 | 未批准赛季不能发公告 |
| `INTERNAL_ERROR` | 500 | 未分类错误 |

`error.detail` 只用于结构化补充（如 readiness checks、缺失字段、前后值），不得包含联系方式明文或密文。

## 8. 迁移与种子

### 8.1 迁移

新增表（按依赖顺序）：

1. `organizer_orgs`
2. `organizer_org_members`
3. `seasons`
4. `season_organizers`
5. `season_rule_card_items`
6. `season_announcements`
7. `audit_logs`
8. `season_applications`
9. `season_participants`
10. `challenges`
11. `season_budgets`
12. `season_point_pools`
13. `point_allocations`
14. `season_verifier_grants`

使用 `bunx drizzle-kit generate` 生成，不手写迁移。

### 8.2 种子

- 两个组织：`SheNicest`、`Proto Seeds`。
- 从现有种子用户中选至少两名，分别加入两个组织；确保每个组织至少一名成员。
- 至少一名 `operator` 用户作为 Platform Admin。
- 不种赛季、不种报名；由测试/演示创建。

## 9. 测试要点

后端（`bun test`）：

1. 权限矩阵：公开、登录、本人、主办方、管理员五种身份对每个管理端点。
2. Season 状态机：草稿 → 提交 → 批准/驳回 → 开赛 → 暂停/恢复 → 取消；非法跳转 409。
3. 主办方创建时只能用自己组织；管理员可用任意组织。
4. 九项 readiness：逐项缺失都返回 `SEASON_NOT_READY` 并列出失败项；全过后可提交/批准。
5. 赛程严格递增；规则卡必要项不可删/不可隐藏；`rulesVersion` 在赛程/规则变更时 +1。
6. 预算版本化：旧版本 `superseded`，新版本必须递增；并发追加只保留一个 active。
7. 积分池：分配总额不超过总量；同一评委唯一；回收后可重新分配。
8. 报名：窗口外/重复/已是选手/暂停/取消/协议版本不匹配/方向非法/联系方式为空均拒绝。
9. 报名接受创建选手；`accepted` 终态；重复接受幂等。
10. 微信状态机：合法流转、非法跳转、相同状态幂等。
11. 联系方式加密写库，列表掩码，详情按权限解密；审计不含明文。
12. 置顶唯一；取消时自动取消置顶。
13. 复制赛季不复制报名/预算/积分池/命题/选手，赛程清空，回到 draft。
14. 公开列表/详情不泄漏草稿；非公开赛季 404。

前端（`bun run test`，Vitest + MSW）：

1. 公开赛季列表：置顶优先、状态筛选、空状态。
2. 赛季详情：规则卡渲染、赛程时间线、报名 CTA 的开关条件。
3. 报名表单：字段校验、方向多选、联系方式至少一个、协议版本、提交成功/失败。
4. 我的报名：状态与微信群状态展示。
5. 主办方后台：readiness 九项、提交/开赛/暂停/取消动作、报名审核、拉群状态。
6. 管理员后台：批准/驳回/置顶、组织成员管理。

验证命令：

```bash
bun run test:api
bun run test:web
bun run build
```

## 10. 明确不做

- 评分、积分流水、结算、奖励发放、奖金计算。
- 作品、项目、组队、里程碑、命题冻结。
- 企业身份、企业发布命题、企业审核。
- 开赛后取消、赛季结束/归档。
- 通知红点、站内信、邮件/短信。
- 公开选手目录、赛季徽章的公开展示。
- 微信自动拉群、微信群成员反向同步。
- 多级审批、撤回报名、报名删除。
- 赛季级全局角色、`platform_admin` 新角色。
