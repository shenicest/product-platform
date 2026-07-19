# 01 — Project scaffolding + DB setup

**What to build:** A working Bun + Elysia + Drizzle project skeleton that follows the conventions in AGENTS.md. Directory structure matches the documented layout (src/modules/, src/plugins/, src/db/schema/, src/common/, test/). Database connection configured and injectable via `.decorate()`. `bun run dev` starts the server successfully.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] `bun install` installs all dependencies without errors
- [x] `bun run dev` starts the server and responds to health check
- [x] Directory structure matches AGENTS.md (src/modules/, src/plugins/, src/db/schema/, src/common/, test/)
- [x] Database connection configured and decorated into Elysia context
- [x] Drizzle schema directory exists with at least one placeholder table
- [x] `bunx drizzle-kit generate` produces a migration file
- [x] `bun test` runs with at least one passing smoke test

**Implementation notes:**
- Database: MySQL via `mysql2` connection pool, Drizzle ORM with `drizzle-orm/mysql2`
- DB plugin: `src/plugins/db.ts` decorates `db` into Elysia context (named plugin `{ name: 'db' }`)
- Placeholder table: `platform_meta` (id, key, value, created_at) — to be replaced by real schema in issue 04
- Migration generated at `drizzle/0000_purple_wither.sql`
- `.env` required with `DATABASE_URL` (see `.env.example`)
