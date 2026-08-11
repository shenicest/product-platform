# 02 — Follow tracer bullet

**What to build:** A user viewing a project detail page sees a Founder card near the project story: avatar, nickname, follower count, and a Follow button. A logged-in visitor clicks Follow and the button flips to Following with the follower count incremented; clicking again unfollows. Founders viewing their own projects see the card without a Follow button (self-follow is refused server-side too). Following state persists across refresh, hydrated on the server via the same Set-based pattern used for likes.

**Blocked by:** 01 — Like tracer bullet

**Status:** ready-for-agent

- [ ] Schema: `follows(follower_user_id, followee_user_id, created_at)` with unique index on `(follower_user_id, followee_user_id)`; drizzle migration generated and applied to test DB. Note per ADR-0008 there is no denormalized `follower_count` column
- [ ] `POST /founders/:userId/follow` — auth required, idempotent, refuses with `CannotFollowSelf` when `followerUserId === followeeUserId`, refuses with `NotAFounder` when target user does not currently hold an explicit `UserIdentity(role=founder)` record. Inserts the follow row only when it doesn't already exist
- [ ] `DELETE /founders/:userId/follow` — auth required, idempotent (no-op when never followed), tolerant of target losing the founder role (existing follows survive per the same "delisting survives" principle as likes)
- [ ] `GET /me/follows` — auth required, returns `{ followed_founder_user_ids: string[] }` unbounded per ADR-0009
- [ ] Project detail's public `founder` object returns `{ userId, nickname, avatarUrl, followerCount }`; `followerCount` is computed on-demand via `SELECT COUNT(*) FROM follows WHERE followee_user_id = ?` per ADR-0008. No independent Founder public profile endpoint is part of this ticket
- [ ] `UserInteractionProvider` extended: adds `following: Set<string>`, `follow(userId)`, `unfollow(userId)` with the same optimistic + rollback pattern as likes
- [ ] The public interaction route boundary fetches `/me/likes` and `/me/follows` in parallel via `Promise.all` (both via cached fetchers in `src/server/interactions.ts`) when the auth cookie is present; both initial arrays are empty on anonymous; root layout remains static
- [ ] `FollowButton` component: reads `following.has(founderUserId)`; unauth click routes through the login modal and completes the follow on success; hidden or disabled when the current session user is the target Founder
- [ ] `FounderCard` component: avatar, nickname, follower count (live-updates with the follow action), FollowButton. Replaces the current Founder info block on the project detail page
- [ ] Tests (api): idempotent double-follow → single row; unfollow on never-followed → no-op; `CannotFollowSelf`; `NotAFounder` on create for a plain visitor user; unfollow still works after target loses founder role; project detail founder enrichment includes `followerCount`; `followerCount` reflects real row count across follow/unfollow churn
- [ ] Tests (api): `GET /me/follows` returns exactly the current caller's follows
- [ ] Tests (web): `FollowButton` unit test covers optimistic flip, rollback on error, hidden for self, unauth click opens login; `FounderCard` renders correct count from provider; extending `UserInteractionProvider` still hydrates likes correctly (regression check against ticket 01)
- [ ] `bun run build` and `bun test` pass
