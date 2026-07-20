# Superseded — ProjectRevision as a separate entity from Project

> **Status: Superseded** by [ADR-0004 — Content on Project with ProjectEditProposal](./0004-content-on-project-with-edit-proposals.md).

The original decision (kept below for historical context) used a two-table design: Project (identity/lifecycle container) + ProjectRevision (full content snapshot). This supported the PRD requirement that post-live edits keep the old version visible while the new version is under review.

The redesign folds content back onto the `projects` row and tracks post-live edits via a `project_edit_proposals` table that stores only a JSON diff of changed fields (not a full snapshot). The old-version-stays-visible property is preserved because creating a proposal does NOT touch the Project row — the diff is applied only on approval. See ADR-0004.

---

## Original Decision (superseded)

PRD requires that when a Live project is edited, the old version remains publicly displayed until the new version is approved. This necessitates a two-table design: Project (identity/lifecycle) and ProjectRevision (content snapshot).

### Considered Options

- **Single Project table with `pending_changes` JSON**: Simpler, but makes the pending content a black box and complicates partial field updates.
- **Separate ProjectRevision table**: More complex, but cleanly separates "what's displayed" from "what's being reviewed" and naturally supports version history.

### Consequences

- Every content read for public display must go through `live_revision_id`.
- AuditRecord references Project, not ProjectRevision, since operator actions are project-scoped.
- Post-live edits create new revisions; pre-live edits update the same revision in place.
