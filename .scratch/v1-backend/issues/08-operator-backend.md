# 08 — Operator backend (review + management + audit records + statistics)

**What to build:** Complete operator backend API covering four areas: (1) Review actions — split into **project-level** (first submission: approve / require-revision / reject; delist / restore) and **proposal-level** (post-live edit: approve / reject / require-revision). Each action creates an AuditRecord. (2) Project & proposal management — list all projects with filters (stage, status, category), list pending proposals, search, sort. (3) Audit records — queryable list of all operator actions. (4) Statistics — aggregated project data.

**Blocked by:** 03 — UserIdentity module, 04 — Project + ProjectEditProposal schema + core service

**Status:** done

- [x] All endpoints require `operator` role (403 for non-operators).
- [x] **Project-level review (first submission)**:
  - [x] POST /operator/projects/:id/approve: `status 1 → 3` (Live). Fails if `status != 1`. AuditRecord created (action=approve, proposal_id=null).
  - [x] POST /operator/projects/:id/require-revision: `status 1 → 2` (Revision Required). Body: `{ reason }`. AuditRecord created with reason.
  - [x] POST /operator/projects/:id/reject: `status 1 → 5` (Rejected, terminal). Body: `{ reason }`. AuditRecord created with reason.
  - [x] POST /operator/projects/:id/delist: `status 3 → 4` (Delisted). Body: `{ reason }`. AuditRecord created with reason. Any pending proposal on the project stays pending (operator should reject it separately).
  - [x] POST /operator/projects/:id/restore: `status 4 → 3` (Live). AuditRecord created.
- [x] **Proposal-level review (post-live edit)**:
  - [x] POST /operator/proposals/:proposalId/approve: apply the proposal's `changes` diff to the `projects` row (partial PATCH), proposal `0 → 1` (Approved). Project stays `status=3`. AuditRecord created (action=approve, proposal_id set).
  - [x] POST /operator/proposals/:proposalId/reject: proposal `0 → 2` (Rejected). Project row unchanged. Body: `{ reason }`. AuditRecord created with reason + proposal_id.
  - [x] POST /operator/proposals/:proposalId/require-revision: proposal `0 → 3` (Revision Required). Body: `{ reason }`. AuditRecord created with reason + proposal_id.
- [x] Invalid state transitions return 400 (e.g. approving a project not in Pending Review, approving an already-approved proposal, delisting a non-Live project).
- [x] GET /operator/projects: project management list — filter by stage/status/category, search by name/founder, sort by metrics.
- [x] GET /operator/proposals: review queue of pending proposals (`status=0`), optionally filtered by project/stage/category.
- [x] GET /operator/projects/:id/proposals: proposal history for a project.
- [x] GET /operator/audit-records: filter by project, time range; `proposal_id` shown when applicable.
- [x] GET /operator/stats: aggregated counts (total projects, by status, by stage, by category).
- [x] Tests cover: each project-level review action with valid/invalid transitions, each proposal-level review action with valid/invalid transitions, AuditRecord creation (with correct proposal_id nullability), diff application on proposal approval, operator-only access, management list filters, audit record queries.

**Implementation notes:**

- Routes: `src/modules/operator/index.ts` (`operatorModule`, prefix `/operator`, wired in `src/index.ts`) — 13 endpoints, all `operatorOnly: true`. Review actions delegate to the existing `ProjectService` (issue 04/05); query endpoints use a new `OperatorService`. Error mapping: 400 invalid transition, 404 not found, 422 missing reason, 401 unauth, 403 non-operator.
- Service: `OperatorService` (`src/modules/operator/service.ts`) — `listProjects` (filter by status/stage/category via `JSON_CONTAINS`, search by name/contactName/teamName, sort by created_at/updated_at, offset/limit pagination), `listPendingProposals` (status=0 queue, optional project/stage/category filters with JOIN when needed), `listProjectProposals` (full history), `listAuditRecords` (project/time-range filters), `getStats` (total, byStatus/byStage via SQL GROUP BY, byCategory via application-level aggregation of JSON arrays).
- Model: `ReviewReasonBody` (reason required, minLength 1), `ProposalIdParams`, `OperatorProjectQuery`, `OperatorProposalQuery`, `AuditRecordQuery`, `ProjectListResponse`/`ProposalListResponse`/`AuditRecordListResponse` (`{ data, total }`), `StatsResponse`, `ProposalResponse` alias (= `SelectProjectEditProposal`).
- Infrastructure fixes: (1) `src/db/index.ts` — set MySQL session `time_zone = '+00:00'` on pool connections, fixing an 8-hour timestamp mismatch between Bun (UTC) and MySQL (local tz) that broke time-range queries. (2) `src/plugins/role-guard.ts` — broke circular import (`role-guard → user-identity/index → role-guard`) by instantiating `UserIdentityService` locally instead of importing the singleton from the module index.
- Sort by "metrics" deferred: 1.0 has no counter fields (view_count, like_count etc. are 2.0 scope per ADR/spec), so sort options are `created_at`/`updated_at` only.
- Tests: `test/modules/operator/index.test.ts` — 41 cases covering access control (401/403), all 5 project-level review actions with valid+invalid transitions, all 3 proposal-level review actions with valid+invalid transitions, AuditRecord creation with correct proposal_id nullability, diff application on proposal approval, management list filters (status/stage/category/search/sort), pending proposal queue, project proposal history, audit record queries (project filter, time range), and stats aggregation. Full suite 130 pass.
