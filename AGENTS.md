# AGENTS.md

## Domain Documentation

- [CONTEXT.md](./CONTEXT.md) — 领域术语表，定义项目核心概念（Project、ProjectEditProposal、Comment 等）
- [docs/spec-v1-backend-api.md](./docs/spec-v1-backend-api.md) — v1.0 后端 API 完整规格说明
- [docs/auth.md](./docs/auth.md) — 鉴权体系：JWT 认证、角色/属主授权、前后端守卫
- [docs/main-site-sso-integration.md](./docs/main-site-sso-integration.md) — 主站（PHP）SSO 接入契约，交给主站维护者/AI 用
- [docs/spec-v1-frontend.md](./docs/spec-v1-frontend.md) — v1.0 前端路由、页面与组件规格说明
- [docs/adr/](./docs/adr/) — 架构决策记录，解释关键设计选择的原因
  - [0001-project-revision-separation.md](./docs/adr/0001-project-revision-separation.md) — _Superseded by 0004_
  - [0002-no-project-status-field.md](./docs/adr/0002-no-project-status-field.md) — _Superseded by 0005_
  - [0003-denormalized-filter-fields.md](./docs/adr/0003-denormalized-filter-fields.md) — _Superseded by 0006_
  - [0004-content-on-project-with-edit-proposals.md](./docs/adr/0004-content-on-project-with-edit-proposals.md) — 内容放回 projects，用 proposal 记录 diff
  - [0005-single-status-field-on-project.md](./docs/adr/0005-single-status-field-on-project.md) — 单一 status 字段管理生命周期
  - [0006-no-denormalized-filter-fields.md](./docs/adr/0006-no-denormalized-filter-fields.md) — 内容已在 projects，无需冗余字段

修改领域模型前必须先阅读 CONTEXT.md。

## Commands

Monorepo（bun workspaces），依赖统一在根目录安装。

```bash
bun install                # 安装依赖（根目录，自动链接 workspaces）
bun run dev                # 启动后端开发服务器 (bun --watch)
bun run dev:web            # 启动前端开发服务器 (Next.js)
bun run build              # 构建全部（api + web）
bun run start              # 启动后端生产服务器
bun run test               # 运行后端测试
bun run seed               # 初始化种子数据
```

drizzle-kit 命令需在 `apps/api` 目录下执行：

```bash
bunx drizzle-kit generate  # 生成迁移文件
bunx drizzle-kit migrate   # 执行迁移
bunx drizzle-kit studio    # 可视化数据库管理
```

## Project Structure

```
apps/
├── api/                    # 后端（Elysia + Drizzle），包名 @shenicest/api
│   ├── src/
│   │   ├── index.ts        # 服务器入口，注册插件和路由
│   │   ├── modules/        # 按功能域划分模块
│   │   │   └── <module>/
│   │   │       ├── index.ts    # 路由控制器 (Elysia 实例)
│   │   │       ├── service.ts  # 业务逻辑 (class/abstract class)
│   │   │       └── model.ts    # TypeBox schema + 导出类型
│   │   ├── plugins/        # 可复用的 Elysia 插件
│   │   ├── db/             # Drizzle ORM 配置
│   │   │   ├── index.ts    # 数据库连接实例
│   │   │   └── schema/     # Drizzle schema 定义
│   │   └── common/         # 共享工具、类型、错误定义
│   ├── test/               # 测试文件，镜像 src/ 结构
│   └── drizzle/            # 迁移文件
├── web/                    # 前端（Next.js App Router + shadcn/ui + Tailwind），包名 @shenicest/web
│   └── src/
│       ├── app/            # 页面与路由（App Router）
│       ├── components/     # React 组件（含 submit/ 子目录）
│       ├── lib/            # 工具函数、API 客户端、筛选逻辑
│       ├── server/         # Server-only 数据获取层（React cache 包装）
│       └── fonts/          # 本地字体文件（Harmony、Monocraft、DSEG7）
packages/
└── shared/                 # 前后端共享的领域常量与类型，包名 @shenicest/shared
```

## Shared Package

- `@shenicest/shared` 存放前后端共用的领域常量（ProjectStatus、ProposalStatus、ProjectStage、Role、CATEGORIES），取值必须与 CONTEXT.md 一致
- 纯 TypeScript，不依赖 elysia/drizzle；后端与前端都通过 workspace 依赖引入
- Next.js 侧已在 `next.config.ts` 配置 `transpilePackages`
- API 请求/响应类型目前仍在 api 的 model.ts 中；前端需要时逐步抽取到 shared

## Frontend (apps/web)

- Next.js App Router + TypeScript + Tailwind CSS v4 + shadcn/ui（radix base, nova preset）
- 修改 Next.js 代码前先阅读 `apps/web/AGENTS.md`（Next.js 自动生成，指向 `node_modules/next/dist/docs/` 内置文档）
- 添加 shadcn 组件：在 `apps/web` 下执行 `bunx shadcn@latest add <component>`
- 领域枚举值一律从 `@shenicest/shared` 引入，禁止硬编码魔法数字

### Server Components vs Client Components

- **默认使用 Server Component**：页面（`page.tsx`）和纯展示组件保持为 Server Component
- **Client Component**：仅在需要交互（事件处理、状态、浏览器 API）时添加 `'use client'`
- 表单、筛选栏、认证 UI 等交互组件放在 `components/` 下，标记 `'use client'`
- 数据获取逻辑放在 `server/` 目录下，使用 `react` 的 `cache()` 包装，仅在 Server Component 中调用

### API 调用

- **Server 端**：使用 `@elysiajs/eden` 的 `treaty` 创建类型安全客户端（`src/lib/api.ts`），从 `@shenicest/api` 导入 `App` 类型
- **Client 端**：使用 `fetch` 封装（`src/lib/client-api.ts`），请求同源 `/api/*`（rewrite 代理到 API），浏览器自动携带 httpOnly cookie
- Server 端数据获取函数统一放在 `src/server/` 下，用 `cache()` 去重

### Auth

- JWT 由外部认证系统签发，存储在 httpOnly cookie（key: `shenicest_token`），详见 [docs/auth.md](../../docs/auth.md)
- `AuthProvider`（Client Component）提供全局认证上下文，通过 `useAuth()` hook 访问
- 页面组件不直接操作 token，通过 `AuthProvider` 的 `refresh`/`logout` 方法管理

### Commands

```bash
bun run dev:web            # 启动前端开发服务器
bun run lint               # ESLint 检查（在 apps/web 目录下）
bun run build              # 构建前端（通过根目录 build 命令自动执行）
```

## ElysiaJS Conventions

### 必须遵守

- **方法链式调用**：所有 `.state()`, `.decorate()`, `.model()`, `.use()` 必须链式调用，不能拆分成多行赋值，否则类型丢失
- **内联函数**：路由 handler 必须使用内联函数以确保类型推断正确
- **显式依赖**：每个 Elysia 实例必须通过 `.use()` 显式声明所依赖的插件/状态，类型不会自动传递
- **注册顺序**：lifecycle hooks 和中间件只影响其后注册的路由
- **入口文件只做引导**：`apps/api/src/index.ts` 只负责注册插件和模块、启动服务器，不定义业务路由

### Macro

- 使用命名形式 `.macro('name', { ... })` 而非对象形式 `.macro({ name: { ... } })`，以支持 macro 间依赖
- 有依赖关系的 macro 必须在定义中声明依赖（如 `{ auth: true, resolve: ... }`），禁止用 `as unknown as` 类型断言绕过
- 声明依赖后，使用方无需重复写被依赖的 macro（如 `operatorOnly: true` 已隐含 `auth: true`）

### Controller (index.ts)

- 只做 HTTP 层：路由、请求校验、响应格式化
- 使用 `onError` 处理模块内自定义错误
- 通过 `Elysia.models()` 注册 model，用 `prefix('model', 'Namespace.')` 加命名空间前缀
- 引用 model 时用字符串名称（Reference Model），不用直接引用对象

### Service (service.ts)

- 使用 `class`，构造函数接收 `db` 等基础设施依赖
- 在模块级别实例化一次（`const service = new XxxService(db)`），不要在每个请求 handler 中重复 `new`
- 返回 `status()` 表示错误（`import { status } from 'elysia'`），优先 `return Error` 而非 `throw Error`
- 与 Elysia 解耦，不直接依赖 HTTP context

### Model (model.ts)

- 始终同时导出 TypeBox schema 和对应的 TypeScript 类型：`type X = typeof X.static`
- 自定义错误类型定义在 model 文件中

### Validation

- 使用 TypeBox (`import { t } from 'elysia'`) 做请求/响应校验
- 根据路由需要定义 `body`、`params`、`query`、`response` 的 schema
- response 按状态码分别定义 schema

#### drizzle-typebox 集成

**原则：** DB schema 是唯一真相源，API schema 从它派生。

- Schema 层（`apps/api/src/db/schema/`）：用 `createInsertSchema` 定义字段级验证（minLength, format 等）
- Model 层（`apps/api/src/modules/*/model.ts`）：用 `t.Pick` / `t.Omit` 派生 API schema

**决策：**
- API 验证 = DB 约束 → 用 `t.Pick` 直接选取
- API 验证 > DB 约束 → 用 `t.Intersect` 追加更严格的规则
- API 验证 < DB 约束 → 不可能，DB 约束是最小值

**示例：**
```ts
// schema 层
export const InsertProject = createInsertSchema(projects, {
  description: (schema) => t.String({ ...schema, minLength: 10 }),
})

// model 层：API = DB 约束
export const EditBody = t.Pick(InsertProject, ['name', 'description'])

// model 层：API > DB 约束
export const SubmitBody = t.Intersect([
  t.Pick(InsertProject, ['name', 'description']),
  t.Object({ description: t.String({ minLength: 20 }) }),
])
```

### Auth (JWT 解析)

- 外部系统签发的 JWT 由 `src/lib/jwt.ts`（基于 `jose`）验证，密钥为 `SHENICEST_JWT_SECRET`
- 封装为 `authPlugin`（`auth`/`optionalAuth`）与 `roleGuardPlugin`（`operatorOnly`/`founderOnly`）两组 macro，支持 Bearer header 与 httpOnly cookie 双通道
- 需要认证的路由通过路由选项上的 macro 控制（如 `auth: true`）

### Plugins

- 无类型添加的插件（cors 等）可用 `as: 'global'`
- 添加类型的插件（db、auth）必须显式 `.use()`
- 需要去重的插件加 `{ name: 'xxx' }`
- 环境变量在模块顶部校验（`if (!X) throw new Error(...)`），禁止裸用 `process.env.X!` 非空断言

## Drizzle ORM

- Schema 定义在 `apps/api/src/db/schema/` 下，按表拆分文件
- 数据库连接实例通过 `.decorate()` 注入 Elysia context
- 迁移文件由 `drizzle-kit generate` 生成，不要手动编辑

## Testing

- 使用 `bun test`，handler 函数可直接 `.handle(Request)` 测试
- 测试文件放在 `apps/api/test/` 目录，路径镜像 `apps/api/src/`
