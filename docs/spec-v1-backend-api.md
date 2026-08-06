# Spec: Product Showcase Platform v1.0 Backend API

## Problem Statement

Founders building early-stage products have no centralized platform to showcase their work, gather feedback, and connect with potential users. Operators need a way to curate and manage submitted projects to maintain quality. Users want to discover interesting new products and provide feedback to creators.

The platform needs a backend API that supports project submission, review workflows, public browsing, and private feedback — all while maintaining clear separation between what's publicly visible and what's under review.

## Solution

A backend API built with Elysia + Drizzle that implements:
- **Project lifecycle management**: Founders submit projects, which go through a review process before becoming publicly visible
- **Post-live edit proposals**: Edits to an already-Live project go through a `project_edit_proposals` record (a JSON diff of changed fields). Operators approve the diff before it is applied to the live Project row, so the old version stays publicly visible while changes are under review.
- **Single status field**: A Project's full lifecycle (Draft → Pending Review → Live → Delisted, etc.) is captured in one `status` field on the Project row — no separate status table to keep in sync.
- **Role-based access**: Users, Founders, and Operators have different permissions and visibility
- **Private feedback**: Comments are submitted but only visible to Founders and Operators (not publicly displayed in 1.0)
- **Zero-JOIN filtering**: Because content lives directly on the Project row, homepage filtering by category/stage reads one table — no denormalized copy needed.

The system uses an external auth service for JWT tokens, so this backend only consumes identity — it doesn't manage authentication.

## User Stories

### Project Submission & Management

1. As a logged-in user, I want to create a new project draft, so that I can start documenting my product idea
2. As a Founder, I want to save my project as a draft multiple times, so that I can work on it incrementally without submitting for review
3. As a Founder, I want to submit my project for review, so that operators can evaluate whether it meets platform standards
4. As a Founder, I want to receive validation errors pointing to the first missing required field when I submit, so that I know exactly what to fix
5. As a Founder, I want to view my project while it's pending review, so that I can see what I submitted — and edit it in place if I spot something to fix
6. As a Founder, I want to see the operator's revision requirements when my project needs changes, so that I know what to improve
7. As a Founder, I want to edit my project after receiving revision requirements, so that I can address the feedback and resubmit
8. As a Founder, I want to see the rejection reason when my project is rejected, so that I understand why it wasn't approved
9. As a Founder, I want to edit my live project's description and demo link, so that I can keep information up-to-date
10. As a Founder, I want my edits to a live project to create a proposal for review (recording only the changed fields), so that the old version remains visible while changes are evaluated
11. As a Founder, I want to see all my projects in a dashboard, so that I can track their status and progress
12. As a Founder, I want to filter my projects by status (draft, pending, live, etc.), so that I can focus on projects needing attention
13. As a Founder, I want to see aggregate statistics (total projects, live count, pending count), so that I understand my portfolio at a glance
14. As a Founder, I want to search my projects by name, so that I can quickly find a specific project

### Public Browsing & Discovery

15. As a visitor (no login), I want to browse all live projects, so that I can discover interesting new products
16. As a visitor, I want to filter projects by category, so that I can find products in areas I care about
17. As a visitor, I want to filter projects by stage (MVP vs growth), so that I can find products at the maturity level I'm interested in
18. As a visitor, I want to search projects by name or founder name, so that I can find specific products or creators
19. As a visitor, I want to combine multiple filters, so that I can narrow down results precisely
20. As a visitor, I want to sort projects by latest, most commented, or recently updated, so that I can browse in my preferred order
21. As a visitor, I want to see paginated results, so that I can browse large project lists without performance issues
22. As a visitor, I want to view a project's detail page, so that I can learn about its features, demo, and founder
23. As a visitor, I want to see a "not available" message when accessing a non-live project, so that I understand why I can't view it
24. As a visitor, I want to see an empty state when no projects match my filters, so that I know to adjust my search

### Operator Review & Management

25. As an operator, I want to view all submitted projects, so that I can manage the platform's content
26. As an operator, I want to filter projects by status, so that I can focus on pending reviews
27. As an operator, I want to filter projects by stage, category, or other attributes, so that I can organize my review workflow
28. As an operator, I want to search projects by name or founder name, so that I can find specific submissions
29. As an operator, I want to sort projects by various metrics, so that I can prioritize my review queue
30. As an operator, I want to approve a pending project, so that it becomes publicly visible
31. As an operator, I want to require modifications on a project, so that the founder knows what to improve before approval
32. As an operator, I want to reject a project with a reason, so that the founder understands why it wasn't approved
33. As an operator, I want to delist a live project with a reason, so that I can remove inappropriate content while maintaining an audit trail
34. As an operator, I want to restore a delisted project, so that I can bring it back online if the issue is resolved
35. As an operator, I want to see the full proposal history of a project, so that I can understand its evolution
36. As an operator, I want to view audit records of all my actions, so that I can track what I've done and when
37. As an operator, I want to filter audit records by project or time range, so that I can find specific actions
38. As an operator, I want to see aggregate statistics (total projects, by status, by category), so that I understand platform health

### Comments & Feedback

39. As a logged-in user, I want to submit a comment on a live project, so that I can provide feedback to the founder
40. As a logged-in user, I want to specify my comment type (issue report, feature suggestion, usage feedback, other), so that the founder can categorize feedback
41. As a logged-in user, I want to indicate whether I'm willing to be contacted by the founder, so that I can control my privacy
42. As a logged-in user, I want to provide contact information if I'm willing to be contacted, so that the founder can reach out
43. As a logged-in user, I want to submit multiple comments on the same project, so that I can provide ongoing feedback
44. As a logged-in user, I want to be prevented from commenting on non-live projects, so that I only provide feedback on publicly available products
45. As a Founder, I want to view all comments on my project, so that I can understand user feedback
46. As a Founder, I want to see which commenters are willing to be contacted, so that I can follow up on valuable feedback
47. As a Founder, I want to see flagged comments, so that I'm aware of potentially problematic content
48. As an operator, I want to view comments on any project, so that I can monitor feedback quality and handle issues

### Identity & Access Control

49. As a user, I want my first project submission to automatically grant me the Founder role, so that I don't need a separate registration step
50. As a user, I want to hold multiple roles (founder and operator), so that I can both submit projects and review others
51. As a system, I want to seed an operator user on initialization, so that the platform has at least one reviewer from day one
52. As a non-operator user, I want to be blocked from operator endpoints, so that I can't perform unauthorized actions
53. As a non-founder user, I want to see an appropriate response when accessing founder endpoints, so that I understand I need to submit a project first

## Implementation Decisions

### Architecture & Framework

- **Elysia + Drizzle + Bun**: Type-safe, high-performance stack following conventions in AGENTS.md
- **Module-based structure**: Each domain concept (project, proposal, comment, identity) gets its own module with controller, service, and model files
- **External JWT consumption**: Backend parses tokens from external auth service, decorates `user_id` onto context
- **Role-based guards**: Auth plugin provides guard/macro for marking routes as requiring authentication or specific roles

### Domain Model

- **Project as content + lifecycle holder**: The Project row holds ALL displayable content fields AND the lifecycle `status` (tinyint 0-5). No separate content table. Pre-live edits modify the Project row directly; post-live edits go through a proposal.
- **ProjectEditProposal as a diff record**: Holds only the changed fields as a JSON `changes` object (not a full snapshot). Status (tinyint 0-3): Pending Review / Approved / Rejected / Revision Required.
- **Single status field on Project**: `status` captures the full lifecycle (Draft / Pending Review / Revision Required / Live / Delisted / Rejected). There is no `project_flag` and no derivation from a revision — `status` is the source of truth.
- **No denormalized fields**: `categories` (JSON) and `stage` (tinyint) live directly on the Project row. Homepage filtering reads one table — no JOIN, no duplicated copy to keep in sync.

### State Machine & Proposal Rules

- **Draft phase**: Repeated "save draft" updates the Project row in place (no proposal, no new record).
- **First submission**: Same Project row, `status` transitions `0 → 1` (Pending Review).
- **Edit while pending**: Founder may still edit the Project row in place while `status=1` (Pending Review). The status stays `1` — the operator reviews the updated content.
- **Require modification (first submission)**: Same Project row, `status` transitions `1 → 2` (Revision Required). Founder edits the Project row and resubmits (`2 → 1`).
- **Post-live edit**: Project stays `status=3` (Live). Founder creates a NEW proposal (`status=0` Pending) with a `changes` diff. Project row is untouched; old version stays publicly visible.
- **Approve proposal**: Apply the diff to the Project row (partial PATCH of changed fields); proposal `0 → 1` (Approved). Project stays Live.
- **Reject proposal**: proposal `0 → 2` (Rejected). Project row unchanged.
- **Require revision on proposal**: proposal `0 → 3` (Revision Required). Founder edits the proposal's `changes` diff and resubmits (`3 → 0`). No new proposal created.
- **Approve first submission**: `status` transitions `1 → 3` (Live).
- **Reject first submission**: `status` transitions `1 → 5` (Rejected, terminal — no resubmission; Founder must create a new Project).
- **Delist**: `status` transitions `3 → 4` (Delisted). The Project is hidden. Any pending proposal on the project stays pending (operator should reject it).
- **Restore**: `status` transitions `4 → 3` (Live). Project becomes visible again.

### Why No Denormalized Fields?

Because the Project row IS the content row, `categories` and `stage` are already on the Project table. Homepage filtering (`WHERE status = 3 AND stage = ?`) reads a single table — no JOIN, no duplicated copy to keep in sync. This replaces the prior denormalization strategy (see ADR-0006).

### Schema Design

- **`projects` table**: `id`, `user_id`, `status` (tinyint 0-5), `name`, `tagline`, `description`, `cover_url`, `demo_images` (JSON), `demo_video_url`, `demo_link`, `stage` (tinyint 0-1), `categories` (JSON), `target_users`, `user_problem`, `progress`, `next_steps`, `message_to_users`, `is_open_for_beta`, `beta_description`, `contact_name`, `contact_phone`, `contact_email`, `contact_wechat`, `team_name`, `created_at`, `updated_at`. Index on `(user_id)`, `(status)`, `(stage)`, and a generated-column or JSON index on `categories` for filtering.
- **`project_edit_proposals` table**: `id`, `project_id`, `changes` (JSON — partial diff of changed content fields and their new values), `status` (tinyint 0-3), `reason` (text, nullable — operator's reason on reject/require_revision), `reviewed_by` (varchar, nullable — operator `user_id`), `reviewed_at` (timestamp, nullable), `created_at`, `updated_at`. Unique constraint on `project_id` WHERE `status IN (0, 3)` (at most one pending/revision-required proposal per project — enforced at application level if the DB doesn't support partial unique indexes).
- **`user_identities` table**: `id`, `user_id`, `role` (varchar), `created_at`. Unique constraint on `(user_id, role)`.
- **`comments` table**: `id`, `project_id`, `user_id`, `comment_type` (varchar), `content` (text), `can_contact` (boolean), `contact_info` (varchar, nullable), `is_flagged` (boolean), `created_at`
- **`audit_records` table**: `id`, `project_id`, `operator_id`, `action` (varchar: approve, require_revision, reject, delist, restore), `proposal_id` (nullable, set only when the action targets a post-live edit proposal), `reason` (text, nullable), `created_at`

### API Contracts

- **Project submission (pre-live)**:
  - `POST /projects`: Create a new Project row (`status=0`), grant founder role. Body: initial draft fields (minimum `name`).
  - `PUT /projects/:id/draft`: Update the Project row in place. Validates minimum fields (`name`). Allowed while `status` is `0` (Draft), `1` (Pending Review), or `2` (Revision Required). Editing a Pending Review project keeps it in the review queue — the operator reviews the updated content.
  - `PUT /projects/:id/submit`: Validate all required fields, transition `status` to `1` (Pending Review). Allowed from `0` or `2`.

- **Post-live edit proposals**:
  - `POST /projects/:id/proposals`: Create a proposal (`status=0` Pending). Body: `{ changes }` — a JSON object of changed content fields. Precondition: project `status=3` (Live) and no other proposal in `0`/`3` for this project.
  - `PUT /projects/:id/proposals/:proposalId`: Update the proposal's `changes` diff and transition `3 → 0` (resubmit). Only allowed when the proposal is in `status=3` (Revision Required).
  - `GET /projects/:id/proposals`: Founder views own proposal history on the project.
  - `GET /projects/:id/proposals/:proposalId`: View a single proposal (founder on own project; operator on any).

- **Project detail**:
  - `GET /projects/:id`: Return the Project content directly, enriched with `founder` — the founder's public profile (`nickname`, `avatarUrl`) read from the shared users table, or `null` when the founder has no profile there. `status=3` → public. Non-Live → 404 for regular users, full content for founder/operator.

- **Project list**:
  - `GET /projects`: Paginated list of `status=3` (Live) projects. Query params: `category`, `stage`, `q` (search), `sort`, `cursor`/`offset`, `limit`. Reads the `projects` table only — zero JOIN.

- **Founder backend**:
  - `GET /founder/projects`: List own projects with filters (status, stage, search).
  - `GET /founder/stats`: Aggregate counts.
  - `GET /founder/projects/:id/audit-reason`: Latest audit reason (revision required / rejection / delisting).
  - `GET /founder/projects/:id/proposals`: List own proposals for the project (alias of `GET /projects/:id/proposals` with founder-role enforcement).

- **Operator backend**:
  - `GET /operator/projects`: List all projects with filters (status, stage, category), search, sort.
  - `GET /operator/proposals`: Review queue of pending proposals (`status=0`), optionally filtered.
  - `GET /operator/projects/:id/proposals`: Proposal history for a project.
  - **Project-level review actions (first submission)**:
    - `POST /operator/projects/:id/approve`: `status 1 → 3` (Live). Fails if `status != 1`.
    - `POST /operator/projects/:id/require-revision`: `status 1 → 2`. Body: `{ reason }`.
    - `POST /operator/projects/:id/reject`: `status 1 → 5` (terminal). Body: `{ reason }`.
    - `POST /operator/projects/:id/delist`: `status 3 → 4`. Body: `{ reason }`.
    - `POST /operator/projects/:id/restore`: `status 4 → 3`.
  - **Proposal-level review actions (post-live edit)**:
    - `POST /operator/proposals/:proposalId/approve`: apply diff to Project, proposal `0 → 1`.
    - `POST /operator/proposals/:proposalId/reject`: proposal `0 → 2`. Body: `{ reason }`.
    - `POST /operator/proposals/:proposalId/require-revision`: proposal `0 → 3`. Body: `{ reason }`.
  - `GET /operator/audit-records`: Query audit records (filter by project, time range).
  - `GET /operator/stats`: Aggregate statistics.

- **Comments**:
  - `POST /projects/:id/comments`: Submit comment (auth required, project must be `status=3`).
  - `GET /founder/projects/:id/comments`: Founder views comments on own project.
  - `GET /operator/projects/:id/comments`: Operator views comments on any project.

### Access Control

- **Public routes**: `GET /projects`, `GET /projects/:id` (with conditional visibility), `POST /projects/:id/comments` requires auth.
- **Auth required**: All POST/PUT routes, `GET /founder/*`, `GET /operator/*`.
- **Founder role**: `GET /founder/*`, `POST /projects`, `PUT /projects/:id/*` (draft/submit), `POST/PUT/GET /projects/:id/proposals` (own project).
- **Operator role**: `GET /operator/*`, `POST /operator/*` (project-level and proposal-level review actions).

### Validation

- **Project submission**: All required fields validated on submit. Draft only requires `name`.
- **Proposal submission**: `changes` must be a non-empty JSON object whose keys are valid editable content field names and whose values pass per-field validation. Empty `changes` or unknown keys are rejected.
- **Comment submission**: `content` required (max 500 chars), `comment_type` must be valid enum, `contact_info` required when `can_contact=true`.
- **Operator actions**: `reason` required for `require-revision` and `reject` (both project-level and proposal-level) and `delist`.

### Error Handling

- **Invalid state transitions**: Return 400 with descriptive error (e.g. approving a project not in Pending Review, creating a proposal on a non-Live project, editing a proposal not in Revision Required).
- **Validation errors**: Return 422 with field-level errors.
- **Not found**: Return 404.
- **Unauthorized**: Return 401 (missing/invalid JWT).
- **Forbidden**: Return 403 (insufficient role, or founder accessing another founder's project/proposal).

## Testing Decisions

### Testing Philosophy

- **Test external behavior, not implementation**: Tests should verify API responses and database state, not internal service methods.
- **Use `.handle(Request)` for Elysia testing**: Direct request/response testing without spinning up a server.
- **Mirror `src/` structure in `test/`**: `test/modules/project/project.test.ts` tests `src/modules/project/`.

### Modules to Test

- **Project + Proposal service**: State machine transitions, proposal creation rules, diff application (partial PATCH).
- **Project submission API**: Create, save draft, submit, validation errors, first-submission reject/require-revision.
- **Post-live proposal API**: Create proposal, edit (resubmit after revision required), diff application on approval, project unchanged on rejection.
- **Project detail API**: Public access, founder access, operator access, non-live visibility.
- **Project list API**: Filtering, search, sorting, pagination, single-table performance.
- **Operator backend**: Project-level review actions (approve/require-revision/reject/delist/restore), proposal-level review actions, audit record creation, state transitions.
- **Founder backend**: Project listing, stats, audit reason retrieval, own proposal listing.
- **Comment API**: Submission, validation, visibility rules, flagged content.

### Test Scenarios

- **State machine**: Every valid transition succeeds, every invalid transition fails (e.g. approving a draft, creating a proposal on a non-Live project, editing an approved proposal).
- **Proposal rules**: Create proposal leaves Project row untouched; approve applies the diff; reject leaves Project unchanged; require-revision allows resubmit on the same proposal; only one pending/revision-required proposal per project.
- **Diff application**: Only changed fields are overwritten; unchanged fields keep their previous values.
- **Access control**: Public routes work without auth, protected routes require auth, role-specific routes enforce roles.
- **Filtering**: Category, stage, search, combined filters, empty results — all on the `projects` table.
- **Audit trail**: Every operator action creates an AuditRecord with correct `action`, `proposal_id` (set for proposal-level actions, null for project-level), and `reason`.

### Prior Art

- No existing tests (greenfield project). Establish patterns in first test file, then replicate.

## Out of Scope

The following features are explicitly excluded from v1.0:

- **Hackerathon/activity module**: No activity-specific pages, voting, or leaderboards.
- **Likes, votes, follows, shares**: No social interaction features.
- **Beta applications**: No beta signup or management.
- **Purchase/support**: No e-commerce or payment integration.
- **Public comment display**: Comments are submitted but only visible to Founders and Operators.
- **Frontend UI spec**: This document defines backend API contracts only. Frontend implementation (Next.js App Router) exists in `apps/web/` but its page/routing spec is not covered here. See `docs/spec-v1-frontend.md` for frontend details.
- **Project statistics counters**: No view_count, like_count, vote_count, share_count fields (deferred to 2.0).
- **Project form field**: No "project form" (hardware/software/hybrid) field.
- **Activity association**: No "belonging to activity" field on projects.
- **User profile management**: Backend consumes external auth, doesn't manage user profiles.
- **Notification system**: No email or in-app notifications for review results.
- **File upload service**: Assumes external file storage (S3, etc.) with URLs stored in database.
- **Full content snapshots / version history**: Proposals record only the changed-field diff and do not retain prior full content snapshots. Reconstructing the full prior version of a project is not supported in v1.0 (deferred to 2.0+ if needed).

## Further Notes

### Why ProjectEditProposal instead of ProjectRevision?

The PRD requires that when a Founder edits a Live project, the old version remains publicly visible until the new version is approved. The original design used a `project_revisions` table holding full content snapshots. The redesign replaces this with a `project_edit_proposals` table holding only a JSON diff of changed fields. Rationale:

- **Simpler schema**: One content table (`projects`) instead of two. All reads — public list, public detail, founder dashboard — hit the same row.
- **No denormalization**: `categories` and `stage` live on the Project row, so zero-JOIN filtering is automatic — no `live_categories`/`live_stage` copy to keep in sync.
- **Lighter edits**: A post-live edit records only what changed, not the entire content. Cheaper writes, clearer review surface (operator sees exactly which fields the founder wants to change).
- **Trade-off**: We lose full version history. The diff is forward-only — reconstructing a prior full version requires replaying diffs backward, which v1.0 does not support. This is acceptable for 1.0 (see Out of Scope). The audit_records table still captures every operator action for accountability.

See ADR-0004.

### Why a Single `status` Field on Project?

The original design deliberately avoided a `status` field on Project, deriving state from `live_revision_id` + `project_flag` + `current_revision.status` (ADR-0002). That decision depended on having a separate revision table to derive from. With revisions removed, there is nothing to derive from — so the single `status` field becomes the source of truth. Folding the old `project_flag` (Normal / Terminally Rejected / Delisted) into `status` values (`3` Live / `5` Rejected / `4` Delisted) removes the dual-field synchronization problem ADR-0002 was worried about. See ADR-0005.

### Why No Denormalized `live_*` Fields?

`live_categories` and `live_stage` were duplicated on Project to enable zero-JOIN filtering when content lived on a separate `project_revisions` table. Now that content lives directly on `projects`, the source of truth and the filter target are the same row — the duplicate copy is unnecessary and a sync hazard. See ADR-0006.

### Operator Seeding

The platform needs at least one operator from day one. This is handled via a seed migration or script that creates a UserIdentity record with `role=operator` for a known `user_id`. The actual User record is managed by the external auth system.

### Comment Moderation

Comments are submitted immediately and visible to Founders/Operators without an approval gate. Machine-based content review runs asynchronously and sets `is_flagged=true` on violations. This is a 1.0 simplification — public display (2.0+) will require more sophisticated moderation.

### Terminal Rejection

When a project's first submission is rejected, `status` is set to `5` (Rejected). This is a terminal state — the Founder cannot resubmit and must create a new project. This prevents endless revision loops on fundamentally unsuitable projects. Rejection of a post-live edit proposal does NOT terminal-reject the project — the project stays Live; only the proposal is rejected.

### Delisting vs Rejection

Delisting (`status=4`) is reversible — operators can restore delisted projects back to `status=3` (Live). Terminal rejection (`status=5`) is not — the Founder must start over. This distinction is important for operator workflows.

### Pending Proposals on Delisted Projects

If a project is delisted while it has a pending/revision-required proposal, the proposal is not auto-rejected — it remains in its current status, but the project is hidden. The operator should explicitly reject the stale proposal to clean up the review queue.

### Future Considerations

- **2.0+ features**: Likes, votes, follows, shares, public comments, beta applications, purchase support, activity module.
- **Full version history**: If reconstructing prior project versions becomes a requirement, add a `project_snapshots` table (full content at approval time) alongside the diff-based proposals.
- **Performance**: If project count grows significantly, consider caching aggregate statistics instead of real-time COUNT.
- **File uploads**: Current design stores URLs. May need to integrate with S3/OSS for file management.
- **Notifications**: Email or in-app notifications when project status changes or a proposal is reviewed.
- **Audit log expansion**: May need to track Founder actions (submit, save draft, create/edit proposal) in addition to operator actions.
