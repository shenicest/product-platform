# Stateless project responses with a user-interaction Set on the client

> **Status: Accepted**

## Context

With Like and Follow, every project card and the project detail page need to render two per-user booleans:

- `isLiked` — has the current user liked *this* project?
- `isFollowing` — has the current user followed *this* project's Founder?

There are two shapes for wiring this in:

- **Per-item state on the response** — the API embeds `isLiked` / `isFollowing` on every item in `GET /projects`, `GET /projects/:id`, `GET /me/following/projects`, etc.
- **Global user-interaction Sets on the client** — the API stays anonymous (list responses do not depend on caller identity); the client holds `Set<projectId>` for likes and `Set<userId>` for follows, and each card computes its own state locally.

Cache-friendliness is the tiebreaker here. Anonymous list responses can be reused across users (both SSR-level and CDN-level in the future). Personalized responses cannot.

## Decision

**Project list and detail responses are stateless with respect to the caller.** They do not include `isLiked` / `isFollowing` per item.

Instead:

- Two endpoints return the current user's full interaction sets:
  - `GET /me/likes` → `{ liked_project_ids: number[] }`
  - `GET /me/follows` → `{ followed_founder_user_ids: string[] }`
- The frontend wraps the app in a `UserInteractionProvider` that holds `Set<number>` for liked projects and `Set<string>` for followed Founder user IDs.
- On the server (SSR): the public interaction route boundary checks for the `shenicest_token` cookie. When present, it calls both endpoints in parallel and passes serializable arrays (`initialLikedProjectIds` / `initialFollowedFounderUserIds`) to the client provider. The provider converts those arrays to Sets. When absent, both arrays are empty. The root layout remains static and does not read request cookies.
- On the client: components read `liked.has(projectId)` and `following.has(founder.userId)` for their state. POST/DELETE mutations optimistically update the Sets (idempotent endpoints — see Q16), and roll back on error.
- On login success, the login flow calls `router.refresh()` so the public interaction boundary re-runs against the new cookie and re-hydrates both Sets.
- On logout, the provider clears both Sets.

`GET /me/likes` and `GET /me/follows` return the full list unbounded. At v1.0 scale (an individual user likes tens or low hundreds of projects, follows tens of Founders) the payload is negligible; pagination would create synchronization problems for a Set model with no real benefit.

## Considered Options

- **Embed per-item `isLiked` / `isFollowing` on every list item** — Rejected. The `GET /projects` response becomes per-user, making SSR caching much harder: two visitors on the homepage cannot share a cached response. It also forces the list handler to run two extra IN queries against `project_likes` and `follows` on every request — one for likes on this page's project IDs, one for follows on this page's founder user IDs — that we'd need to add even for cold pages where the user hasn't interacted with anything.

- **Fetch per-item state lazily client-side after render** — Rejected. Cards flash into an "unlit" state before their like/follow buttons hydrate, which reads as a broken UI. It also multiplies request count on grid pages (one request per card).

- **Fetch per-page state client-side after render** — Rejected. Same flicker problem as lazy per-item, plus it means the server-rendered HTML is deliberately wrong on first paint. SSR should render the correct state.

- **Approach 1: Load Sets client-side after `AuthProvider` hydrates** — Considered and rejected. Server-rendered cards would render unlit on first paint, then flip to lit after the client fetch resolves. This is the classic "un-styled → styled" flash for interactive state.

## Consequences

- **List responses cache cleanly** — `GET /projects`, featured lists, project detail, etc. do not depend on the caller. SSR can share renders across visitors and a future CDN edge cache is unblocked.
- **First paint is correct** — RSC fetches the Sets in `layout.tsx` before any card renders, so `liked.has(id)` returns the right value on the very first `ProjectCard` render on the server. No client-side flicker.
- **One extra fetch on authenticated public requests** — the public interaction boundary adds two lookups (`/me/likes` and `/me/follows`) per authenticated interactive page render, in parallel with the page's own data fetch. The root layout and Founder/Operator backend routes do not pay this cost. At v1.0 scale these are cheap (indexed `SELECT` against small per-user rowsets) and they happen at most once per request thanks to `react.cache()`.
- **The Provider is the source of truth** — after optimistic mutation, all cards on the current page update via the shared Set. No prop drilling, no per-card state.
- **Login/logout must trigger a refresh** — login flow needs `router.refresh()` to re-run the RSC layout under the new cookie. Logout clears the Sets locally without a refresh.
- **Scale ceiling** — this pattern assumes the interaction Sets stay small. If a user could like tens of thousands of projects, `/me/likes` returning them all as an array would become a problem. Revisit at that scale with either pagination + a fallback per-item query, or a bloom-filter style membership check. v1.0 is nowhere near that ceiling.
