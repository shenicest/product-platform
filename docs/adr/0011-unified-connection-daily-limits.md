# Connection daily limits share one scoped table

> **Status: Accepted**

## Context

[ADR-0010](./0010-hackathon-connection-separate-table.md) kept `hackathon_connection_requests` separate from `connection_requests` and, as a side effect, gave hackathon its own isomorphic daily-limit table (`hackathon_connection_daily_limits`). After both features shipped, the two limit tables turned out to be byte-for-byte identical in shape and semantics: `(sender_user_id, beijing_date) -> successful_count`, incremented only on successful creation inside the create transaction (`INSERT IGNORE` + `FOR UPDATE`).

The reason `connection_requests` must stay split — opposite `projectId` semantics, different receiver preconditions, different lifecycle hooks — does not apply to the counter table. A counter only answers "how many successful creations has this sender made today *for this surface*"; a `scope` column expresses that distinction fully, with no polymorphic meaning-flipping fields.

## Decision

Merge the daily-limit counters into a single `connection_daily_limits` table with a `scope` column (`talent_connection` / `hackathon_connection`, constants in `src/db/schema/connection-daily-limit.ts`), unique on `(scope, sender_user_id, beijing_date)`. The `hackathon_connection_daily_limits` table is dropped by migration 0022, which copies its rows in under the `hackathon_connection` scope.

This supersedes only the daily-limit part of ADR-0010; the request tables themselves remain separate.

## Considered Options

- **Keep two isomorphic tables** — Rejected. The isolation argument from ADR-0010 bought nothing here (no semantic conflicts to isolate), and every future connection surface would pay for a new table plus a third copy of the same transaction pattern.
- **Fold counters into `rate_limit_counters`** — Rejected. That table serves HTTP-layer burst limiting (pre-consumed on entry, UTC-aligned windows, HMAC-hashed keys, fail-closed), while daily quotas are post-consumed on success and keyed by Beijing business date. Merging them couples two different failure/retry semantics into one schema.

## Consequences

- **One table, one transaction pattern** — new connection surfaces add a `ConnectionDailyLimitScope` constant, not a table.
- **Scopes are separate quota pools** — Talent and hackathon allowances never consume each other, matching the previous two-table behavior exactly.
- **Migration 0022 carries a data move** — it is not a pure schema diff; the INSERT…SELECT before the DROP must stay in order.
- **Request tables stay split** — see ADR-0010's future-unification note; the shared `ConnectionTarget` abstraction, if it ever comes, sits above both request tables and this counter table.
