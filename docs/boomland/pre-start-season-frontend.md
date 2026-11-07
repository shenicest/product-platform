# BoomLand 开赛前赛季与报名前端契约

> 配套后端契约：[pre-start-season-api.md](./pre-start-season-api.md)
> 领域词汇：[CONTEXT.md](./CONTEXT.md)
> 本批只做公开页、主办方后台、管理员后台的最小闭环；不做评分/结算/作品/项目/通知。

## 1. 技术与约定

- Next.js App Router + TypeScript + Tailwind v4 + shadcn/ui。
- 默认 Server Component；只有表单、筛选、对话框、状态切换等交互组件加 `'use client'`。
- Server 端数据获取放在 `apps/web/src/server/boomland.ts`，用 `react` 的 `cache()` 包装。
- Client 端调用放在 `apps/web/src/lib/boomland-api.ts`，复用 `lib/client-api.ts` 的 `request`，请求同源 `/api/*`。
- Server 端使用 `lib/api.ts` 的 Eden treaty；后端模块落地后从 `@shenicest/api` 获得类型。
- 枚举一律从 `@shenicest/shared` 引入（`SeasonStatus`、`SeasonApplicationStatus`、`WechatStatus`、`ChallengeStatus` 等）。
- 日期展示使用 `Intl.DateTimeFormat('zh-CN')`；统一时区在客户端按浏览器时区显示。
- 所有页面必须有 loading / empty / error 三态；错误信息使用后端 `error.message`，字段错误定位到 `error.field`。

## 2. 路由与守卫

| 路由 | 类型 | 访问 | 说明 |
|---|---|---|---|
| `/seasons` | Server + Client Filter | 公开 | 赛季列表：置顶、状态/类型/城市/主题筛选、搜索、分页 |
| `/seasons/[id]` | Server | 公开 | 赛季详情：赛程、规则卡、公告、已发布命题、报名 CTA |
| `/seasons/[id]/apply` | Server Shell + Client Form | 登录 | 报名表单；未登录跳转 `/login?next=/seasons/[id]/apply` |
| `/me/applications` | Server + Client UI | 登录 | 我的报名：审核状态、赛季、微信群状态 |
| `/organizer` | Server Shell | 主办方/管理员 | 重定向到 `/organizer/seasons` |
| `/organizer/seasons` | Server + Client UI | 主办方/管理员 | 我的赛季列表；新建草稿入口；待办（待批/未就绪） |
| `/organizer/seasons/new` | Server Shell + Client Form | 主办方/管理员 | 创建赛季草稿 |
| `/organizer/seasons/[id]` | Server Shell + Client Tabs | 主办方/管理员 | 赛季管理：概览/赛程/规则/规则卡/主办方/命题/预算/积分池/公告/审计 |
| `/organizer/seasons/[id]/applications` | Server + Client UI | 主办方/管理员 | 报名审核队列；状态筛选；接受/待定/候补/拒绝 |
| `/organizer/seasons/[id]/participants` | Server + Client UI | 主办方/管理员 | 选手列表；微信状态流转 |
| `/organizer/applications` | Server + Client UI | 主办方/管理员 | 跨赛季报名队列（可选赛季筛选） |
| `/admin/seasons` | Server + Client UI | Platform Admin | 全部赛季；待批队列；批准/驳回/置顶 |
| `/admin/seasons/[id]` | Server Shell | Platform Admin | 可重定向到 `/organizer/seasons/[id]`，或复用同一管理视图 |
| `/admin/organizer-orgs` | Server + Client UI | Platform Admin | 组织与成员管理 |

守卫策略：

- 服务端页面用 `getSessionUser()` 判断登录；未登录 `redirect('/login?next=...')`。
- `/admin/*`：`roles.includes(Role.Operator)` 才可访问；否则渲染 403。
- `/organizer/*`：
  - 未登录 → 登录页。
  - `Role.Operator` → 放行。
  - 普通用户 → 服务端调用 `GET /organizer-orgs`；若没有任何 `isMember`，渲染 403（说明需要先被加入主办方组织）。
  - 具体赛季页再由后端 `GET /seasons/:id/manage` 做最终授权；403 渲染“无权限访问该赛季”。
- 公开页不因登录态改变 404/可见性；登录只影响报名 CTA 与“我的报名”状态。
- `middleware.ts` 保持现状，不新增 JWT 解析（见 ADR-0015 与现有安全约定）。

## 3. API 客户端

### 3.1 Server

新增 `apps/web/src/server/boomland.ts`：

```ts
import { cache } from 'react'
import { cookies } from 'next/headers'
import { api } from '@/lib/api'

async function authHeaders() {
  const jar = await cookies()
  const token = jar.get('shenicest_token')?.value
  return token ? { cookie: `shenicest_token=${token}` } : undefined
}

export const getSeasons = cache(async (query) => {
  const { data, error } = await api.seasons.get({ query, headers: await authHeaders() })
  if (error) throw new Error(error.value.error.message)
  return data
})

export const getSeason = cache(async (id: number) => {
  const { data, error } = await api.seasons({ id }).get({ headers: await authHeaders() })
  if (error) return null
  return data
})
```

说明：

- `cache()` 只用于读请求；写操作不走 server cache。
- 公开列表/详情可以在路由段设置 `revalidate`，但本批先以请求级 cache 为主，避免报名窗口状态被长时间缓存。
- 需要“当前用户是否已报名”时，单独调用 `GET /me/applications?seasonId=...`，不要塞进公开详情响应。

### 3.2 Client

新增 `apps/web/src/lib/boomland-api.ts`：

```ts
import { request } from './client-api'

export const createApplication = (seasonId: number, body: CreateApplicationBody) =>
  request<SeasonApplication>('POST', `/seasons/${seasonId}/applications`, body)

export const listMyApplications = (query?: { seasonId?: number }) =>
  request<Paginated<MyApplication>>('GET', `/me/applications?${new URLSearchParams(...)}`)
```

要求：

- 所有写操作返回 `{ data, error }`，由表单统一处理。
- 401 时清理本地 AuthProvider 状态并跳转登录；403 显示无权限；409 根据 `error.code` 显示可读提示。
- 不把联系方式写入 localStorage/sessionStorage。

## 4. 页面规格

### 4.1 `/seasons` 公开赛季列表

数据：

- `GET /seasons?status=&type=&city=&theme=&q=&page=&pageSize=`。

页面：

- Hero：标题“BoomLand 赛季”、一句说明、CTA“我的报名”（登录）/“登录后报名”。
- 置顶赛季卡片：单独高亮，`pinned=true` 只出现一个。
- 筛选栏（Client）：状态（进行中/即将开始/已暂停）、类型（赛季/黑客松）、城市、主题、搜索。
- 列表卡片：名称、`code`、状态徽章、类型、城市、主题 chips、赛程（报名截止/开赛）、主办方组织名、参与人数、已发布命题数。
- 空状态：说明没有匹配赛季，提供“清除筛选”。
- 分页：上一页/下一页 + 页码；URL query 同步，便于分享。

交互：

- 筛选变化写入 URL search params；使用 `useRouter/useSearchParams`。
- 卡片点击进入 `/seasons/[id]`。
- 状态颜色：`active` 绿色、`upcoming` 蓝色、`suspended` 琥珀色；`draft/cancelled` 不出现在公开列表。

### 4.2 `/seasons/[id]` 公开详情

数据：

- `GET /seasons/:id`。
- `GET /seasons/:id/announcements`。
- `GET /seasons/:id/challenges`（公开只返回 published/closed）。
- 登录用户额外 `GET /me/applications?seasonId=:id` 判断是否已报名/已是选手。

页面：

- Header：名称、`code`、状态、类型、城市、置顶标识、主办方组织、授奖主体。
- 赛程时间线：八个节点；高亮当前阶段；`applicationWindow.isOpen` 时显示报名倒计时。
- 报名 CTA：
  - 未登录：登录后报名。
  - 登录且窗口开放且未报名：`/seasons/[id]/apply`。
  - 已报名：显示状态徽章 + “查看我的报名”。
  - 已是选手：显示“已加入本赛季”。
  - 窗口关闭/暂停/取消：显示原因文案，按钮禁用。
- 规则卡：按 `sortOrder` 渲染 `label/value`；必要项无隐藏逻辑（后端保证）。
- 公告：最新 3 条，展开更多；空状态。
- 命题：已发布命题列表；显示标题与五件套摘要；点击展开详情；`closed` 显示“已关闭”。
- 非公开赛季：渲染 404 页面（不使用后端错误文案泄漏草稿）。

### 4.3 `/seasons/[id]/apply` 报名表单

访问：

- 未登录 → `/login?next=/seasons/[id]/apply`。
- 已报名/已是选手 → 重定向到 `/me/applications` 或详情页，显示提示。
- 窗口关闭/暂停/取消 → 显示不可报名状态，不渲染表单。

字段（严格按 APP-01）：

| 字段 | 控件 | 校验 |
|---|---|---|
| 技能 | Textarea | 必填，1–2000 |
| 经历 | Textarea | 必填，1–4000 |
| 方向 | 多选 chips（来自赛季 `themes`） | 0–3，必须是主题子集 |
| 组队意向 | Textarea | 必填，1–1000 |
| 是否接受单人 | Switch | 必填 boolean |
| 可投入时间 | Input/Textarea | 必填，1–500 |
| 城市模式 | Input | 必填，1–200 |
| 微信 | Input | 与手机至少一个；1–100 |
| 手机 | Input | 与微信至少一个；1–50 |
| 公开范围 | Radio：公开 / 仅主办方 | 默认仅主办方 |
| 协议版本 | 只读展示 + 勾选确认 | 必须等于赛季 `agreementVersion` |

交互：

- 提交前做客户端校验；提交中禁用按钮；成功后跳转 `/me/applications` 并 toast。
- 409 `APPLICATION_DUPLICATED` / `ALREADY_PARTICIPANT` / `APPLICATION_WINDOW_CLOSED` 显示明确文案并刷新页面状态。
- 409 `AGREEMENT_VERSION_MISMATCH` 提示“赛季协议已更新，请刷新后重新确认”。
- 联系方式输入框 `autoComplete="off"`；不打印到控制台。
- 方向为空时展示“本赛季未设置方向”，允许提交空数组。

### 4.4 `/me/applications` 我的报名

数据：`GET /me/applications`。

页面：

- 列表项：赛季名称/编号、状态徽章、报名时间、微信群状态（未成为选手显示“—”，成为选手后显示未邀请/已邀请/已加入/邀请失败）。
- 点击进入赛季详情；已接受显示“已加入赛季”。
- 状态文案：
  - `submitted` 已提交
  - `accepted` 已通过
  - `pending` 待定
  - `waitlisted` 候补
  - `rejected` 未通过（显示原因）
  - `withdrawn` 已撤回
- `submitted` 状态提供“撤回报名”按钮（二次确认），调用 `POST /applications/:id/withdraw`。
- `withdrawn` 且报名窗口开放时提供“重新报名”入口，回到报名表单；提交后复用同一条记录。
- `accepted` 且当前是 `active` 选手、组队截止前，提供“退出赛季”入口（二次确认），调用 `POST /seasons/:id/participants/:userId/withdraw { confirm: true }`；截止后隐藏并提示联系主办方。
- 空状态：“还没有报名任何赛季”，CTA 去 `/seasons`。
- 不提供删除报名记录。

### 4.5 `/organizer/seasons` 主办方赛季列表

数据：`GET /organizer/seasons`。

页面：

- 顶部统计：草稿、待批、进行中、已暂停、已取消。
- 列表：名称/编号、状态、报名窗口、参与人数、readiness 状态（就绪/缺 N 项）、待批标识。
- 操作：
  - 新建草稿 → `/organizer/seasons/new`。
  - 编辑 → `/organizer/seasons/[id]`。
  - 复制上季 → 对话框输入新编号/名称，调用 `POST /seasons/:id/clone`，成功后跳转新草稿。
- 管理员额外看到“全部赛季”入口 `/admin/seasons`。
- 空状态：没有赛季，CTA 新建；若用户不属于任何组织，提示联系管理员加入主办方组织。

### 4.6 `/organizer/seasons/new` 创建赛季

字段：

- 编号（必填，1–32，创建后不可改）、名称、类型（赛季/黑客松）、城市（黑客松必填）、介绍、主题（多选输入）、主办方组织（多选，来自 `GET /organizer-orgs` 中 `isMember` 的组织；管理员可选全部）、协议版本（默认 `v1`）、授奖主体、选手名额（可选，留空表示不限）。
- 规则（可折叠，带默认值）：命题上限 3、每人项目数 1、团队人数 3、单次评分上限 100、兑换比例 1、复核阈值 50、每日限额关闭。
- 赛程可暂不填（草稿允许），但页面提示“提交前必须完整”。

交互：

- 创建成功进入 `/organizer/seasons/[id]?tab=overview`，展示 readiness 九项。
- 编号冲突 409 定位到编号字段。

### 4.7 `/organizer/seasons/[id]` 赛季管理

布局：左侧/顶部 tab，右侧内容；顶部固定操作区。

Tab：

1. **概览**：状态、readiness 九项（通过/失败 + detail）、关键时间、参与人数/名额/候补数、待批/驳回原因；操作：提交、开赛、暂停、恢复、取消、复制。
2. **赛程**：八个 datetime 输入；保存时校验 `applyOpen < applyClose < startAt < teamDeadline < scoreDeadline < settleDate`，并校验 `workDeadline <= scoreDeadline`、`challengeFreezeAt <= teamDeadline`；已批准赛季保存后可填写公告标题/内容（留空自动摘要）。
3. **规则**：类型化表单（命题上限 1–3、每人项目数、团队人数 1–3、单次评分上限、兑换比例、复核阈值、每日限额开关）；仅 draft/upcoming 可编辑。
4. **规则卡**：拖拽排序；必要项固定不可删/不可隐藏；可选条目增删；保存可附公告。
5. **主办方**：组织多选；draft 可改，提交后仅管理员可改。
6. **命题**：列表 + 新建/编辑；五件套表单；发布前显示缺失字段；草稿/参考资料/已发布/已关闭/已归档状态；发布后编辑提示“将生成新版本”。
7. **预算**：版本列表；追加预算对话框（新总额 + 原因）；显示当前 active。
8. **积分池**：总量/已分配/未分配/已使用；充值对话框；评委分配列表 + 分配/回收；核验员列表 + 授权/撤销。
9. **公告**：列表 + 新建。
10. **审计**：分页表格，按 action/target 筛选。

操作区按钮可见性由 `status` + `approvedAt` 决定：

| 按钮 | 可见条件 |
|---|---|
| 提交待批 | `draft` |
| 批准/驳回 | `upcoming` 且 `approvedAt=null`（仅 Admin） |
| 开赛 | `upcoming` 且 `approvedAt!=null` |
| 暂停 | `upcoming` / `active` |
| 恢复 | `suspended` |
| 取消 | `draft` / `upcoming` / `suspended`（前态 upcoming） |
| 置顶/取消置顶 | `approvedAt!=null` 且未取消（仅 Admin） |
| 复制 | 任意可管理赛季 |

readiness 未就绪时，“提交待批”禁用并提示缺项；管理员“批准”同样禁用。

### 4.8 `/organizer/seasons/[id]/applications` 报名审核

数据：`GET /seasons/:id/applications` + `GET /seasons/:id/participants`（用于判断是否已接受）。

页面：

- 筛选：状态、可见性、关键词。
- 列表列：报名者、技能摘要、方向、可投入时间、状态、提交时间、联系方式掩码。
- 点击行打开详情抽屉/详情页：完整联系方式、经历、组队意向、接受单人、城市模式、协议版本、审核历史（来自审计）。
- 顶部显示“选手名额 / 已用 / 候补数”；未设置名额时显示“不限”。
- 操作：
  - 接受 → `PATCH /applications/:id/status {status:'accepted'}`；若名额已满且未到组队截止，返回 `waitlisted`，提示“已加入候补队列”；截止后返回 `409 CAPACITY_FULL`。
  - 待定/候补/拒绝 → 对话框可选原因；拒绝必填。
  - accepted 后操作按钮禁用，显示终态。
- 审核后刷新列表与选手数；不在此页做微信群操作（跳转选手页）。

### 4.9 `/organizer/seasons/[id]/participants` 选手与拉群

数据：`GET /seasons/:id/participants`。

页面：

- 筛选：选手状态（active/withdrawn）、微信状态、关键词。
- 列表列：选手、报名方向、选手状态、微信状态、邀请人、邀请时间、入群时间。
- 操作：未邀请 → 邀请；已邀请 → 标记入群/邀请失败；失败 → 重新邀请；已加入只读；已退出选手禁用微信操作。
- 组队截止后，主办方/管理员可对 `active` 选手调用 `POST /seasons/:id/participants/:userId/withdraw { confirm: true, reason? }`；截止前也可代操作。
- 每次微信操作调用 `PATCH /seasons/:id/participants/:userId/wechat`，成功后局部更新。
- 提示文案：微信群用于互动与组队，正式记录以平台为准；退出不会删除作品、积分与 Track Record。

### 4.10 `/admin/seasons` 管理员赛季审核

数据：`GET /admin/seasons`。

页面：

- 统计：待批、即将开始、进行中、已取消。
- 筛选：状态、是否待批、类型、关键词。
- 表格列：赛季、编号、主办方、状态、readiness、报名人数、提交时间、置顶。
- 操作：
  - 查看 → `/organizer/seasons/[id]`。
  - 批准/驳回 → 对话框；批准前展示 readiness 九项，未就绪禁用；驳回必填原因。
  - 置顶/取消置顶 → `PUT /seasons/:id/pin`；置顶前确认会替换当前置顶。
- 待批队列默认排序：`submittedAt ASC`（先提交先审）。

### 4.11 `/admin/organizer-orgs` 组织与成员

数据：`GET /organizer-orgs`、`GET /organizer-orgs/:id/members`。

页面：

- 组织列表 + 新建/重命名/删除（有赛季关联时禁用删除并说明）。
- 成员管理：按 `userId` 添加；移除成员；最后一名成员的保护由后端 409 返回。
- 不提供邀请邮件/站内信；由管理员线下确认 `userId`。

## 5. 组件拆分

新增组件（位于 `apps/web/src/components/boomland/`）：

- `season-status-badge.tsx`（Server/纯展示）
- `season-card.tsx`
- `season-filters.tsx`（Client）
- `season-timeline.tsx`
- `rule-card.tsx`
- `application-form.tsx`（Client）
- `application-status-badge.tsx`
- `application-review-drawer.tsx`（Client）
- `participant-wechat-control.tsx`（Client）
- `readiness-checklist.tsx`
- `schedule-form.tsx`（Client）
- `rules-form.tsx`（Client）
- `rule-card-editor.tsx`（Client）
- `challenge-form.tsx`（Client）
- `budget-dialog.tsx`（Client）
- `point-pool-panel.tsx`（Client）
- `allocation-panel.tsx`（Client）
- `verifier-panel.tsx`（Client）
- `announcement-form.tsx`（Client）
- `audit-table.tsx`
- `season-actions.tsx`（Client）

复用现有：

- `components/ui/*`（shadcn）
- `components/auth-provider.tsx`
- `lib/client-api.ts`
- 现有空状态/错误提示/分页组件（若存在则复用，不重复造）。

## 6. 数据与缓存

- 公开列表/详情：Server Component 请求，`cache()` 去重；筛选通过 URL query，服务端按 query 取数。
- 管理页：Server Shell 取首屏数据；交互后用 `router.refresh()` 重新取数，避免客户端维护复杂缓存。
- 报名窗口 `isOpen` 是时间推导值：页面加载时计算；不在客户端做长时间定时器；倒计时可用 1 分钟粒度。
- 我的报名：每次进入页面重新取，不使用全局缓存。
- 写入成功后：
  - 报名 → 跳转 `/me/applications`。
  - 审核/拉群 → 局部更新 + `router.refresh()`。
  - 赛季状态变更 → `router.refresh()`，并刷新 readiness。
- 联系方式不进入 URL、不写日志、不写 localStorage。

## 7. 错误与空状态

| 场景 | 展示 |
|---|---|
| 公开赛季不存在/非公开 | 404 页面，文案“赛季不存在或暂未公开” |
| 未登录访问报名/我的报名 | 跳转登录，保留 `next` |
| 非主办方访问 `/organizer/*` | 403 页面，文案“你还不属于任何主办方组织” |
| 非管理员访问 `/admin/*` | 403 页面 |
| 无权限管理某赛季 | 403 卡片，返回赛季列表 |
| readiness 未就绪 | 九项清单 + 缺失项说明；提交/批准禁用 |
| 报名窗口关闭 | 详情页 CTA 禁用 + 文案；表单页显示关闭状态 |
| 重复报名/已是选手 | 提示并跳转 `/me/applications` |
| 赛程顺序错误 | 表单字段级错误 + 顶部摘要 |
| 预算未递增 | 对话框内错误 |
| 积分池超额 | 对话框内错误，显示剩余可分配 |
| 命题五件套缺失 | 发布按钮禁用 + 缺失字段列表 |
| 网络/500 | 页面级错误 + 重试按钮 |

## 8. 样式与可用性

- 沿用现有 Tailwind v4 + shadcn/ui；不引入新 UI 库。
- 赛季状态使用统一色板：`active` 绿、`upcoming` 蓝、`suspended` 琥珀、`draft` 灰、`cancelled` 红。
- 规则卡与赛程在移动端单列；管理页表格在窄屏改为卡片列表。
- 所有表单控件有 `<label>`；对话框有标题与描述；错误用 `aria-live`。
- 报名表单联系方式字段不自动填充；提交按钮有 loading 状态。

## 9. 测试

Vitest + React Testing Library + MSW：

1. `season-filters`：状态/类型/城市/主题/搜索写入 URL。
2. `application-form`：必填校验、方向多选、联系方式至少一个、协议版本、成功跳转、409 错误文案。
3. `application-review-drawer`：接受/待定/候补/拒绝；拒绝原因必填；accepted 后按钮禁用；名额已满时显示候补/`CAPACITY_FULL` 文案。
3b. `application-withdraw`：撤回确认、重新报名入口、撤回后状态。
4. `participant-wechat-control`：合法流转、非法跳转错误、幂等、已退出禁用。
4b. `participant-withdraw`：二次确认、截止前后可用性、退出后列表状态。
5. `readiness-checklist`：九项通过/失败渲染；未就绪禁用提交。
6. `season-actions`：按状态显示按钮；管理员专属按钮不出现。
7. `rule-card-editor`：必要项不可删除/隐藏；排序保存。
8. `challenge-form`：五件套缺失时禁止发布。
9. `/admin/seasons`：待批队列、批准/驳回、置顶替换确认。
10. 守卫：未登录跳转、非主办方 403、非管理员 403。

命令：

```bash
bun run test:web
bun run lint
bun run build
```

## 10. 不做

- 评分、结算、作品、项目、组队、里程碑页面。
- 通知中心/红点。
- 微信自动拉群、扫码登录。
- 公开选手目录/榜单。
- 报名记录删除。
- 赛季结束/归档页面。
- 企业身份与企业后台。
