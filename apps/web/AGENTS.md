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

## Organizer access

主办方后台（`/organizer/*` 与用户名下拉框入口）的准入集中定义在 `src/lib/organizer-access.ts`：

- 只对 `Role.Operator` 或属于至少一个主办方组织的用户开放；其他账号在菜单里看不到入口，直接访问渲染 403。
- 没有「本地永久开放」的开关（曾有 `NEXT_PUBLIC_ORGANIZER_OPEN_ACCESS`，已随 mock 用户上线移除）。本地要验准入矩阵，用右下角 mock 用户切换器选 `organizer` / `admin`（有权）或其余条目（无权），见 `apps/api/src/mock/fixtures.ts`。
- mock 切换器可以收起成一颗小胶囊（右上角图标 / `Esc` 收起，点胶囊展开），收起偏好存在 `localStorage` 的 `shenicest_mock_switcher_collapsed`，刷新后保持。它只记 UI 偏好，当前身份永远以 cookie + `/api/mock/users` 为准。

`canAccessOrganizerConsole` 用于服务端守卫，`shouldShowOrganizerEntry` 用于菜单；两者是同一套纯函数规则，入口可见性与页面可进性不会错位。
