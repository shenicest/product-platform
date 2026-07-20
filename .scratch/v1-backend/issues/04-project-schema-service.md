# 04 — Project + ProjectEditProposal schema + core service

**What to build:** The `projects` and `project_edit_proposals` tables with their core service logic. The `projects` row holds BOTH the lifecycle state AND all displayable content directly (id, user_id, status 0-5, name..team_name, timestamps). The `project_edit_proposals` table records a JSON `changes` diff (only changed fields) for post-live edits, with its own status (0-3). The service enforces the project state machine, proposal lifecycle rules, and diff application (partial PATCH).

**Blocked by:** 01 — Project scaffolding + DB setup, 03 — UserIdentity module

**Status:** done

- [x] `projects` table: `id`, `user_id`, `status` (tinyint 0-5), all content fields (name, tagline, description, cover, demo assets, demo link, stage, categories, target users, user problem, progress, next steps, message to users, beta settings, contact info, team name), `created_at`, `updated_at`. Index on `(user_id)`, `(status)`, `(stage)`. _`categories` filtering index deferred to issue 07 (see notes)._
- [x] `project_edit_proposals` table: `id`, `project_id`, `changes` (JSON diff of changed content fields), `status` (tinyint 0=Pending / 1=Approved / 2=Rejected / 3=Revision Required), `reason` (text, nullable), `reviewed_by` (varchar, nullable), `reviewed_at` (timestamp, nullable), `created_at`, `updated_at`. At most one proposal in status 0/3 per project (app-level or partial unique index).
- [x] Project state machine (pre-live): valid transitions enforced (0→1, 1→2, 2→1, 1→3, 1→5); invalid transitions rejected (e.g. approving a draft, creating a proposal on a non-Live project).
- [x] Proposal lifecycle rules: create proposal leaves Project row untouched; approve applies diff as partial PATCH; reject leaves Project unchanged; require-revision (3) allows resubmit on same proposal (3→0); only one pending/revision-required proposal per project.
- [x] Diff application: only changed fields in `changes` are overwritten on the Project row; unchanged fields keep their previous values. Diff key validation (known content fields only).
- [x] AuditRecord integration: operator actions create `audit_records` rows with `proposal_id` set for proposal-level actions, null for project-level actions.
- [x] Tests cover: all valid project status transitions, all invalid transitions rejected, proposal create/approve/reject/require-revision flows, diff application correctness (partial PATCH), single-pending-proposal constraint, diff key validation.

**Implementation notes:**
- Schema: `src/db/schema/project.ts`, `project-edit-proposal.ts`, `audit-record.ts` (+ `audit_records` table for the integration); migration `drizzle/0002_flippant_lethal_legion.sql`.
- Service: `src/modules/project/service.ts` (`ProjectService`), domain enums/errors + `EDITABLE_PROJECT_FIELDS` allowlist in `src/modules/project/model.ts`. No HTTP routes yet — controllers land in issues 05/08.
- Project methods: `createProject`, `saveDraft` (status 0|2 only), `submitForReview` (0|2→1), `approveProject` (1→3), `requireProjectRevision` (1→2), `rejectProject` (1→5), `delistProject` (3→4), `restoreProject` (4→3).
- Proposal methods: `createProposal` (project must be Live), `updateProposal` (3→0 resubmit), `approveProposal` (applies diff, 0→1), `rejectProposal` (0→2), `requireProposalRevision` (0→3).
- Operator actions run in a transaction (status change + `audit_records` insert); founder actions create no audit record.
- Diff keys validated against `EDITABLE_PROJECT_FIELDS`; empty/unknown keys rejected. Direct writes (`createProject`/`saveDraft`) are sanitized to editable fields (`pickEditable`) so `status`/`id`/`userId` can't be injected to bypass the state machine.
- Single pending/revision-required proposal enforced at app level (check-then-insert; MySQL has no partial unique index).
- `categories` filtering index deferred to issue 07 per ADR-0006 ("overkill for v1.0 row counts"); Drizzle can't express a multi-valued JSON index, so issue 07 will add one if `EXPLAIN` on the filter query warrants it.
- Tests: `test/modules/project/service.test.ts` (48 cases).
