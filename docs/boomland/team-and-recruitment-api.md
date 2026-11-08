# BoomLand 组队与招募后端契约（工作台 / 报名 / 组队）

> 领域词汇：[CONTEXT.md](./CONTEXT.md) · 产品依据：PRD 7.3（TEAM）、7.15（LIB-003）、7.16（TAL-003）、5.3（赛季项目）
> 本批只做「个人中心工作台」的 **报名** 与 **组队** 两个 tab 所需的接口。

## 0. 范围与边界

- 工作台路由为 `/me/<tab>`，只实现 `applications`（报名）与 `team`（组队）两个 tab 的真实数据；其余 tab 为占位页。
- **发起项目复用 Product Showcase 的 `projects` 表**（产品共生的长期项目），**不新建项目内容表**。
  赛季归属写在独立的 `season_projects` 关联表上 —— 同一个长期项目可以分别带入多个赛季（PRD LIB-003），
  用 `projects` 上的单个字段表达不了这种一对多。
- 招募卡与申请是 P1 能力，本批只做「发布 / 申请 / 列表 / 发起人处理」四个动作，不做站内通知。
- 不新增平台角色；组队相关的授权口径沿用现有 `season_participants`（选手）+ 项目发起人（`season_projects.owner_user_id`）。

## 1. 数据模型

### 1.1 `season_projects` 赛季项目

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `season_id` | int | 赛季 |
| `project_id` | int | 指向 `projects.id`（产品共生的长期项目） |
| `owner_user_id` | varchar(255) | 项目发起人（带入时必须是 `projects.user_id`） |
| `source` | varchar(16) | `created`（赛季内新建）/ `brought_in`（带入已有） |
| `themes` | json | 本项目选择的赛季方向，取自 `seasons.themes`，0—5 个 |
| `challenge_ids` | json | 主/辅命题 id 数组，1—`rules.maxChallengesPerProject` 个（平行、无主次） |
| `status` | varchar(16) | `draft` / `published` / `archived` |
| `created_at` / `updated_at` | timestamp | |

唯一约束：`uq_season_projects_season_project (season_id, project_id)` —— 同一项目在同一赛季只有一条记录。

### 1.2 `season_project_members` 赛季项目核心成员

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `season_project_id` | int | |
| `user_id` | varchar(255) | |
| `role` | varchar(16) | `owner` / `core` |
| `status` | varchar(16) | `invited` / `accepted` / `removed` |
| `created_at` / `updated_at` | timestamp | |

唯一约束：`uq_season_project_members_project_user (season_project_id, user_id)`。
本批只写 `owner`（发起时自动 `accepted`），邀请接口留给 P1；表先建好，`组队规则` 卡与「等发起人登记你」的文案才有真实数据可依。

### 1.3 `recruitment_cards` 招募卡

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `season_id` | int | |
| `season_project_id` | int | 关联的赛季项目 |
| `creator_user_id` | varchar(255) | 必须是该项目发起人 |
| `roles` | json | 需要的角色（自由文本，1—10 条，每条 ≤ 50 字） |
| `skills` | json | 技能关键词（可空，≤ 10 条） |
| `description` | text | 说明：要做什么、每周投入多少 |
| `deadline` | timestamp | 截止日期 |
| `status` | varchar(16) | `open` / `closed` |
| `created_at` / `updated_at` | timestamp | |

### 1.4 `recruitment_applications` 招募申请

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `card_id` | int | |
| `applicant_user_id` | varchar(255) | |
| `message` | text | 申请说明 |
| `status` | varchar(16) | `pending` / `accepted` / `declined` |
| `decided_at` | timestamp | |
| `created_at` | timestamp | |

唯一约束：`uq_recruitment_applications_card_applicant (card_id, applicant_user_id)` —— 同一张卡同一人只能申请一次。

## 2. 接口

所有写接口都要求登录（`auth: true`）。错误统一走 `onBoomlandError`：`{ error: { code, message, field?, detail? } }`。

### 2.1 `GET /seasons/:id/team/me` —— 组队 tab 首屏聚合

一次返回组队页 5 张卡需要的全部数据，避免前端并发 6 个请求。

```jsonc
{
  "season": { /* SeasonSummary，与 GET /seasons 同构 */ },
  "participant": {                    // 未通过报名时为 null
    "userId": "9001",
    "status": "active",               // active / withdrawn
    "wechatStatus": "joined",
    "canWithdraw": true               // 组队截止前且 status=active
  },
  "application": {                    // 本人在该赛季的报名（用于展示状态），可为 null
    "id": 12, "status": "accepted"
  },
  "project": { /* SeasonProject DTO，可为 null */ },
  "recruitmentCard": { /* 本人（作为发起人）在该赛季的招募卡，可为 null */ },
  "myApplications": [ /* 我发出的招募申请 DTO */ ],
  "stats": {
    "unassignedParticipantCount": 0,  // 该赛季已通过报名、但没有任何赛季项目的选手数
    "openRecruitmentCardCount": 3
  },
  "rules": {                          // 组队规则卡要展示的条目
    "maxCoreMembers": 3,
    "maxProjectsPerParticipant": 1,
    "teamDeadline": "2026-11-12T15:59:00.000Z",
    "deadlinePassed": false
  }
}
```

### 2.2 `POST /seasons/:id/projects` —— 发起项目 / 带入已有项目

```jsonc
// mode = "create"：新建长期项目并登记为赛季项目
{ "mode": "create", "name": "冷库电费管家", "tagline": "为谁解决什么问题",
  "themes": ["新能源与储能"], "challengeIds": [3, 5] }

// mode = "bring"：把本人已有的产品共生项目带入赛季
{ "mode": "bring", "projectId": 42, "themes": [], "challengeIds": [3] }
```

校验：
- 调用者必须是该赛季 `active` 选手（否则 `409 NOT_SEASON_PARTICIPANT`）。
- 组队截止后禁止新建（`409 TEAM_DEADLINE_PASSED`）。
- `mode=bring` 时项目必须存在且 `projects.user_id === 当前用户`（否则 `403 FORBIDDEN`）。
- `challengeIds` 必须是该赛季**已发布**命题，数量 1—`rules.maxChallengesPerProject`。
- `themes` 必须是 `seasons.themes` 子集，数量 0—5。
- 同一项目在同一赛季重复登记 → `409 SEASON_PROJECT_DUPLICATED`。
- 每人参与项目数不得超过 `rules.maxProjectsPerParticipant` → `409 PROJECT_LIMIT_REACHED`。

返回 `SeasonProject` DTO。

### 2.3 `GET /me/season-projects?seasonId=` —— 我参与的赛季项目

```jsonc
{ "items": [ /* SeasonProject DTO */ ] }
```

### 2.4 `POST /seasons/:id/recruitment-cards` —— 发布招募卡

```jsonc
{ "seasonProjectId": 7, "roles": ["前端", "数据分析"], "skills": ["小程序", "Python"],
  "description": "要做什么、每周需要投入多少", "deadline": "2026-11-19T15:59:00.000Z" }
```

校验：调用者必须是该 `seasonProject` 的 `owner_user_id`（否则 `403 FORBIDDEN`）；该项目必须属于 `:id` 赛季；
`deadline` 必须晚于当前时间；每个项目同时最多 1 张 `open` 卡 → `409 RECRUITMENT_CARD_EXISTS`。

### 2.5 `PATCH /recruitment-cards/:id` —— 关闭 / 重新打开

```jsonc
{ "status": "closed" }   // 仅发起人
```

### 2.6 `POST /recruitment-cards/:id/apply` —— 申请加入

```jsonc
{ "message": "我是谁、能做什么" }
```

校验：不能申请自己的卡（`409 SELF_APPLICATION`）；卡必须 `open` 且未过截止（`409 RECRUITMENT_CARD_CLOSED`）；
重复申请 → `409 RECRUITMENT_APPLICATION_DUPLICATED`。

### 2.7 `GET /me/recruitment-applications?seasonId=` —— 我发出的申请

```jsonc
{ "items": [ /* RecruitmentApplication DTO（含 card 摘要与项目名） */ ], "total": 1 }
```

### 2.8 `GET /recruitment-cards/:id/applications` —— 发起人看收到的申请

```jsonc
{ "items": [ /* RecruitmentApplication DTO（含申请人资料） */ ] }
```

### 2.9 `PATCH /recruitment-applications/:id` —— 发起人处理申请

```jsonc
{ "status": "accepted" }   // accepted / declined；只有卡片发起人可调用
```

## 3. DTO

```ts
type SeasonProject = {
  id: number
  seasonId: number
  projectId: number
  ownerUserId: string
  source: 'created' | 'brought_in'
  name: string
  tagline: string | null
  themes: string[]
  challengeIds: number[]
  challenges: Array<{ id: number; title: string; type: string | null; capacity: number | null; selectedCount: number }>
  status: 'draft' | 'published' | 'archived'
  members: Array<{ userId: string; name: string | null; avatarUrl: string | null; role: 'owner' | 'core'; status: string }>
  createdAt: string
  updatedAt: string
}

type RecruitmentCard = {
  id: number
  seasonId: number
  seasonProjectId: number
  projectName: string
  creatorUserId: string
  creator: { userId: string; name: string | null; avatarUrl: string | null }
  roles: string[]
  skills: string[]
  description: string
  deadline: string
  status: 'open' | 'closed'
  applicationCount: number
  createdAt: string
  updatedAt: string
}

type RecruitmentApplication = {
  id: number
  cardId: number
  applicantUserId: string
  applicant: { userId: string; name: string | null; avatarUrl: string | null }
  message: string
  status: 'pending' | 'accepted' | 'declined'
  decidedAt: string | null
  createdAt: string
  card: { id: number; projectName: string; roles: string[]; deadline: string; status: 'open' | 'closed' }
}
```

## 4. 前端接线约定

- Server 端：`apps/web/src/server/me.ts`（`cache()` 包装），`getTeamWorkbench(seasonId)`。
- Client 端：`apps/web/src/lib/team-api.ts`，复用 `lib/client-api.ts` 的 `request`。
- 枚举一律从 `@shenicest/shared` 引入（`SeasonProjectStatus`、`SeasonProjectSource`、`RecruitmentCardStatus`、`RecruitmentApplicationStatus`、`SEASON_PROJECT_LIMITS`）。
- 错误文案：直接展示后端 `error.message`；字段错误定位到 `error.field`。
- 退出赛季复用既有接口 `POST /seasons/:id/participants/:userId/withdraw { confirm: true }`，不新增。

## 5. 不做

- 招募卡站内通知、微信自动拉群。
- 核心成员邀请 / 移除接口（表已建，接口留给 P1）。
- 项目作品、里程碑、评分、结算。
- 共鸣之地「本赛季未组队选手」的筛选实现 —— 组队 tab 只给跳转链接。
