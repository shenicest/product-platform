# Content on Project with ProjectEditProposal

> **Status: Accepted** — supersedes [ADR-0001](./0001-project-revision-separation.md).

## Context

The PRD requires that when a Founder edits a Live project, the old version remains publicly visible until the new version is approved. ADR-0001 solved this with a two-table design: `projects` (identity/lifecycle container, no content) + `project_revisions` (full content snapshots, one row per version). ADR-0002 derived Project state from the revision chain; ADR-0003 denormalized `live_categories`/`live_stage` onto `projects` for zero-JOIN homepage filtering.

After shipping reflection, the team wants to simplify:

- The revision table duplicates almost all content fields onto a second table, doubling the schema surface area.
- Every public read (list + detail) joins or follows `live_revision_id` to the revision table.
- The denormalized `live_*` copy is a sync hazard — if it drifts, filtering breaks silently.
- Most post-live edits touch only a few fields (description, demo link, contact info). Storing a full content snapshot per edit is wasteful and hides what actually changed from the reviewing operator.

## Decision

Fold all displayable content back onto the `projects` row. Replace `project_revisions` with a `project_edit_proposals` table that records a **JSON diff of changed fields only** — not a full snapshot.

- **Pre-live edits** (Draft / Revision Required): the Founder edits the `projects` row directly. Pending Review is read-only. No proposal is involved.
- **Post-live edits** (project is `status=3` Live): the Founder creates a `project_edit_proposals` row with a `changes` JSON object containing only the fields to modify and their new values. The `projects` row is **not touched** while the proposal is under review, so the old version stays publicly visible. On approval, the diff is applied as a partial PATCH to the `projects` row; on rejection, the `projects` row is left unchanged.

### Schema

- `projects`: holds `id`, `user_id`, `status`, **all content fields** (name, tagline, description, cover, demo, stage, categories, contact info, etc.), timestamps.
- `project_edit_proposals`: `id`, `project_id`, `changes` (JSON diff), `status` (tinyint 0=Pending / 1=Approved / 2=Rejected / 3=Revision Required), `reason`, `reviewed_by`, `reviewed_at`, timestamps. At most one proposal in status `0` or `3` per project (enforced at application level or via a partial unique index).

### Consequences

- **Simpler reads**: public list and detail hit the `projects` table only — no JOIN, no `live_revision_id` indirection.
- **No denormalization needed**: `categories` and `stage` live on `projects`, so zero-JOIN filtering is automatic (ADR-0006).
- **Clearer review surface**: operators see exactly which fields the Founder wants to change (the diff), not a full second copy they have to diff in their head.
- **Lighter writes**: a post-live edit inserts one small JSON diff row, not a full content snapshot.
- **Trade-off — no full version history**: proposals are forward-only diffs. Reconstructing a prior full version would require replaying diffs backward, which v1.0 does not support. The `audit_records` table still captures every operator action for accountability. If full version history becomes a requirement, add a `project_snapshots` table later (see spec "Future Considerations").
- **State machine splits in two**: project-level review (first submission) operates on `projects.status`; proposal-level review (post-live edit) operates on `project_edit_proposals.status`. The API exposes separate endpoint groups for each (see spec "API Contracts").
- **Diff validation**: the proposal API must validate that every key in `changes` is a real editable content field and that each value passes per-field validation. Unknown keys or empty diffs are rejected.
