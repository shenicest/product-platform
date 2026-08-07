<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project References

- 根目录 [AGENTS.md](../../AGENTS.md) — 全局约定（Frontend 章节、Shared Package、ElysiaJS 规范等）
- [docs/spec-v1-frontend.md](../../docs/spec-v1-frontend.md) — 前端路由、页面与组件规格说明
- [docs/spec-v1-backend-api.md](../../docs/spec-v1-backend-api.md) — 后端 API 合约

## Environment Variables

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `API_URL` | 后端地址（Server 端 eden treaty、Next rewrite 与 `/api/me`、`/api/auth/*` 代理） | `http://localhost:3000` |
