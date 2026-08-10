# Current System — Technical Overview

> Generated from source code and documentation on 2026-08-10.

---

## 1. Tech Stack & Dependencies

### Root (`package.json:1`)

- **Package manager**: Bun
- **Monorepo**: Bun workspaces (`apps/*`, `packages/*`)

### API (`apps/api/package.json:1`)

| Category | Package | Version |
|----------|---------|---------|
| Runtime | `elysia` | ^1.2.25 |
| HTTP | `@elysiajs/cors` | ^1.4.2 |
| HTTP | `@elysiajs/openapi` | ^1.4.15 |
| ORM | `drizzle-orm` | ^0.44.2 |
| Schema | `drizzle-typebox` | ^0.3.3 |
| DB Driver | `mysql2` | ^3.14.1 |
| JWT | `jose` | ^6.2.8 |
| Storage | `cos-nodejs-sdk-v5` | ^3.0.0 (Tencent COS) |
| Env | `dotenv` | ^17.4.2 |
| Internal | `@shenicest/shared` | workspace:* |
| Dev | `drizzle-kit` | ^0.31.1 |
| Dev | `@types/bun` | ^1.2.15 |

### Web (`apps/web/package.json:1`)

| Category | Package | Version |
|----------|---------|---------|
| Framework | `next` | 16.3.0 |
| React | `react` / `react-dom` | 19.2.8 |
| CSS | `tailwindcss` | ^4 |
| UI | `shadcn` | ^4.16.1 |
| UI | `radix-ui` | ^1.6.7 |
| Icons | `lucide-react` | ^1.28.0 |
| Utility | `class-variance-authority` | ^0.7.1 |
| Utility | `clsx` | ^2.1.1 |
| Utility | `tailwind-merge` | ^3.6.0 |
| Animation | `tw-animate-css` | ^1.4.0 |
| API Client | `@elysiajs/eden` | 1.4.9 |
| Internal | `@shenicest/api` | workspace:* |
| Internal | `@shenicest/shared` | workspace:* |
| Dev | `typescript` | ^5 |
| Dev | `eslint` / `eslint-config-next` | ^9 / 16.3.0 |

### Shared (`packages/shared/package.json:1`)

- Pure TypeScript, zero runtime dependencies
- `"type": "module"`, exports `src/index.ts` directly

---

## 2. Architecture

### Monorepo Structure

```
shenicest-product-platform/
├── apps/
│   ├── api/          → @shenicest/api   (Elysia backend, port 3000)
│   └── web/          → @shenicest/web   (Next.js 16 frontend)
└── packages/
    └── shared/       → @shenicest/shared (domain constants)
```

### Request Flow

```
Browser → Next.js (web, port 3001)
  ├── /api/* → rewrite proxy → Elysia API (port 3000)
  ├── Server Components → eden treaty → Elysia API (with cookie forwarding)
  └── Client Components → fetch('/api/*') → Next.js proxy → Elysia API
```

- **Next.js rewrite** (`apps/web/next.config.ts:7`): `/api/:path*` → `${API_URL}/:path*`
- **Server-side**: eden treaty (`treaty<App>()`) creates a typed client; Server Components manually forward the `shenicest_token` cookie header
- **Client-side**: `lib/client-api.ts` wraps `fetch('/api/...', { credentials: 'same-origin' })`

### Key Architectural Patterns

1. **Content-on-Project**: All displayable content lives directly on the `projects` row — no separate content/revision table (ADR-0004)
2. **Edit Proposals for post-live changes**: Post-live edits go through `project_edit_proposals` (JSON diff), not direct row mutation
3. **Single status field**: One `tinyint` on `projects` manages the entire lifecycle (ADR-0005)
4. **No denormalized filter fields**: `categories` and `stage` on `projects` serve dual purpose — source of truth and filter target (ADR-0006)

---

## 3. Database Schema

**Engine**: MySQL (via `mysql2` driver, `drizzle-orm`, UTC timezone enforced at connection)

**Connection**: `apps/api/src/db/index.ts:1` — `mysql2/promise` pool, `DATABASE_URL` env var

### Table: `projects` (`apps/api/src/db/schema/project.ts:5`)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `int` PK | NO | autoincrement | |
| `user_id` | `varchar(255)` | NO | | Owner's external user ID |
| `status` | `tinyint` | NO | 0 | Lifecycle: 0=Draft, 1=PendingReview, 2=RevisionRequired, 3=Live, 4=Delisted, 5=Rejected |
| `name` | `varchar(255)` | NO | | |
| `tagline` | `varchar(255)` | YES | | |
| `description` | `text` | YES | | |
| `cover_url` | `varchar(255)` | YES | | |
| `demo_images` | `json` | YES | | `string[]` |
| `demo_video_url` | `varchar(255)` | YES | | |
| `demo_link` | `varchar(255)` | YES | | |
| `stage` | `tinyint` | YES | | 0=MVP, 1=Growth |
| `categories` | `json` | YES | | `string[]` |
| `target_users` | `text` | YES | | |
| `user_problem` | `text` | YES | | |
| `progress` | `text` | YES | | |
| `next_steps` | `text` | YES | | |
| `message_to_users` | `text` | YES | | |
| `is_open_for_beta` | `boolean` | YES | | |
| `beta_description` | `text` | YES | | |
| `contact_name` | `varchar(255)` | YES | | |
| `contact_phone` | `varchar(255)` | YES | | |
| `contact_email` | `varchar(255)` | YES | | |
| `contact_wechat` | `varchar(255)` | YES | | |
| `team_name` | `varchar(255)` | YES | | |
| `created_at` | `timestamp` | NO | `now()` | |
| `updated_at` | `timestamp` | NO | `now()` | `onUpdateNow()` |

**Indexes** (line 32-36):
- `idx_projects_user_id` on `user_id`
- `idx_projects_status` on `status`
- `idx_projects_stage` on `stage`

### Table: `project_edit_proposals` (`apps/api/src/db/schema/project-edit-proposal.ts:4`)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `int` PK | NO | autoincrement | |
| `project_id` | `int` | NO | | FK → projects.id |
| `changes` | `json` | NO | | `Record<string, unknown>` — diff of changed fields |
| `status` | `tinyint` | NO | 0 | 0=Pending, 1=Approved, 2=Rejected, 3=RevisionRequired |
| `reason` | `text` | YES | | Operator's review reason |
| `reviewed_by` | `varchar(255)` | YES | | Operator user ID |
| `reviewed_at` | `timestamp` | YES | | |
| `created_at` | `timestamp` | NO | `now()` | |
| `updated_at` | `timestamp` | NO | `now()` | `onUpdateNow()` |

**Indexes** (line 14-17):
- `idx_proposals_project_id` on `project_id`
- `idx_proposals_status` on `status`

### Table: `user_identities` (`apps/api/src/db/schema/user-identity.ts:4`)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `int` PK | NO | autoincrement | |
| `user_id` | `varchar(255)` | NO | | External user ID |
| `role` | `tinyint` | NO | | 0=Founder, 1=Operator |
| `created_at` | `timestamp` | NO | `now()` | |

**Constraints**:
- `uk_user_role` UNIQUE on `(user_id, role)` — a user can hold multiple roles but not duplicates

### Table: `audit_records` (`apps/api/src/db/schema/audit-record.ts:4`)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `int` PK | NO | autoincrement | |
| `project_id` | `int` | NO | | |
| `operator_id` | `varchar(255)` | NO | | Operator who acted |
| `action` | `varchar(32)` | NO | | `approve`, `require_revision`, `reject`, `delist`, `restore` |
| `proposal_id` | `int` | YES | | Set only for proposal-level actions |
| `reason` | `text` | YES | | |
| `created_at` | `timestamp` | NO | `now()` | |

**Indexes** (line 12-16):
- `idx_audit_records_project_id` on `project_id`
- `idx_audit_records_operator_id` on `operator_id`
- `idx_audit_records_created_at` on `created_at`

### Table: `platform_meta` (`apps/api/src/db/schema/placeholder.ts:3`)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `int` PK | NO | autoincrement | |
| `key` | `varchar(255)` | NO | | UNIQUE |
| `value` | `varchar(255)` | NO | | |
| `created_at` | `timestamp` | NO | `now()` | |

### Relationships (logical, no FK constraints in schema)

```
projects.user_id ←→ external users table (read-only)
projects.id ←→ project_edit_proposals.project_id
projects.id ←→ audit_records.project_id
projects.id ←→ audit_records.proposal_id (nullable)
user_identities.user_id ←→ projects.user_id
```

---

## 4. API Routes

All routes are registered in `apps/api/src/index.ts:13`. The Elysia app listens on `PORT` (default 3000).

### Auth Module (`apps/api/src/modules/auth/index.ts:10`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me` | Cookie | Get current user from httpOnly JWT cookie |
| POST | `/auth/send-code` | None | Proxy: send OTP email via external auth system |
| POST | `/auth/verify-code` | None | Proxy: verify OTP, set JWT cookie |
| POST | `/auth/logout` | None | Clear auth cookie |
| GET | `/me/bearer` | `auth` | Get current user ID from Bearer token |

### Project Module (`apps/api/src/modules/project/index.ts:33`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/projects` | `auth` | Create a Draft project (status=0); grants Founder role |
| GET | `/projects` | Public | List Live (status=3) projects with pagination/filtering |
| PUT | `/projects/:id/draft` | `auth` + owner | Save draft (editable when status 0/1/2) |
| PUT | `/projects/:id/submit` | `auth` + owner | Submit for review (status 0/2 → 1) |
| GET | `/projects/:id` | `optionalAuth` | Get project detail (public for Live; owner/operator for others) |

### Proposal Module (`apps/api/src/modules/proposal/index.ts:36`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/projects/:id/proposals` | `auth` + owner | Create post-live edit proposal (status=0) |
| PUT | `/projects/:id/proposals/:proposalId` | `auth` + owner | Edit & resubmit a Revision Required proposal (3→0) |
| GET | `/projects/:id/proposals` | `auth` + owner/operator | List all proposals for a project |
| GET | `/projects/:id/proposals/:proposalId` | `auth` + owner/operator | Get proposal detail |

### Founder Module (`apps/api/src/modules/founder/index.ts:28`, prefix: `/founder`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/founder/projects` | `founderOnly` | List founder's own projects with filters |
| GET | `/founder/stats` | `founderOnly` | Founder's project stats (total, live, pending) |
| GET | `/founder/projects/:id/audit-reason` | `founderOnly` + owner | Latest audit reason for a project |
| GET | `/founder/projects/:id/proposals` | `founderOnly` + owner | Proposal history for a project |

### Operator Module (`apps/api/src/modules/operator/index.ts:35`, prefix: `/operator`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/operator/projects/:id/approve` | `operatorOnly` | Approve project (status 1→3) |
| POST | `/operator/projects/:id/require-revision` | `operatorOnly` | Require revision (status 1→2) |
| POST | `/operator/projects/:id/reject` | `operatorOnly` | Reject project (status 1→5, terminal) |
| POST | `/operator/projects/:id/delist` | `operatorOnly` | Delist project (status 3→4) |
| POST | `/operator/projects/:id/restore` | `operatorOnly` | Restore delisted (status 4→3) |
| POST | `/operator/proposals/:proposalId/approve` | `operatorOnly` | Approve proposal, apply diff (0→1) |
| POST | `/operator/proposals/:proposalId/reject` | `operatorOnly` | Reject proposal (0→2) |
| POST | `/operator/proposals/:proposalId/require-revision` | `operatorOnly` | Require proposal revision (0→3) |
| GET | `/operator/projects` | `operatorOnly` | List all projects with filters |
| GET | `/operator/proposals` | `operatorOnly` | List pending proposals (status=0) |
| GET | `/operator/projects/:id/proposals` | `operatorOnly` | Proposal history for a project |
| GET | `/operator/audit-records` | `operatorOnly` | Query audit records |
| GET | `/operator/stats` | `operatorOnly` | Platform-wide statistics |

### Upload Module (`apps/api/src/modules/upload/index.ts:7`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/uploads/presign` | `auth` | Get pre-signed COS upload URL (user-scoped path) |

### User Identity Module (`apps/api/src/modules/user-identity/index.ts:12`, prefix: `/identity`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/identity/roles` | `auth` | Get current user's roles |
| GET | `/identity/users/:userId/roles` | `operatorOnly` | Get any user's roles |

### Health Check (`apps/api/src/index.ts:60`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Returns `{ status: 'ok', env }` |

**Total: 30 endpoints** (including health check)

---

## 5. Frontend Pages

**Framework**: Next.js 16.3.0 App Router with `force-dynamic` on all pages (SSR on every request).

| Route | File | Auth | Description |
|-------|------|------|-------------|
| `/` | `apps/web/src/app/page.tsx:17` | Public | Homepage: Hero, Featured, paginated project grid with filters |
| `/login` | `apps/web/src/app/login/page.tsx:8` | Public | OTP login form (email → code → cookie set) |
| `/submit` | `apps/web/src/app/submit/page.tsx:13` | Cookie required | New project submission form |
| `/projects/[id]` | `apps/web/src/app/projects/[id]/page.tsx:53` | Public (Live) | Public project detail page |
| `/projects/[id]/edit` | `apps/web/src/app/projects/[id]/edit/page.tsx:30` | Cookie required | Edit draft (status 0/1/2); shows audit reason for RevisionRequired |
| `/founder/dashboard` | `apps/web/src/app/founder/dashboard/page.tsx:22` | Cookie required | Founder dashboard: own projects list, stats, filters |
| `/founder/projects/[id]` | `apps/web/src/app/founder/projects/[id]/page.tsx:37` | Cookie required | Founder's project detail with contact info, audit reason, proposal history |
| `/operator` | `apps/web/src/app/operator/page.tsx:12` | Operator layout guard | Operator dashboard: platform stats |
| `/operator/projects` | `apps/web/src/app/operator/projects/page.tsx:19` | Operator layout guard | Operator project management list with filters |
| `/operator/projects/[id]` | `apps/web/src/app/operator/projects/[id]/page.tsx:27` | Operator layout guard | Operator project detail with review actions and proposals |
| `/operator/proposals` | `apps/web/src/app/operator/proposals/page.tsx:19` | Operator layout guard | Operator proposal review queue |
| `/operator/proposals/[id]` | `apps/web/src/app/operator/proposals/[id]/page.tsx:23` | Operator layout guard | Operator proposal detail with approve/reject/revision actions |
| `/operator/audit-records` | `apps/web/src/app/operator/audit-records/page.tsx:19` | Operator layout guard | Operator audit record log |

**Total: 13 pages**

### Page Guard Strategy

1. **Middleware** (`middleware.ts`): Redirects authenticated users away from `/login` (token exp check, no signature verification)
2. **Server Component guards**: `operator/layout.tsx` calls `getSessionUser()` → redirects to `/` if not Operator; founder/submit pages redirect to `/login` if no cookie
3. **API fallback**: All authorization ultimately enforced by backend macros and ownership checks

---

## 6. Auth System

### Overview (`docs/auth.md:1`)

- **External JWT**: Issued by `shenicest.com` (HS256), verified by `apps/api/src/lib/jwt.ts:15` using `jose`
- **This API never signs JWTs** — it only verifies and proxies

### JWT Verification (`apps/api/src/lib/jwt.ts:15`)

```ts
verifyToken(token) → { user_id: number, email: string | null, role: string }
```

- `SHENICEST_JWT_SECRET` env var (required, fails at startup if missing)
- Fixed `issuer` and `audience`: `shenicest.com`

### Token Channels (`apps/api/src/plugins/auth.ts:9`)

Priority order:
1. `Authorization: Bearer <token>` header
2. httpOnly cookie `shenicest_token`

### Macro System

| Macro | Plugin | Behavior |
|-------|--------|----------|
| `auth: true` | `authPlugin` (`plugins/auth.ts:32`) | Rejects 401 if no valid token; injects `user: { userId }` |
| `optionalAuth: true` | `authPlugin` (`plugins/auth.ts:40`) | Sets `user = null` if no token, no error |
| `operatorOnly: true` | `roleGuardPlugin` (`plugins/role-guard.ts:12`) | Implies `auth: true`; checks `Role.Operator` in `user_identities` |
| `founderOnly: true` | `roleGuardPlugin` (`plugins/role-guard.ts:19`) | Implies `auth: true`; checks `Role.Founder` in `user_identities` |

### Role Model (`user_identities` table)

- `Role.Founder = 0` — granted on first `POST /projects` (upsert)
- `Role.Operator = 1` — seeded or assigned out-of-band
- A user can hold both roles simultaneously

### OTP Login Flow

1. `POST /auth/send-code` → proxy to external system's `send-code.php`
2. `POST /auth/verify-code` → proxy to external system's `verify-code.php`
3. On success, API sets `Set-Cookie: shenicest_token=<jwt>; httpOnly; secure; sameSite=lax; maxAge=30d`
4. `POST /auth/logout` → removes cookie

### External Auth Client (`apps/api/src/lib/shenicest-client.ts:1`)

- `SHENICEST_API_BASE` env var (required)
- `getCsrfToken()` → fetches CSRF token + session cookies from external system
- `sendCode()`, `verifyCode()`, `refreshToken()` — proxy functions
- `refreshToken()` exists but is **not wired to any route** (known gap)

---

## 7. Shared Constants (`packages/shared/src/index.ts:1`)

```ts
ProjectStatus = { Draft: 0, PendingReview: 1, RevisionRequired: 2, Live: 3, Delisted: 4, Rejected: 5 }
ProposalStatus = { Pending: 0, Approved: 1, Rejected: 2, RevisionRequired: 3 }
ProjectStage = { MVP: 0, Growth: 1 }
Role = { Founder: 0, Operator: 1 }
CATEGORIES = ['女性健康', '效率工具', '教育学习', '开发者工具', '生活方式', '其他']
```

Each constant is both a value object and a TypeScript type (via `as const` + indexed type).

---

## 8. Key Design Decisions (ADRs)

### ADR-0004: Content on Project with Edit Proposals (`docs/adr/0004-content-on-project-with-edit-proposals.md:1`)

**Supersedes ADR-0001**. Decision: fold all content fields onto `projects` row. Replace `project_revisions` with `project_edit_proposals` storing a JSON diff. Pre-live edits modify `projects` directly; post-live edits create proposals. Trade-off: no full version history in v1.

### ADR-0005: Single Status Field on Project (`docs/adr/0005-single-status-field-on-project.md:1`)

**Supersedes ADR-0002**. Decision: single `tinyint status` on `projects` stores the full lifecycle (0-5). Pre-live transitions operate on `projects.status`; post-live edits never change `projects.status`. Eliminates the dual-field sync problem.

### ADR-0006: No Denormalized Filter Fields (`docs/adr/0006-no-denormalized-filter-fields.md:1`)

**Supersedes ADR-0003**. Decision: no `live_categories` / `live_stage` copies. `categories` and `stage` on `projects` serve as both source of truth and filter target. Zero-JOIN homepage filtering preserved. Category filtering uses `JSON_CONTAINS`.

### Superseded ADRs

- **ADR-0001** (Project/Revision separation) → replaced by ADR-0004
- **ADR-0002** (No project status field) → replaced by ADR-0005
- **ADR-0003** (Denormalized filter fields) → replaced by ADR-0006

---

## 9. Environment Variables

| Variable | Side | Required | Purpose |
|----------|------|----------|---------|
| `DATABASE_URL` | API | Yes | MySQL connection string |
| `SHENICEST_JWT_SECRET` | API | Yes | HS256 secret for external JWT verification |
| `SHENICEST_API_BASE` | API | Yes | External auth system base URL |
| `PORT` | API | No | Server port (default: 3000) |
| `NODE_ENV` | API | No | `production` enables secure cookies |
| `API_URL` | Web | No | Backend address (default: `http://localhost:3000`) |

---

## 10. Known Gaps & TODOs

From `docs/auth.md:137-207`:

1. **OTP endpoints have zero rate limiting** — no frequency cap on send-code or verify-code
2. **JWT claims not validated at runtime** — `user_id as number` cast could produce `"undefined"`
3. **No session refresh** — `refreshToken()` exists but is unused; cookie `maxAge` 30d may outlive JWT `exp`
4. **CORS too broad** — `/\.vercel\.app$/` allows any Vercel subdomain with `credentials: true`
5. **Role check per-request DB query** — `operatorOnly`/`founderOnly` query `user_identities` every time
6. **`/api/me` is two serial upstream calls** — should be consolidated into a single API endpoint
7. **`AuthUser` context is thin** — only `userId` injected; handlers needing email must re-parse token
8. **No unified 401 handling on frontend** — expired token causes per-component errors, no global redirect
