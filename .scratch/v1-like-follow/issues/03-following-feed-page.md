# 03 — Following feed page

**What to build:** A logged-in user clicks the "关注" nav tab and lands on `/following`. They see a paginated grid of Live projects from every Founder they follow, in the same card layout used on the homepage — the heart and follow buttons on each card reflect the shared interaction Sets, so unfollowing a Founder from this page makes their projects disappear on the next render. When the user follows no one, they see an empty state with a CTA back to the discover page. Anonymous visitors hitting `/following` are redirected to the login page and returned after login.

**Blocked by:** 02 — Follow tracer bullet

**Status:** ready-for-agent

- [ ] `GET /me/following/projects` — auth required, returns Live projects owned by any Founder the caller currently follows. Accepts the same query params as `GET /projects` (pagination, sort, category, stage). Default sort `submitted_at DESC`. Returns an empty page when the caller follows no one
- [ ] `/following` is not middleware-blocked. Anonymous visitors see a login empty state with a Login CTA; after login, the existing return-path flow brings them back to `/following`
- [ ] `/following` route: Server Component page, force-dynamic; fetches via a new `getFollowingProjects()` in `src/server/projects.ts` (React `cache()`); reuses the existing `ProjectCard` grid and `Pagination` component
- [ ] Empty state: title `你还没有关注任何 Founder`, subtitle explaining what follows do, primary CTA `去发现` linking to `/`. Reuses `NotFoundShell` styling or a peer component; no new one-off empty-state component if avoidable
- [ ] Nav: the existing "关注" tab in `SiteHeader` links to `/following` (was placeholder before)
- [ ] Tests (api): `/me/following/projects` requires auth; returns only Live projects; excludes Draft/Pending/Delisted from followed Founders; excludes projects from unfollowed Founders; empty result when caller follows no one; pagination and sort behave the same as `/projects`
- [ ] Tests (web): middleware redirect for anonymous; server fetcher returns expected page shape; grid renders empty state when API returns zero items
- [ ] `bun run build` and `bun test` pass
