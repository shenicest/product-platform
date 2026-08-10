# Spec: Product Showcase Platform v1.0 Frontend

## Overview

Next.js App Router 前端，对接后端 API（`@shenicest/api`）。Server 端通过 `@elysiajs/eden` 的 `treaty` 类型安全获取数据，Client 端通过同源 `/api/*` rewrite 直连 API，浏览器自动携带 httpOnly cookie。

## Tech Stack

- **Framework**: Next.js (App Router) + TypeScript
- **UI**: shadcn/ui（radix base, nova preset）+ Tailwind CSS v4
- **Fonts**: Harmony（中文主体）、Monocraft（代码/英文）、DSEG7（数字显示）
- **API Client**: `@elysiajs/eden` 的 `treaty`（Server 端）、`fetch` 封装（Client 端）
- **Auth**: JWT 以 httpOnly cookie（key: `shenicest_token`）存储，`AuthProvider` 提供全局上下文
- **Shared**: 领域枚举从 `@shenicest/shared` 引入（`ProjectStatus` / `ProposalStatus` / `ProjectStage` / `Role` / `CATEGORIES`）

## Route Map

| 路由 | 主要类型 | 说明 |
|------|----------|------|
| `/` | Server + Client Filter | 首页：Hero + Featured + 项目列表（筛选/排序/分页） |
| `/login` | Server + Client Form | 登录页（发送/校验验证码，登录后种入 httpOnly cookie） |
| `/submit` | Server + Client Form | 项目提交页（登录用户，多步骤表单） |
| `/projects/[id]` | Server | 项目详情页（仅 `status=3` Live 公开可访问；Founder/Operator 可查看非 Live） |
| `/projects/[id]/edit` | Server + Client Form | 项目编辑页（Founder，Draft/Pending/RevisionRequired 状态） |
| `/founder/dashboard` | Server + Client UI | Founder 后台：我的项目列表、状态筛选、统计概览 |
| `/founder/projects/[id]` | Server + Client UI | Founder 单项目详情视图（含审核意见、提案历史入口） |
| `/operator` | Server | Operator 后台入口（默认聚合视图/统计） |
| `/operator/projects` | Server + Client UI | Operator 项目管理：全状态列表、多维筛选、搜索、审核操作 |
| `/operator/projects/[id]` | Server + Client UI | Operator 项目详情：项目级审核动作（approve / require-revision / reject / delist / restore） |
| `/operator/proposals` | Server + Client UI | Operator 提案审核队列（`status=0` Pending） |
| `/operator/proposals/[id]` | Server + Client UI | Operator 单提案详情：提案级审核动作（approve / reject / require-revision） |
| `/operator/audit-records` | Server + Client UI | Operator 审核记录查询（按项目、时间范围过滤） |

## Page Specifications

### 首页 (`/`)

**数据获取**: Server Component，通过 `server/projects.ts` 中 `cache()` 包装的 `getLiveProjects()`（eden treaty）

**功能**:
- Hero 区域：展示第一个 featured 项目
- Featured 区域：展示 2-5 号 featured 项目
- 全部项目列表：
  - 筛选：category（多选）、stage（单选）、q（搜索）
  - 排序：latest、recently_updated
  - 分页：每页 20 条
  - 空状态：无筛选结果 vs 无项目

**组件**:
- `HeroSection` — Server Component
- `FeaturedSection` — Server Component
- `FilterBar` — Client Component（筛选/排序交互）
- `ProjectCard` — Server Component
- `Pagination` — Server Component

### 登录页 (`/login`)

**数据获取**: 无（Server 渲染壳 + Client 表单）

**功能**:
- 输入手机号/邮箱 → 请求验证码（`POST /auth/send-code`）
- 输入验证码 → 校验（`POST /auth/verify-code`），后端在响应中通过 `Set-Cookie` 种入 `shenicest_token`
- 登录成功后跳转回来源页或 `/`
- 中间件（`src/middleware.ts`）拦截：已登录且 token 未过期时访问 `/login` 自动重定向至 `/`

### 项目提交 (`/submit`)

**数据获取**: Server Component 渲染页面，Client Component 处理多步骤表单

**功能**:
- 多步骤表单（基础信息 → 展示资料 → 项目说明 → 用户参与 → 联系信息）
- 图片/视频上传（`components/submit/image-uploader.tsx`、`video-uploader.tsx`）
- 保存草稿（`POST /projects` 或 `PUT /projects/:id/draft`）
- 提交审核（`PUT /projects/:id/submit`）
- 表单验证（必填字段、字数限制）

**组件**:
- `ProjectSubmissionForm` — Client Component
- `FormFields` — Client Component（各字段输入组件）
- `ImageUploader` / `VideoUploader` — Client Component

### 项目详情 (`/projects/[id]`)

**数据获取**: Server Component，通过 `server/projects.ts` 的 `getProject(id)`（eden treaty）

**功能**:
- 展示项目完整信息（基础信息、展示资料、项目说明、联系信息）
- Founder 公开信息（从 shared users 表读取，可能为 `null`）
- 项目阶段/分类 badges
- Demo 媒体展示（图片/视频/链接）
- 非 Live 项目对普通用户返回 404；Founder/Operator 可完整查看

**SEO**:
- `generateMetadata` 动态生成 title/description/og:image
- description 截断至 150 字符

### 项目编辑 (`/projects/[id]/edit`)

**数据获取**: Server Component，通过带 cookie 的 eden treaty 调用；Revision Required 状态额外通过 `getFounderProjectAuditReason(id)` 获取最新修改意见

**功能**:
- 加载项目数据填充表单
- 仅允许 `status=0` (Draft)、`status=1` (Pending Review)、`status=2` (Revision Required) 编辑
- 草稿/需修改：保存草稿 / 提交审核
- 审核中：仅保存修改（隐藏提交按钮），保存后运营看到的是更新后的内容
- Revision Required 顶部展示运营最新修改意见

### Founder 后台

#### 我的项目列表 (`/founder/dashboard`)

**数据获取**: Server Component，通过 `server/founder.ts` 中 `cache()` 包装的函数（`GET /founder/projects`、`GET /founder/stats`）

**功能**:
- 顶部统计概览：累计、待审、已上线等
- 状态筛选（All / Draft / Pending / Revision / Live / Delisted / Rejected）
- 项目搜索
- 项目卡片列表 + 操作入口（继续编辑 / 查看修改意见 / 查看拒绝原因 / 查看下架原因）
- 空状态：未提交项目 / 筛选无结果

#### 项目视图 (`/founder/projects/[id]`)

**功能**:
- Founder 视角的单项目详情（含状态、审核意见、提案历史入口）
- 提供进入编辑页、创建提案（Live 状态下）等入口

### Operator 后台

所有 Operator 路由由 `/operator/layout.tsx` 提供公共导航与身份守卫（角色不足由服务端跳转）。

#### 入口页 (`/operator`)

- 后台首页壳；如需展示统计聚合，走 `GET /operator/stats`

#### 项目管理 (`/operator/projects`)

**数据获取**: Server Component（`server/operator.ts`），走 `GET /operator/projects`

**功能**:
- 全状态项目列表
- 筛选：状态、阶段、分类、搜索（项目名/Founder 名）、排序
- 收缩/展开卡片切换
- 项目审核操作入口

#### 项目详情 (`/operator/projects/[id]`)

**功能**:
- 展示项目全部字段 + 历史审核记录
- 项目级审核动作：
  - Pending Review → `approve` / `require-revision` / `reject`
  - Live → `delist`
  - Delisted → `restore`
- 需 reason 的动作提供输入框

#### 提案队列 (`/operator/proposals`)

**功能**:
- 列出所有 Pending（`status=0`）提案
- 支持按项目、时间过滤

#### 提案详情 (`/operator/proposals/[id]`)

**功能**:
- 展示提案 `changes` diff（对比旧字段与新字段）
- 提案级审核动作：`approve` / `reject` / `require-revision`
- 审核后调用 `POST /operator/proposals/:id/*`

#### 审核记录 (`/operator/audit-records`)

**功能**:
- 分页展示所有审核动作
- 按项目、时间范围过滤

## Component Architecture

### Server Components（默认）

- 所有 `page.tsx` 与 `layout.tsx`
- 纯展示组件：`ProjectCard`、`ProjectDetail`、`HeroSection`、`FeaturedSection`、`Pagination`、`ProjectBadges`、`NotFoundShell`
- 数据获取层：`server/projects.ts`、`server/founder.ts`、`server/operator.ts`、`server/auth.ts`

### Client Components（`'use client'`）

- 交互组件：`FilterBar`、`AuthProvider`、`AuthNav`
- 表单：`ProjectSubmissionForm`、`FormFields`、`ImageUploader`、`VideoUploader`
- Dashboard：`FounderDashboard`、`OperatorDashboard`、`OperatorProjects`、`OperatorProjectDetail`、`OperatorProposals`、`OperatorProposalDetail`、`OperatorAuditRecords`

### Shared Components

| 组件 | 位置 | 说明 |
|------|------|------|
| `AuthProvider` | `components/auth-provider.tsx` | 全局认证上下文，`useAuth()` 提供 `user`/`isAuthenticated`/`refresh`/`logout` |
| `SiteHeader` | `components/site-header.tsx` | 顶部导航 |
| `SiteFooter` | `components/site-footer.tsx` | 页脚 |
| `AuthNav` | `components/auth-nav.tsx` | 顶部右侧的登录/用户菜单 |
| `ProjectCard` | `components/project-card.tsx` | 项目卡片 |
| `ProjectDetail` | `components/project-detail.tsx` | 项目详情展示 |
| `FilterBar` | `components/filter-bar.tsx` | 首页筛选栏 |
| `Pagination` | `components/pagination.tsx` | 分页 |
| `ProjectBadges` | `components/project-badges.tsx` | 阶段/分类标签 |
| `NotFoundShell` | `components/not-found-shell.tsx` | 404 兜底 |

## Data Flow

### Server-side（eden treaty）

```
page.tsx → server/*.ts (cache) → lib/api.ts (treaty<App>) → @shenicest/api
```

- `server/` 下每个函数用 `react.cache()` 包装，请求级去重
- 需要认证的调用把当前请求的 `shenicest_token` cookie 转发到 API（见 `server/auth.ts`）
- 类型从 `@shenicest/api` 的 `App` 类型自动推导

### Client-side（fetch + rewrite）

```
Client Component → lib/client-api.ts → fetch('/api/...') → Next.js rewrite → @shenicest/api
```

- 浏览器自动携带 httpOnly cookie（同源），无需手动附加 `Authorization`
- 错误统一为 `{ data, error }`；`error` 结构 `{ status, body: { error: { code, message, field? } } }`

## Auth Flow

1. 用户在 `/login` 输入手机号/邮箱，`POST /api/auth/send-code` 请求验证码
2. 输入验证码后 `POST /api/auth/verify-code`，后端 `Set-Cookie: shenicest_token=<jwt>; HttpOnly`
3. `AuthProvider` 挂载时调用 `GET /api/me` 读取当前用户身份（含 `roles`），提供 `useAuth()` hook
4. Server Component 通过 `server/auth.ts` 中 `getCurrentUser()`（从请求 cookie 转发到 API）判断身份，用于角色守卫与条件渲染
5. `POST /api/auth/logout` 清除 cookie，前端 `AuthProvider.logout()` 同步本地状态并跳转 `/login`
6. `middleware.ts` 对已登录用户访问 `/login` 做 UX 层重定向（仅解 exp、不做签名校验，安全边界仍在后端）

## Styling Conventions

- Tailwind CSS v4，主题色通过 CSS 变量定义
- 本地字体通过 `next/font/local` 加载，CSS 变量 `--font-harmony` / `--font-monocraft` / `--font-dseg7`
- shadcn/ui 组件通过 `bunx shadcn@latest add` 添加
- 响应式：mobile-first，断点 `sm` / `md` / `lg` / `xl`
- 领域枚举值一律从 `@shenicest/shared` 引入，禁止硬编码魔法数字

## Out of Scope (v1.0)

- **用户互动**: 点赞、关注、投票、分享等 UI 与数据
- **评论系统**: 评论提交与展示 UI（后端预留合约但未实现）
- **内测申请**: 内测申请弹窗与列表
- **购买支持**: 购买/支持入口 UI 与支付流程
- **黑客松活动专区**: 活动页面、人气榜单
- **国际化 (i18n)**: 仅中文
- **推送/邮件通知**: 状态变更后无异步通知

## Future Considerations

- 评论系统（v2.0）：提交、公开展示、机器审核
- 用户互动能力（点赞/关注/投票）与关注页
- 文件上传服务对接（S3 / OSS）
- 活动模块与人气排行
- 通知中心（in-app + 邮件）
- 国际化多语言支持
