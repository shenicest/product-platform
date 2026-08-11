# Follow targets the User with a Founder role, not the Project

> **Status: Accepted**

## Context

v1.0 PRD ("关注 Founder") introduces a follow relationship so users can subscribe to the creators they care about. Two candidate targets exist:

1. **Follow a Project** — the follow row references a `project_id`.
2. **Follow a User** (who currently holds the `founder` role) — the follow row references a `user_id`.

The PRD's stated goal is "follow the Founder so I see updates on all their work", and it explicitly distinguishes the **关注 (follow Founder)** UI treatment from the **点赞/投票 (like/vote on Project)** UI treatment on cards. In parallel, this codebase already treats a User as a first-class identity with multiple potential roles (see `UserIdentity` in CONTEXT.md): a single `user_id` can hold `founder`, `operator`, and future roles simultaneously.

## Decision

**Follow targets a User** (specifically, a User who currently holds the `founder` role in UserIdentity), not a Project.

The `follows` table columns are:

- `follower_user_id` — the follower (any authenticated User)
- `followee_user_id` — the followed User (must currently have `role=founder`)
- `created_at`

Unique constraint on `(follower_user_id, followee_user_id)`. Non-null on both.

Enforcement:

- **POST `/founders/:userId/follow`** — checks that `:userId` has a `founder` row in `user_identities`. If not → `400 NotAFounder`.
- **Self-follow** — `follower_user_id === followee_user_id` → `400 CannotFollowSelf`.
- **Existing follows survive role changes** — if a followed User's `founder` role were ever revoked, existing rows in `follows` are kept (analog to Like retention on delisted projects; see CONTEXT.md). Only *new* follow creations are blocked by the role check.

Project-level follow is explicitly rejected. In v1.0 the Follow action is shown on the project detail page's Founder card only; project list cards display the Founder follower count as read-only. The action targets the Project's Founder User, not the Project.

## Considered Options

- **Follow a Project** — Rejected. It fragments the relationship: a user following the same Founder's five projects would need five separate follow rows and get five duplicate feed entries when the Founder ships new work. It also creates a data-migration burden if the Founder role concept later expands (e.g. group / studio accounts) — the relationship would need to move from Project to some other entity.

- **Follow a User with no role restriction** — Rejected. A user with no submitted projects has no work to follow, and the PRD scopes the feature to "关注 Founder". Allowing arbitrary user-to-user follows would open questions about a general social graph that v1.0 does not want to answer.

- **Follow a Project *and* auto-derive per-Founder aggregation** — Rejected as over-engineered for v1.0. Deriving "which Founders am I following" from "which Projects am I following" requires a JOIN through `projects.user_id` and a GROUP BY on every read, and it still doesn't match the UX (user thinks they're following a *person*, not a bag of projects).

## Consequences

- **One follow, all their work** — `GET /me/following/projects` becomes a straight-line query: find `followee_user_id`s from `follows`, join to `projects` where `status=3`, order by `created_at DESC`. No dedup needed.
- **Follower count is per-User, not per-Project** — displayed on the project detail page's Founder card and on the Founder dashboard's overview strip. Not displayed on project cards (would be a repeated value across all cards of the same Founder — see spec).
- **Role check must be evaluated at follow time** — the POST endpoint reads `user_identities` to confirm founder status. This is a single indexed lookup; cost is negligible.
- **Future role model can evolve without breaking follows** — because the anchor is `user_id`, not `founder_id` or `project_id`. If the platform later introduces "Studio" or "Team" as another kind of followable entity, that would be a separate relation (or a separate role check on the same `follows` table).
- **UI wording distinction is preserved** — 关注 (follow) targets Users on the backend even though it appears on Project cards on the frontend. The frontend uses the project's `founder.userId` to issue the follow.
