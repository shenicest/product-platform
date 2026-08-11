# 01 — Like tracer bullet

**What to build:** A logged-in user opens the homepage or a project detail page, clicks the heart on any project card, and the like count ticks up. Refreshing the page keeps the button lit — state is hydrated on the server, not fetched after paint. Anonymous visitors see the count and can click the heart, but clicking opens the login flow instead of mutating. Every liked-state button on the page reflects the same shared Set, so liking a project once updates every card for that project on that page without prop drilling.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Schema: `project_likes(project_id, user_id, created_at)` with unique index on `(project_id, user_id)`; `projects.like_count int not null default 0`; drizzle migration generated and applied to test DB
- [ ] `POST /projects/:id/like` — auth required, idempotent (returning the current state, not erroring on re-like), refuses with `NotLikable` when the target project's status is not Live, atomically inserts the like row and increments `like_count` only when the row actually did not exist
- [ ] `DELETE /projects/:id/like` — auth required, idempotent (no-op when caller never liked), atomically deletes the row and decrements `like_count` only when the row actually did exist; tolerant of non-Live target (unliking a delisted project must still work — existing likes survive delisting per ADR)
- [ ] `GET /me/likes` — auth required, returns `{ liked_project_ids: number[] }` unbounded per ADR-0009
- [ ] `like_count` field surfaced on every project payload the frontend already reads: list items, detail response, featured, founder-backend, operator-backend
- [ ] `UserInteractionProvider` (client component) exposes `liked: Set<number>`, `like(id)`, `unlike(id)`; it receives serializable `initialLikedProjectIds: number[]` and converts them to a Set; optimistic update with rollback on network/API error; scaffolded to also hold a follows Set (empty in this ticket — ticket 02 fills it)
- [ ] The public interaction route boundary, not the root layout, reads `shenicest_token` and calls `/me/likes` (via a cached `getMyLikes()` in `src/server/interactions.ts`); when no cookie, passes an empty array; root layout remains static
- [ ] Login success in `AuthProvider` calls `router.refresh()` so the public interaction boundary re-runs under the new cookie and re-hydrates the Set (per ADR-0009)
- [ ] Logout clears the Set locally without a network round-trip
- [ ] `LikeButton` component: renders count + heart; reads `liked.has(projectId)` for state; unauth click routes through the existing login modal and completes the like on success; wired into `ProjectCard` (list, featured, following, founder page later) and the project detail page
- [ ] Tests (api): idempotent double-like → single row, single count increment; unlike on never-liked → no-op, count unchanged; `NotLikable` on Draft/Pending/RevisionRequested/Rejected/Delisted create; unlike still works on Delisted target; concurrent likes from same user do not double-count (unique index enforces)
- [ ] Tests (api): `GET /me/likes` returns exactly the current caller's likes across mixed users
- [ ] Tests (web): `LikeButton` unit test covers optimistic tick, rollback on error, unauth click opens login; `UserInteractionProvider` test covers hydration from initial props + optimistic mutation
- [ ] `bun run build` (root — both api + web) and `bun test` (both suites) pass
