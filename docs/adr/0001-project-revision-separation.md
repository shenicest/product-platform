# ProjectRevision as a separate entity from Project

PRD requires that when a Live project is edited, the old version remains publicly displayed until the new version is approved. This necessitates a two-table design: Project (identity/lifecycle) and ProjectRevision (content snapshot).

## Considered Options

- **Single Project table with `pending_changes` JSON**: Simpler, but makes the pending content a black box and complicates partial field updates.
- **Separate ProjectRevision table**: More complex, but cleanly separates "what's displayed" from "what's being reviewed" and naturally supports version history.

## Consequences

- Every content read for public display must go through `live_revision_id`.
- AuditRecord references Project, not ProjectRevision, since operator actions are project-scoped.
- Post-live edits create new revisions; pre-live edits update the same revision in place.
