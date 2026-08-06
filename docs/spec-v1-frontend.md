# Spec: Product Showcase Platform v1.0 Frontend

## Overview

Next.js App Router 前端，对接后端 API（`@shenicest/api`），通过 `@elysiajs/eden` 实现类型安全的 Server 端数据获取，Client 端使用 `fetch` 封装。

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: shadcn/ui (radix base, nova preset) + Tailwind CSS v4
- **Fonts**: Harmony (中文主体), Monocraft (代码/英文), DSEG7 (数字显示)
- **API Client**: `@elysiajs/eden` (Server), `fetch` (Client)
- **Auth**: JWT in localStorage, `AuthProvider` context

## Route Map

| 路由 | 类型 | 说明 | 状态 |
|------|------|------|------|
| `/` | Server | 首页：Hero + Featured + 项目列表（筛选/排序/分页） | ✅ 已实现 |
| `/projects/[id]` | Server | 项目详情页（仅 `status=3` Live 可访问） | ✅ 已实现 |
| `/projects/[id]/edit` | Client | 项目编辑页（Founder，草稿/审核中/需修改状态） | ✅ 已实现 |
| `/submit` | Server + Client Form | 项目提交页（登录用户） | ✅ 已实现 |

## Page Specifications

### 首页 (`/`)

**数据获取**: Server Component，通过 `getLiveProjects()` (eden treaty)

**功能**:
- Hero 区域：展示第一个 featured 项目
- Featured 区域：展示 2-5 号 featured 项目
- 全部项目列表：
  - 筛选：category（多选）、stage（单选）、q（搜索）
  - 排序：latest、recently_updated
  - 分页：每页 20 条
  - 空状态：无筛选结果 vs 无项目

**组件拆分**:
- `HeroSection` — Server Component
- `FeaturedSection` — Server Component
- `FilterBar` — Client Component（交互：筛选/排序）
- `ProjectCard` — Server Component
- `Pagination` — Server Component

### 项目详情 (`/projects/[id]`)

**数据获取**: Server Component，通过 `getProject(id)` (eden treaty)

**功能**:
- 展示项目完整信息（基础信息、展示资料、项目说明、联系信息）
- Founder 信息（从 shared users table 获取，可能为 null）
- 项目阶段/分类 badges
- Demo 媒体展示（图片/视频/链接）
- 非 Live 项目返回 404

**SEO**:
- `generateMetadata` 动态生成 title/description/og:image
- description 截断至 150 字符

### 项目提交 (`/submit`)

**数据获取**: Server Component 渲染页面，Client Component 处理表单

**功能**:
- 多步骤表单（基础信息 → 展示资料 → 项目说明 → 用户参与 → 联系信息）
- 保存草稿（`POST /projects` 或 `PUT /projects/:id/draft`）
- 提交审核（`PUT /projects/:id/submit`）
- 表单验证（必填字段、字数限制）

**组件**:
- `ProjectSubmissionForm` — Client Component
- `FormFields` — Client Component（各字段输入组件）

### 项目编辑 (`/projects/[id]/edit`)

**数据获取**: Server Component，通过 `getProjectWithAuth(id)` (eden treaty + cookie token)；需修改状态额外获取 `getFounderProjectAuditReason(id)` 展示修改意见

**功能**:
- 加载现有项目数据填充表单
- 仅允许 `status=0` (Draft)、`status=1` (Pending Review) 或 `status=2` (Revision Required) 的项目编辑
- 草稿/需修改：保存草稿 / 提交审核
- 审核中：仅保存修改（隐藏提交按钮），保存后继续审核更新后的内容
- 需修改状态展示运营的最新修改意见

## Component Architecture

### Server Components (默认)

- 页面组件 (`page.tsx`)
- 纯展示组件 (`ProjectCard`, `ProjectDetail`, `HeroSection`, `FeaturedSection`, `Pagination`)
- 数据获取层 (`server/projects.ts`)

### Client Components (`'use client'`)

- 交互组件：`FilterBar`, `AuthProvider`
- 表单组件：`ProjectSubmissionForm`, `FormFields`
- 需要浏览器 API 的组件

### Shared Components

| 组件 | 位置 | 说明 |
|------|------|------|
| `AuthProvider` | `components/auth-provider.tsx` | 全局认证上下文 |
| `SiteHeader` | `components/site-header.tsx` | 顶部导航 |
| `SiteFooter` | `components/site-footer.tsx` | 页脚 |
| `ProjectCard` | `components/project-card.tsx` | 项目卡片 |
| `ProjectDetail` | `components/project-detail.tsx` | 项目详情展示 |
| `FilterBar` | `components/filter-bar.tsx` | 筛选栏 |
| `Pagination` | `components/pagination.tsx` | 分页 |
| `ProjectBadges` | `components/project-badges.tsx` | 阶段/分类标签 |

## Data Flow

### Server-side (eden treaty)

```
page.tsx → server/projects.ts → lib/api.ts (eden treaty) → @shenicest/api
```

- `server/projects.ts` 使用 `cache()` 包装，避免重复请求
- 类型从 `@shenicest/api` 的 `App` 类型自动推导

### Client-side (fetch)

```
Client Component → lib/client-api.ts → fetch → @shenicest/api
```

- JWT token 从 `localStorage` 读取，附加到 `Authorization` header
- 错误处理：返回 `{ data, error }` 结构

## Auth Flow

1. 用户通过外部认证系统登录，获取 JWT token
2. Token 存储在 `localStorage` (key: `shenicest_token`)
3. `AuthProvider` 在 layout 层提供全局上下文
4. Client Component 通过 `useAuth()` hook 访问 `token`/`userId`/`isAuthenticated`
5. Server Component 不直接访问 token（需要时通过 cookie 或 header 传递）

## Styling Conventions

- Tailwind CSS v4，使用 CSS 变量定义主题色
- 自定义字体通过 `localFont` 加载，CSS 变量 `--font-harmony`/`--font-monocraft`/`--font-dseg7`
- shadcn/ui 组件通过 `bunx shadcn@latest add` 添加
- 响应式设计：mobile-first，断点 `sm`/`md`/`lg`/`xl`

## Out of Scope (v1.0)

- **Founder Dashboard**: 创始人后台管理页面（我的项目列表、统计）
- **Operator Dashboard**: 运营后台管理页面（审核队列、项目管理）
- **用户互动**: 点赞、关注、投票、分享功能 UI
- **评论系统**: 评论提交/展示 UI
- **内测申请**: 内测申请弹窗
- **购买支持**: 购买/支持入口 UI
- **黑客松活动专区**: 活动页面、人气票、榜单

## Future Considerations

- Founder/Operator Dashboard 页面路由设计
- 评论系统公开展示（v2.0）
- 用户互动功能（点赞/关注/投票）
- 文件上传集成（S3/OSS）
- 国际化（i18n）
