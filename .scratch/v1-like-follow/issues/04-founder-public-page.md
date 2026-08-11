# 04 — Founder public page (deferred)

**What to build:** Deferred follow-up for a standalone Founder public page. This is intentionally not part of the current Like/Follow delivery; the current delivery exposes Founder data only through project responses and the `/following` feed.

**Blocked by:** 02 — Follow tracer bullet

**Status:** deferred — not part of the current Like/Follow delivery

- [ ] `GET /founders/:userId/projects` — public, returns that Founder's Live projects, paginated, sorted `submitted_at DESC` by default. Accepts the same query params as `GET /projects` (page, pageSize, sort, category, stage). 404s consistently with `GET /founders/:userId` when the userId does not currently hold the founder role
- [ ] `/founders/[userId]` route: Server Component page, force-dynamic; fetches Founder profile and their project page in parallel via `Promise.all`; both go through cached fetchers in `src/server/founders.ts`
- [ ] Reuses `FounderCard` from ticket 02 at the top, followed by the existing `ProjectCard` grid + `Pagination`
- [ ] Non-Founder userId → `notFound()` renders a friendly `not-found.tsx` for the segment using the existing `NotFoundShell` pattern; real 404 status; title `Founder 不存在或已下线`
- [ ] `generateMetadata` derives page title (nickname) and description (bio, truncated) for SEO; OG image uses avatar when present
- [ ] Author name / nickname wherever it appears on a project card links to `/founders/[userId]` (ProjectCard, project detail Founder block) — one line change per site plus a shared link helper if useful
- [ ] Tests (api): `/founders/:userId/projects` returns only Live projects; excludes Draft/Pending/Delisted; 404 on non-Founder userId; pagination and sort behave the same as `/projects`
- [ ] Tests (web): route renders `FounderCard` + project grid; non-Founder userId shows the friendly not-available page with 404 status; anonymous Follow click opens login modal
- [ ] `bun run build` and `bun test` pass
