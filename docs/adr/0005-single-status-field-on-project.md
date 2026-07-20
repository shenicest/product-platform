# Single `status` field on Project

> **Status: Accepted** — supersedes [ADR-0002](./0002-no-project-status-field.md).

## Context

ADR-0002 deliberately avoided a `status` field on Project. Effective state was derived from `live_revision_id` + `project_flag` + `current_revision.status`. The rationale was to avoid maintaining two status fields (one on Project, one on the active Revision) that would need to stay in sync during the pre-live phase, where they would be nearly identical.

That derivation depended on a separate `project_revisions` table existing. ADR-0004 removes revisions — content lives on the `projects` row, and there is no revision chain to derive the pre-live lifecycle from. So the question becomes: where does the lifecycle live now?

## Decision

Store the full lifecycle in a single `status` field (tinyint) on the `projects` row. Fold the old `project_flag` values into `status`:

- `0` Draft
- `1` Pending Review
- `2` Revision Required
- `3` Live
- `4` Delisted (was `project_flag = 2`)
- `5` Rejected — terminal, first submission rejected (was `project_flag = 1`)

Drop `project_flag` entirely. Drop `live_revision_id` and `current_revision_id` (no revisions).

### State transitions (pre-live)

- `0 → 1`: Founder submits for review.
- `1 → 2`: Operator requires revision.
- `2 → 1`: Founder edits the `projects` row and resubmits.
- `1 → 3`: Operator approves (project goes Live).
- `1 → 5`: Operator rejects first submission (terminal).

### State transitions (post-live)

- `3 → 4`: Operator delists (project hidden, restorable).
- `4 → 3`: Operator restores.
- Post-live edits do **not** change `projects.status` — the project stays `3` (Live) while a `project_edit_proposals` row tracks the proposed diff. See ADR-0004.

## Considered Options

- **Keep `project_flag` + a separate pre-live status field**: Rejected — this is exactly the dual-field sync problem ADR-0002 was trying to avoid, and now that both concepts live on the same row there's no reason to split them.
- **Derive "is live?" from the existence of an approved proposal / a `live_since` timestamp**: Rejected — a direct `status = 3` check is simpler than computing from metadata, and the terminal-rejection (`5`) and delisted (`4`) states don't fit a timestamp model.

## Consequences

- "Is this project Live?" is a direct `status = 3` check — no derivation, no JOIN.
- The dual-field sync worry from ADR-0002 does not apply: there is only one status field, on one row. The original worry was about Project.status vs Revision.status; with no Revision, there's nothing to sync.
- Terminal rejection and delisting are now first-class status values (`5` and `4`) instead of a separate `project_flag` axis — easier to query, filter, and reason about.
- Post-live edits are cleanly separated: they never touch `projects.status`. The project stays Live; the proposal's own `status` field tracks the review. This keeps the project-level and proposal-level state machines from interfering.
