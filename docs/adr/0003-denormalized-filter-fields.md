# Superseded — Denormalized `live_categories` and `live_stage` on Project

> **Status: Superseded** by [ADR-0006 — No denormalized filter fields](./0006-no-denormalized-filter-fields.md).

The original decision duplicated `live_categories` (JSON) and `live_stage` (tinyint) on the Project row, synced from the Live revision at approval time, so homepage filtering could avoid joining `project_revisions`. With content now living directly on the `projects` row (ADR-0004), the source of truth and the filter target are the same row — the duplicate copy is unnecessary and a sync hazard. See ADR-0006.

---

## Original Decision (superseded)

Project stores `live_categories` (JSON array) and `live_stage` (tinyint) — copies of data from the Live revision, synced at approval time. This allows homepage filtering by category and stage without joining ProjectRevision.

### Considered Options

- **JOIN through `live_revision_id`**: Normalized, but every filter query requires a join to ProjectRevision.
- **Denormalized fields on Project**: Duplicated data, but filter queries hit only the Project table. Write cost is negligible — sync happens once per approval.

### Consequences

- Source of truth remains ProjectRevision. Denormalized fields are write-on-approve, read-many.
- If a Live revision is somehow modified without going through approval (shouldn't happen), denormalized fields could drift out of sync.
- Adding new filter dimensions in the future means adding new `live_*` fields to Project.
