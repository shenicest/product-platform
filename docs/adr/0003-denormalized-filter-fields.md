# Denormalized `live_categories` and `live_stage` on Project for zero-JOIN filtering

Project stores `live_categories` (JSON array) and `live_stage` (tinyint) — copies of data from the Live revision, synced at approval time. This allows homepage filtering by category and stage without joining ProjectRevision.

## Considered Options

- **JOIN through `live_revision_id`**: Normalized, but every filter query requires a join to ProjectRevision.
- **Denormalized fields on Project**: Duplicated data, but filter queries hit only the Project table. Write cost is negligible — sync happens once per approval.

## Consequences

- Source of truth remains ProjectRevision. Denormalized fields are write-on-approve, read-many.
- If a Live revision is somehow modified without going through approval (shouldn't happen), denormalized fields could drift out of sync.
- Adding new filter dimensions in the future means adding new `live_*` fields to Project.
