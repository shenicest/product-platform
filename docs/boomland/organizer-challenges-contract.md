# 主办方后台「命题与资源」契约（本批）

> 本文件是**本批实现的唯一契约来源**：后端 schema / API、前端页面、测试都以此为准。
> 领域术语见 [CONTEXT.md](./CONTEXT.md)，不要把这里的字段名当成新的领域概念。

## 0. 范围

补齐 `/organizer/challenges` tab：

1. **命题库表格**：企业 / 类型 / 状态 / 版本 / 五件套完整性 / 已选容量 / 操作。
2. **新建命题草稿弹窗**：赛季名称（只读）、命题标题、类型、赛季主题、真实问题、资源需求。
3. **资源兑现**：按命题分组的资源清单 + 逐条状态更新。
4. **企业合作配置**：按赛季的企业档位 / 费用 / 授权表格。
5. **赛季主题管理**（`/organizer/season-settings`）：把 `seasons.themes` 从「输入框加胶囊」
   升级成规则卡式的列表编辑器，并为命题表单提供下拉数据源。

不做：项目选择命题（PRD CHG-003）、命题报告、R0—R6 结果表、五维评分引导。

## 1. 数据模型增量

### 1.1 `challenges` 新增列

| 列 | 类型 | 说明 |
|---|---|---|
| `type` | `varchar(32) NULL` | `ChallengeType` 四个值之一；未分类为 NULL |
| `theme` | `varchar(50) NULL` | 赛季主题（必须取自该赛季 `seasons.themes` 的某一项） |
| `enterpriseName` | `varchar(255) NULL` | 出题企业名，与 `season_enterprise_cooperations.enterprise_name` 同一字符串（不做外键） |
| `capacity` | `int NULL` | 命题容量：该命题下最多几个参赛项目；NULL = 不限 |

`type` / `theme` / `enterpriseName` / `capacity` **都不是发布必填项**：发布门槛仍只看五件套（`CHALLENGE_INCOMPLETE`）。

### 1.2 新表 `challenge_resources`（资源承诺清单）

产品文档 CHG-001「资源承诺表」+ CHG-004「资源状态」。

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `challenge_id` | int | |
| `kind` | varchar(24) | `ChallengeResourceKind` 六类 |
| `title` | varchar(255) | 资源名，如「3 个站点历史数据」 |
| `quantity` | varchar(100) NULL | 数量 / 条件摘要 |
| `conditions` | text NULL | 使用条件 |
| `owner` | varchar(255) NULL | 负责人 |
| `status` | varchar(16) | `ChallengeResourceStatus`，默认 `committed` |
| `sort_order` | int | 展示顺序 |
| `created_at` / `updated_at` | timestamp | |

唯一索引：`(challenge_id, sort_order)` 不设唯一（重排时中间态会撞），只用普通索引
`idx_challenge_resources_challenge_order`。

### 1.3 新表 `season_enterprise_cooperations`（企业合作配置）

产品文档 CHG-006。**三项金额分开存**：管理费不进入选手奖励账本，任何派生计算都会算错账。

| 列 | 类型 | 说明 |
|---|---|---|
| `id` | int PK | |
| `season_id` | int | |
| `enterprise_name` | varchar(255) | 企业名 |
| `tier` | varchar(24) | `EnterpriseCooperationTier` |
| `grade` | varchar(16) NULL | 等级（金银标），可空 |
| `total_amount` | int | 总费用（元） |
| `management_fee` | int | 管理费（元） |
| `prize_pool_amount` | int | 奖金池出资（元） |
| `data_grant` | text NULL | 数据授权说明 |
| `public_scope` | varchar(16) | `EnterprisePublicScope` |
| `status` | varchar(16) | `EnterpriseCooperationStatus` |
| `sort_order` | int | |
| `created_at` / `updated_at` | timestamp | |

## 2. API

### 2.1 命题

`GET /seasons/:id/challenges?includeDrafts=true` → `{ items: ChallengeDto[] }`

`ChallengeDto`（在既有字段上**新增**下列字段，既有字段不变）：

```ts
{
  ...既有五件套与 status/version/createdBy/createdAt/updatedAt,
  type: string | null
  theme: string | null
  enterpriseName: string | null
  capacity: number | null
  /** 已被项目选择的次数。项目选择命题（CHG-003）未实现，恒为 0。 */
  selectedCount: number
  /** 五件套是否齐全（= 能否发布）。 */
  fivePieceComplete: boolean
  /** 缺失的字段中文名，发布按钮据此给提示。 */
  missingFields: string[]
  resources: ChallengeResourceDto[]
}
```

`POST /seasons/:id/challenges` 请求体新增可选 `type` / `theme` / `enterpriseName` / `capacity`。
`PATCH /challenges/:id` 同。

`theme` 校验：非空时必须存在于该赛季 `seasons.themes`，否则
`400 VALIDATION_ERROR`，`field: 'theme'`。

`capacity` 校验：`1..999` 整数或 `null`，否则 `400 VALIDATION_ERROR`，`field: 'capacity'`。

### 2.2 资源清单

- `PUT /challenges/:id/resources`，body `{ items: Array<{ kind, title, quantity?, conditions?, owner?, status? }> }`
  → `{ items: ChallengeResourceDto[] }`（整表替换，语义同规则卡）。
  条数上限 `MAX_CHALLENGE_RESOURCES`（30），超出 `400 VALIDATION_ERROR`。
  已关闭 / 已归档的命题不可改（`409 CHALLENGE_STATUS_LOCKED`）。
- `PATCH /challenges/resources/:id`，body 任意子集（主要用来改 `status`）
  → `ChallengeResourceDto`。同样受状态锁约束。

### 2.3 企业合作配置

- `GET /seasons/:id/cooperations` → `{ items: EnterpriseCooperationDto[] }`（需赛季管理权限）
- `PUT /seasons/:id/cooperations`，body `{ items: Array<...> }` → `{ items }`（整表替换）
  - 金额必须 `0..100_000_000` 的整数（元），否则 `400 VALIDATION_ERROR`。
  - 赛季取消后不可改（`409 SEASON_INVALID_STATUS`）。

### 2.4 赛季主题

- `GET /seasons/:id/themes` → `{ themes: string[] }`（公开，与 `GET /seasons/:id` 同口径）
- `PUT /seasons/:id/themes`，body `{ themes: string[] }` → `{ themes: string[] }`
  - 归一化：trim、去空、去重、单条 ≤ 50 字符、≤ 20 条（复用 `normalizeThemes`）。
  - 允许的状态与规则卡一致：`draft` / `upcoming` / `active` / `suspended`。
  - 已批准赛季写入时 `rulesVersion + 1` 并生成一条 `rules` 分类公告（与赛程/规则同口径）。

## 3. 前端

### 3.1 `/organizer/challenges`

- 未选赛季 → 空态（提示先在顶部选择赛季）。
- 三块内容，顺序与截图一致：命题库表格 → 资源兑现 → 企业合作配置。
- 「新建命题草稿」按钮在表格区右上。
- 表格列：企业 / 类型 / 状态 / 版本 / 五件套 / 已选容量 / 操作。
  - 企业列显示该赛季企业合作配置里与该命题 `theme` 无关 —— 直接取赛季第一条合作配置的
    企业名会误导；本批表格的「企业」列取命题所属赛季的主办方组织名（`organizerOrgs`），
    并在单元格内以 mono 小字标出 `theme`。**不伪造企业归属。**
  - 五件套列：`完整`（success chip）/ `缺失 N 项`（warning chip，title 里列出缺什么）。
  - 已选容量列：`0 / N`，N 为空显示 `0 / 不限`。
- 资源兑现：按命题分组的卡片，每条资源一行（类别 chip / 标题 / 数量条件 / 负责人 /
  状态下拉）。状态改完立即 `PATCH`，成功后 `router.refresh()`。
- 企业合作配置：表格，列为 企业 / 档位 / 总费用 / 管理费 / 奖金池出资 / 数据授权 /
  公开授权 / 状态；右上「编辑」打开整表编辑弹窗。

### 3.2 `/organizer/season-settings`

新增「赛季主题」区块，交互对齐规则卡：

- 表格列：顺序 / # / 主题 / 操作。
- 拖动排序 + 聚焦把手 Alt+↑ / Alt+↓ 键盘等价操作。
- 「新增主题」走弹窗（输入主题名，≤ 50 字），行内可删除。
- 保存走 `PUT /seasons/:id/themes`，成功后 `router.refresh()`。
- 可编辑状态 = `canEditSeasonRuleCard`。

## 4. 测试要求

- `apps/api/test/modules/boomland/challenge-resources.test.ts`：资源整表替换、状态更新、
  条数上限、状态锁。
- `apps/api/test/modules/boomland/season-themes.test.ts`：归一化、权限、状态锁、公告。
- `apps/web/test/lib/organizer-challenges.test.ts`：纯函数（校验、摘要、容量展示）。
- `apps/web/test/components/challenge-draft-form.test.tsx`：表单校验与提交体。
