# 08 — Operator backend (review + management + audit records + statistics)

**What to build:** Complete operator backend API covering four areas: (1) Review actions — split into **project-level** (first submission: approve / require-revision / reject; delist / restore) and **proposal-level** (post-live edit: approve / reject / require-revision). Each action creates an AuditRecord. (2) Project & proposal management — list all projects with filters (stage, status, category), list pending proposals, search, sort. (3) Audit records — queryable list of all operator actions. (4) Statistics — aggregated project data.

**Blocked by:** 03 — UserIdentity module, 04 — Project + ProjectEditProposal schema + core service

**Status:** ready-for-agent

- [ ] All endpoints require `operator` role (403 for non-operators).
- [ ] **Project-level review (first submission)**:
  - [ ] POST /operator/projects/:id/approve: `status 1 → 3` (Live). Fails if `status != 1`. AuditRecord created (action=approve, proposal_id=null).
  - [ ] POST /operator/projects/:id/require-revision: `status 1 → 2` (Revision Required). Body: `{ reason }`. AuditRecord created with reason.
  - [ ] POST /operator/projects/:id/reject: `status 1 → 5` (Rejected, terminal). Body: `{ reason }`. AuditRecord created with reason.
  - [ ] POST /operator/projects/:id/delist: `status 3 → 4` (Delisted). Body: `{ reason }`. AuditRecord created with reason. Any pending proposal on the project stays pending (operator should reject it separately).
  - [ ] POST /operator/projects/:id/restore: `status 4 → 3` (Live). AuditRecord created.
- [ ] **Proposal-level review (post-live edit)**:
  - [ ] POST /operator/proposals/:proposalId/approve: apply the proposal's `changes` diff to the `projects` row (partial PATCH), proposal `0 → 1` (Approved). Project stays `status=3`. AuditRecord created (action=approve, proposal_id set).
  - [ ] POST /operator/proposals/:proposalId/reject: proposal `0 → 2` (Rejected). Project row unchanged. Body: `{ reason }`. AuditRecord created with reason + proposal_id.
  - [ ] POST /operator/proposals/:proposalId/require-revision: proposal `0 → 3` (Revision Required). Body: `{ reason }`. AuditRecord created with reason + proposal_id.
- [ ] Invalid state transitions return 400 (e.g. approving a project not in Pending Review, approving an already-approved proposal, delisting a non-Live project).
- [ ] GET /operator/projects: project management list — filter by stage/status/category, search by name/founder, sort by metrics.
- [ ] GET /operator/proposals: review queue of pending proposals (`status=0`), optionally filtered by project/stage/category.
- [ ] GET /operator/projects/:id/proposals: proposal history for a project.
- [ ] GET /operator/audit-records: filter by project, time range; `proposal_id` shown when applicable.
- [ ] GET /operator/stats: aggregated counts (total projects, by status, by stage, by category).
- [ ] Tests cover: each project-level review action with valid/invalid transitions, each proposal-level review action with valid/invalid transitions, AuditRecord creation (with correct proposal_id nullability), diff application on proposal approval, operator-only access, management list filters, audit record queries.
