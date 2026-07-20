# No denormalized filter fields

> **Status: Accepted** — supersedes [ADR-0003](./0003-denormalized-filter-fields.md).

## Context

ADR-0003 duplicated `live_categories` (JSON) and `live_stage` (tinyint) onto the `projects` row, synced from the Live revision at approval time. The goal was zero-JOIN homepage filtering — filter queries hit only `projects`, never joining `project_revisions`.

That duplication existed **because** content lived on a separate `project_revisions` table. ADR-0004 moves content back onto the `projects` row directly. `categories` (JSON) and `stage` (tinyint) are now columns on `projects` — the source of truth and the filter target are the same row.

## Decision

Do not carry over `live_categories` / `live_stage` denormalized copies. Use the `categories` and `stage` columns on `projects` directly for both source-of-truth storage and homepage filtering.

```sql
-- Homepage filter query, single table, zero JOIN
SELECT id, name, tagline, cover_url, stage, categories
FROM projects
WHERE status = 3                       -- Live
  AND stage = ?                        -- optional
  AND JSON_CONTAINS(categories, ?)     -- optional
ORDER BY created_at DESC
LIMIT ? OFFSET ?;
```

## Considered Options

- **Keep denormalized `live_*` copies**: Rejected — they'd be exact duplicates of `categories`/`stage` on the same row. Pure overhead and a sync hazard with zero benefit.
- **Materialized view / generated columns**: Overkill for v1.0 row counts. Revisit if filtering becomes a hotspot.

## Consequences

- **One source of truth**: `categories` and `stage` on `projects`. No write-on-approve sync step, no drift risk.
- **Zero-JOIN filtering preserved**: the homepage still reads a single table — the original performance goal of ADR-0003 is maintained, just without the duplication.
- **JSON filtering**: category filtering uses `JSON_CONTAINS` (MySQL) or equivalent on the `categories` column. Ensure the column has an appropriate index (multi-valued index on MySQL 8.0+, or a generated boolean column per category if the category set is fixed and small — the spec's category set is six values, so this is viable).
- **New filter dimensions**: adding a new filter dimension in the future just means adding a column to `projects` — no separate denormalized `live_*` field to keep in sync.
