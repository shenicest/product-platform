# AGENTS.md

## Domain Documentation

- [CONTEXT.md](./CONTEXT.md) — 领域术语表，定义项目核心概念（Project、ProjectRevision、Comment 等）
- [docs/spec-v1-backend-api.md](./docs/spec-v1-backend-api.md) — v1.0 后端 API 完整规格说明
- [docs/adr/](./docs/adr/) — 架构决策记录，解释关键设计选择的原因
  - [0001-project-revision-separation.md](./docs/adr/0001-project-revision-separation.md)
  - [0002-no-project-status-field.md](./docs/adr/0002-no-project-status-field.md)
  - [0003-denormalized-filter-fields.md](./docs/adr/0003-denormalized-filter-fields.md)

修改领域模型前必须先阅读 CONTEXT.md。

## Commands

```bash
bun install              # 安装依赖
bun run dev              # 启动开发服务器 (bun --watch)
bun run build            # 构建生产版本
bun run start            # 启动生产服务器
bun test                 # 运行测试
bun test <file>          # 运行单个测试文件
bunx drizzle-kit generate  # 生成迁移文件
bunx drizzle-kit migrate   # 执行迁移
bunx drizzle-kit studio    # 可视化数据库管理
```

## Project Structure

```
src/
├── index.ts              # 服务器入口，注册插件和路由
├── modules/              # 按功能域划分模块
│   └── <module>/
│       ├── index.ts      # 路由控制器 (Elysia 实例)
│       ├── service.ts    # 业务逻辑 (class/abstract class)
│       └── model.ts      # TypeBox schema + 导出类型
├── plugins/              # 可复用的 Elysia 插件
├── db/                   # Drizzle ORM 配置
│   ├── index.ts          # 数据库连接实例
│   └── schema/           # Drizzle schema 定义
└── common/               # 共享工具、类型、错误定义
test/                     # 测试文件，镜像 src/ 结构
```

## ElysiaJS Conventions

### 必须遵守

- **方法链式调用**：所有 `.state()`, `.decorate()`, `.model()`, `.use()` 必须链式调用，不能拆分成多行赋值，否则类型丢失
- **内联函数**：路由 handler 必须使用内联函数以确保类型推断正确
- **显式依赖**：每个 Elysia 实例必须通过 `.use()` 显式声明所依赖的插件/状态，类型不会自动传递
- **注册顺序**：lifecycle hooks 和中间件只影响其后注册的路由

### Controller (index.ts)

- 只做 HTTP 层：路由、请求校验、响应格式化
- 使用 `onError` 处理模块内自定义错误
- 通过 `Elysia.models()` 注册 model，用 `prefix('model', 'Namespace.')` 加命名空间前缀
- 引用 model 时用字符串名称（Reference Model），不用直接引用对象

### Service (service.ts)

- 使用 `class` 或 `abstract class`
- 返回 `status()` 表示错误（`import { status } from 'elysia'`），优先 `return Error` 而非 `throw Error`
- 与 Elysia 解耦，不直接依赖 HTTP context

### Model (model.ts)

- 始终同时导出 TypeBox schema 和对应的 TypeScript 类型：`type X = typeof X.static`
- 自定义错误类型定义在 model 文件中

### Validation

- 使用 TypeBox (`import { t } from 'elysia'`) 做请求/响应校验
- 必须定义 `body`、`params`、`query`、`response` 的 schema
- response 按状态码分别定义 schema

### Auth (JWT 解析)

- 通过 `@elysiajs/jwt` 插件解析外部系统签发的 JWT
- 封装为全局插件，在 `onBeforeHandle` 中解析 token 并 decorate 用户信息到 context
- 需要认证的路由通过 guard 或 macro 控制

### Plugins

- 无类型添加的插件（cors 等）可用 `as: 'global'`
- 添加类型的插件（db、auth）必须显式 `.use()`
- 需要去重的插件加 `{ name: 'xxx' }`

## Drizzle ORM

- Schema 定义在 `src/db/schema/` 下，按表拆分文件
- 数据库连接实例通过 `.decorate()` 注入 Elysia context
- 迁移文件由 `drizzle-kit generate` 生成，不要手动编辑

## Testing

- 使用 `bun test`，handler 函数可直接 `.handle(Request)` 测试
- 测试文件放在 `test/` 目录，路径镜像 `src/`
