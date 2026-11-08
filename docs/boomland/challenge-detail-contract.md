# 命题详情页契约（本批）

> 本文件是**本批实现的唯一契约来源**：后端 schema / API、前端页面、测试都以此为准。
> 领域术语见 [CONTEXT.md](./CONTEXT.md)。上一批的主办方命题库契约见
> [organizer-challenges-contract.md](./organizer-challenges-contract.md)，本批在它之上扩展。

## 0. 范围

新增公开页 `/challenges/<命题 id>`（命题详情页），由火热赛季页的命题卡片点击进入。

Header：命题名称、简介、发布状态、版本、赛季编号、赛季主题、五件套完整性、关注按钮。

六个 tab：

| tab | 状态 |
|---|---|
| 命题卡 | 实现 |
| 资源承诺 | 实现 |
| 结果与证据 | **占位**（待开发） |
| 评分与奖励 | 实现 |
| 公开与权益 | 实现 |
| 命题报告 | **占位**（待开发） |

右侧栏：入座卡（403 / 报名通过后可用）、选择本命题的项目、版本记录。

同时扩展 `/organizer/challenges`：新增命题卡内容、评分与奖励、公开与权益的表单入口，
以及「选择本命题的项目」「版本记录」的展示卡片/表格。

不做：结果与证据表（R0—R6 录入）、命题报告生成、项目选择命题时的权益快照与排他拦截
（CHG-003 的权益/容量校验仍不在本批）。

## 1. 数据模型增量

### 1.1 `challenges` 新增列

| 列 | 类型 | 说明 |
|---|---|---|
| `summary` | varchar(200) NULL | 简介：标题下面那一句（「谁会为一台 100–200 kWh 的储能柜付第一笔钱？」） |
| `background` | text NULL | 背景 |
| `industry` | varchar(100) NULL | 目标客户 / 产业对象 |
| `scope` | text NULL | 范围 |
| `out_of_scope` | text NULL | 不做什么 |
| `monthly_goal` | text NULL | 一个月最小成果 |
| `suggested_skills` | json（string[]） | 建议技能，默认 `[]` |
| `team_capacity` | int NULL | 团队容量（该命题下最多几个项目团队），NULL = 不限 |
| `owner_name` | varchar(100) NULL | 负责人 |
| `response_sla` | varchar(100) NULL | 响应时限，如「工作日 48 小时内」 |
| `scoring_weights` | json（Record<dimension, number>） | 五维权重；NULL = 未配置（按等权） |
| `single_work_cap` | int NULL | 命题单次评分上限；NULL = 用赛季上限 |
| `rights_public_scope` | text NULL | 公开范围 |
| `rights_confidentiality` | text NULL | 保密 |
| `rights_ip` | text NULL | 知识产权 |
| `rights_enterprise_usage` | text NULL | 企业使用权 |
| `rights_procurement` | text NULL | 采购或后续合作 |
| `rights_special_terms` | text NULL | 特殊条件 |
| `rights_exclusivity` | text NULL | 独家或排他 |

**这些都不是发布必填项**：发布门槛仍然只看五件套（`CHALLENGE_INCOMPLETE`）。

### 1.2 新表 `challenge_versions`（版本记录）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `challenge_id` | int | |
| `version` | int | 该条记录对应的命题版本号 |
| `note` | varchar(255) | 变更说明 |
| `changed_by` | varchar(255) | 操作人 |
| `created_at` | timestamp | 展示用的日期 |

索引 `idx_challenge_versions_challenge`（`challenge_id`, `version`）。

写入时机（后端自动，不需要单独的表单）：
- 新建命题草稿 → 写一条 `version = 1`，`note = changeNote ?? '初版命题卡'`；
- 发布命题 → 写一条当前 `version`，`note = changeNote ?? '发布命题'`；
- 已发布命题的内容更新 → `version + 1` 后写一条，`note = changeNote ?? 自动生成的字段清单`。

### 1.3 新表 `challenge_follows`（关注）

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `challenge_id` | int | |
| `user_id` | varchar(255) | |
| `created_at` | timestamp | |

唯一索引 `uq_challenge_follows_challenge_user`。

### 1.4 `season_projects` 新增列

| 列 | 类型 | 说明 |
|---|---|---|
| `stage` | varchar(16) | `SeasonProjectStage`，默认 `seed`。阶段只前进（本批只做展示） |

## 2. 共享常量（`@shenicest/shared`）

```ts
// 命题卡内容
export const CHALLENGE_CARD_LIMITS = { ... }
// 五维评分维度
export const ChallengeScoringDimension = {
  CommercialResult: 'commercial_result',
  DeliveryQuality: 'delivery_quality',
  OriginalMethod: 'original_method',
  ActionEvidence: 'action_evidence',
  ReuseValue: 'reuse_value',
}
export const CHALLENGE_SCORING_DIMENSIONS: readonly ChallengeScoringDimension[]
export const CHALLENGE_SCORING_DIMENSION_LABELS: Record<...>
export const CHALLENGE_SCORING_DEFAULT_WEIGHTS: Record<..., number> // 35/25/15/15/10
// 权益字段
export const CHALLENGE_RIGHTS_FIELDS / CHALLENGE_RIGHTS_FIELD_LABELS
// 赛季项目阶段
export const SeasonProjectStage = { Seed: 'seed', ... Boom: 'boom' }
export const SEASON_PROJECT_STAGES / SEASON_PROJECT_STAGE_LABELS / seasonProjectStageLabel
```

## 3. API

### 3.1 `GET /challenges/:id`（公开，optionalAuth）

在既有 `ChallengeDto` 上新增：

```ts
{
  summary, background, industry, scope, outOfScope, monthlyGoal: string | null
  suggestedSkills: string[]
  teamCapacity: number | null
  ownerName, responseSla: string | null
  scoringWeights: Record<string, number> | null
  singleWorkCap: number | null
  // 权益：七项**平铺**在命题上（与 DB 列一一对应），不套一层 rights 对象
  rightsPublicScope, rightsConfidentiality, rightsIp, rightsEnterpriseUsage,
  rightsProcurement, rightsSpecialTerms, rightsExclusivity: string | null
  versions: Array<{ id, version, note, changedBy, createdAt }>
  projects: Array<{ seasonProjectId, projectId, name, tagline, stage, ownerName }>
  followCount: number
  followed: boolean
  season: {
    id, code, name, rules: SeasonRules,
    activeBudget: { version, totalAmount, reason } | null,
    pointPool: { totalPoints, allocatedPoints, usedPoints } | null,
  }
}
```

`projects` 取该赛季所有**未归档**赛季项目里 `challengeIds` 包含本命题的行（内存过滤，
与 `season-team` 同口径），`name` / `tagline` 来自 `projects`。

`selectedCount` 改为真实值（同一份计数）。

草稿 / 参考资料 / 已归档命题仍然只有赛季主办方可见（既有逻辑不变）。

### 3.2 关注

- `POST /challenges/:id/follow`（auth）→ `{ followed: true, followCount }`
- `DELETE /challenges/:id/follow`（auth）→ `{ followed: false, followCount }`
- 幂等：重复关注不报错、不重复计数。

### 3.3 主办方写接口

`POST /seasons/:id/challenges` 与 `PATCH /challenges/:id` 的 body 新增（全部可选）：

```
summary, background, industry, scope, outOfScope, monthlyGoal,
suggestedSkills: string[], teamCapacity, ownerName, responseSla,
scoringWeights: Record<string, number>, singleWorkCap,
rightsPublicScope, rightsConfidentiality, rightsIp, rightsEnterpriseUsage,
rightsProcurement, rightsSpecialTerms, rightsExclusivity,
changeNote: string          // 只用于写版本记录，不落 challenges 表
```

校验：
- `scoringWeights` 的 key 必须是五维之一，值为 0–100 整数，合计必须为 100（全 0 视为清空 → null）。
- `singleWorkCap` 为 1–10000 整数或 null。
- `teamCapacity` 为 1–99 整数或 null。
- `suggestedSkills` ≤ 10 条，单条 ≤ 30 字。
- 各文本字段按 `CHALLENGE_CARD_LIMITS` 校验，超长 `400 VALIDATION_ERROR` + `field`。

### 3.4 `GET /seasons/:id/challenges?includeDrafts=true`

返回的每一行**同样**带新增字段、`versions` 与 `projects`（主办方后台要用它们渲染
「版本记录」与「选择本命题的项目」，逐条再发 `GET /challenges/:id` 会退化成 N+1）。
只有 `season`（赛季上下文）仅详情接口返回。

## 4. 前端

### 4.1 `/challenges/[id]`

- 服务端取数：`getChallengeDetail(id)`（`server/challenge-detail.ts`，`cache()` 包装）。
- 404 → `notFound()`。
- 样式沿用现有体系（`ui-panel` / `console-table` / `ui-chip` / `eyebrow` / `mono`），
  不新增颜色字面量；新增的类写在 `styles/patterns.css` 的「命题详情页」小节，
  前缀 `challenge-`。
- tab 用客户端组件（`useState`），默认「命题卡」。
- 结果与证据 / 命题报告：待开发占位（复用 `WorkInProgress` 的视觉语言，但文案要写清这一 tab 未来承载什么）。
- 关注按钮：未登录 → 跳登录；登录 → `POST/DELETE`，成功后局部更新计数。

### 4.2 `/organizer/challenges`

在既有「命题库 / 资源兑现 / 企业合作配置」之后新增：

1. **命题卡内容 / 评分与奖励 / 公开与权益** 的录入入口：命题库行内新增「编辑详情」图标，
   打开分段式弹窗（三段表单）；保存走同一个 `PATCH /challenges/:id`。
2. **版本记录**：表格（版本 / 说明 / 操作人 / 时间）。
3. **选择本命题的项目**：卡片/表格（项目 / 阶段 / 负责人）。

## 5. 测试要求

- `apps/api/test/modules/boomland/challenge-detail.test.ts`：新字段读写、五维权重校验、
  版本记录自动写入、关注幂等、projects 计数。
- `apps/web/test/lib/challenge-detail.test.ts`：纯函数（权重归一/展示、阶段标签、
  权益字段、有效单次上限）。
- `apps/web/test/components/organizer-challenge-detail-form.test.tsx`：表单校验与提交体。
