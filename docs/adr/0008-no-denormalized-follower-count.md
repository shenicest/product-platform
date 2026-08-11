# No denormalized `follower_count` on User

> **Status: Accepted**

## Context

ADR-0007 anchors Follow on a User (currently required to hold `founder` role). Two places display the follower count in v1.0:

- **Project detail page's Founder card** — one value per page render.
- **Project list responses** — each item's `founder` sub-object carries `followerCount`, so a page of 20 project cards needs 20 counts (potentially fewer distinct Users if the same Founder has multiple projects on the page).
- **Founder dashboard overview** — one value for `GET /founder/stats`.

There is a symmetric decision already on the books for Like (ADR-0006 style): `like_count` **is** denormalized on `projects` because Like counts appear on every card and the hot path is a single-table scan of `projects`. So the question is why Follow chooses the opposite.

## Decision

**Do not add a `follower_count` column to the shared users mirror or to any table.** Follower counts are computed on demand via `SELECT COUNT(*) FROM follows WHERE followee_user_id = ?`.

For list endpoints that need a count per Founder across many projects, `followService.countFollowersBatch(userIds: string[])` issues one grouped query:

```sql
SELECT followee_user_id, COUNT(*) AS n
FROM follows
WHERE followee_user_id IN (?, ?, ...)
GROUP BY followee_user_id;
```

The Project list controller then merges these counts into each item's `founder` sub-object.

## Considered Options

- **Denormalize `follower_count` on the shared users mirror** — Rejected. The `users` table is the external auth system's read-only mirror (see CONTEXT.md's "Shared User table"). This service must not write to it. Adding a write dependency on an external-owned table breaks the read-only invariant.

- **Denormalize `follower_count` on a new local table (`user_stats` or `founder_stats`)** — Rejected for v1.0. It buys us a per-row read at the cost of a new table, dual-write bookkeeping on every follow/unfollow, and a reconciliation story for drift. Given expected v1.0 scale — tens of Founders, hundreds of follows per Founder at most — a `COUNT(*)` on an indexed `followee_user_id` column returns in single-digit milliseconds. The batched variant for list endpoints keeps the total query count constant regardless of page size.

- **Denormalize on `projects` (like `like_count`)** — Rejected. Follower count is a User-level property, not a Project-level one. Copying the same count onto every one of a Founder's projects would make the write path pay `N` updates per follow, where `N` is the number of that Founder's Live projects, and every project detail edit would need to defensively re-fetch the count to avoid overwrite.

## Consequences

- **Simpler write path** — a Follow/Unfollow is a single `INSERT`/`DELETE` with no counter maintenance. Idempotent (Q16 decision) via `INSERT IGNORE` / plain `DELETE`. No affected-rows dance required for correctness.
- **List endpoints stay one extra query** — the Project list handler issues its main query plus one batched `countFollowersBatch`. Latency budget is comfortable at v1.0 scale.
- **Follower count is always fresh** — no eventual-consistency window. Un-follow → the next page render shows the decremented count.
- **Revisit if hot** — if `follows` grows large enough that batched COUNT becomes a hotspot, revisit with a materialized `follower_count` on a new `user_stats` table (v2.0+ concern). The batched read path is easy to swap; the write path is where the complexity would land.
- **Diverges from `like_count` on projects intentionally** — Likes are per-Project and appear on every card, so denormalization pays off cleanly there. Follows are per-User and cardinality of Founders on a given page is bounded, so the batched COUNT is cheap enough.
