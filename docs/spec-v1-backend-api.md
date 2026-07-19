# Spec: Product Showcase Platform v1.0 Backend API

## Problem Statement

Founders building early-stage products have no centralized platform to showcase their work, gather feedback, and connect with potential users. Operators need a way to curate and manage submitted projects to maintain quality. Users want to discover interesting new products and provide feedback to creators.

The platform needs a backend API that supports project submission, review workflows, public browsing, and private feedback — all while maintaining clear separation between what's publicly visible and what's under review.

## Solution

A backend API built with Elysia + Drizzle that implements:
- **Project lifecycle management**: Founders submit projects, which go through a review process before becoming publicly visible
- **Version-controlled content**: All displayable content lives in ProjectRevision snapshots, allowing edits to be reviewed without disrupting the live version
- **Role-based access**: Users, Founders, and Operators have different permissions and visibility
- **Private feedback**: Comments are submitted but only visible to Founders and Operators (not publicly displayed in 1.0)
- **Zero-JOIN filtering**: Denormalized fields on Project enable fast homepage filtering without expensive joins

The system uses an external auth service for JWT tokens, so this backend only consumes identity — it doesn't manage authentication.

## User Stories

### Project Submission & Management

1. As a logged-in user, I want to create a new project draft, so that I can start documenting my product idea
2. As a Founder, I want to save my project as a draft multiple times, so that I can work on it incrementally without submitting for review
3. As a Founder, I want to submit my project for review, so that operators can evaluate whether it meets platform standards
4. As a Founder, I want to receive validation errors pointing to the first missing required field when I submit, so that I know exactly what to fix
5. As a Founder, I want to view my project while it's pending review, so that I can see what I submitted
6. As a Founder, I want to see the operator's revision requirements when my project needs changes, so that I know what to improve
7. As a Founder, I want to edit my project after receiving revision requirements, so that I can address the feedback and resubmit
8. As a Founder, I want to see the rejection reason when my project is rejected, so that I understand why it wasn't approved
9. As a Founder, I want to edit my live project's description and demo link, so that I can keep information up-to-date
10. As a Founder, I want my edits to a live project to create a new revision for review, so that the old version remains visible while changes are evaluated
11. As a Founder, I want to see all my projects in a dashboard, so that I can track their status and progress
12. As a Founder, I want to filter my projects by state (draft, pending, live, etc.), so that I can focus on projects needing attention
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
35. As an operator, I want to see the full revision history of a project, so that I can understand its evolution
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
- **Module-based structure**: Each domain concept (project, comment, identity) gets its own module with controller, service, and model files
- **External JWT consumption**: Backend parses tokens from external auth service, decorates `user_id` onto context
- **Role-based guards**: Auth plugin provides guard/macro for marking routes as requiring authentication or specific roles

### Domain Model

- **Project as identity container**: Holds only lifecycle fields (`id`, `user_id`, `current_revision_id`, `live_revision_id`, `project_flag`, denormalized `live_categories`/`live_stage`). No displayable content.
- **ProjectRevision as content snapshot**: Holds ALL displayable fields (name, description, cover, demo, stage, categories, contact info, etc.) with its own status (0-5).
- **Derived project state**: No `Project.status` field. Effective state computed from `live_revision_id` + `project_flag` + `current_revision.status`.
- **Project flag** (tinyint): 0=Normal, 1=Terminally Rejected, 2=Delisted. Captures project-level concerns that don't belong on any revision.
- **Revision status** (tinyint): 0=Draft, 1=Pending Review, 2=Revision Required, 3=Live, 4=Superseded, 5=Rejected.

### State Machine & Revision Rules

- **Draft phase**: Repeated "save draft" updates the same revision in place (no new revision created)
- **First submission**: Same revision, status changes to 1 (Pending Review)
- **Require modification**: Same revision, status changes to 2. Founder edits and resubmits (status back to 1)
- **Post-live edit**: Creates a NEW revision (status=1). Old revision remains Live (status=3) until new one is approved
- **Approval**: New revision → status=3 (Live), old revision → status=4 (Superseded), `live_revision_id` updated, denormalized fields synced
- **Rejection**: Revision → status=5. If first submission (no `live_revision_id`), `project_flag` → 1 (terminal)
- **Delist**: `project_flag` → 2. Revision remains status=3 (Live) but project is hidden
- **Restore**: `project_flag` → 0. Project becomes visible again

### Denormalization Strategy

- **`live_categories`** (JSON array on Project): Synced from Live revision at approval time. Enables zero-JOIN category filtering on homepage.
- **`live_stage`** (tinyint on Project): Synced from Live revision at approval time. Enables zero-JOIN stage filtering.
- **Trade-off**: Duplicated data, but write cost is negligible (once per approval). Read performance is critical for homepage.

### Schema Design

- **`projects` table**: `id`, `user_id`, `current_revision_id`, `live_revision_id`, `project_flag` (tinyint), `live_categories` (JSON), `live_stage` (tinyint), `created_at`, `updated_at`
- **`project_revisions` table**: `id`, `project_id`, `status` (tinyint 0-5), `name`, `tagline`, `description`, `cover_url`, `demo_images` (JSON), `demo_video_url`, `demo_link`, `stage` (tinyint 0-1), `categories` (JSON), `target_users`, `user_problem`, `progress`, `next_steps`, `message_to_users`, `is_open_for_beta`, `beta_description`, `contact_name`, `contact_phone`, `contact_email`, `contact_wechat`, `team_name`, `created_at`, `updated_at`
- **`user_identities` table**: `id`, `user_id`, `role` (varchar), `created_at`. Unique constraint on `(user_id, role)`.
- **`comments` table**: `id`, `project_id`, `user_id`, `comment_type` (varchar), `content` (text), `can_contact` (boolean), `contact_info` (varchar, nullable), `is_flagged` (boolean), `created_at`
- **`audit_records` table**: `id`, `project_id`, `operator_id`, `action` (varchar: approve, require_revision, reject, delist, restore), `revision_id` (nullable, for revision-specific actions), `reason` (text, nullable), `created_at`

### API Contracts

- **Project submission**:
  - `POST /projects`: Create new project + revision (status=0), grant founder role
  - `PUT /projects/:id/draft`: Update current revision in place, validate minimum fields
  - `PUT /projects/:id/submit`: Validate all required fields, transition revision to status=1

- **Project detail**:
  - `GET /projects/:id`: Return live revision content (public). Non-live → 404 for regular users, full content for founder/operator.

- **Project list**:
  - `GET /projects`: Paginated list of live projects. Query params: `category`, `stage`, `q` (search), `sort`, `cursor`/`offset`, `limit`.

- **Founder backend**:
  - `GET /founder/projects`: List own projects with filters
  - `GET /founder/stats`: Aggregate counts
  - `GET /founder/projects/:id/audit-reason`: Latest audit reason

- **Operator backend**:
  - `GET /operator/projects`: List all projects with filters
  - `POST /operator/projects/:id/approve`: Approve project
  - `POST /operator/projects/:id/require-revision`: Require modifications (body: `{ reason }`)
  - `POST /operator/projects/:id/reject`: Reject project (body: `{ reason }`)
  - `POST /operator/projects/:id/delist`: Delist project (body: `{ reason }`)
  - `POST /operator/projects/:id/restore`: Restore project
  - `GET /operator/audit-records`: Query audit records
  - `GET /operator/stats`: Aggregate statistics

- **Comments**:
  - `POST /projects/:id/comments`: Submit comment (auth required, project must be live)
  - `GET /founder/projects/:id/comments`: Founder views comments on own project
  - `GET /operator/projects/:id/comments`: Operator views comments on any project

### Access Control

- **Public routes**: `GET /projects`, `GET /projects/:id` (with conditional visibility)
- **Auth required**: All POST/PUT routes, `GET /founder/*`, `GET /operator/*`
- **Founder role**: `GET /founder/*`, `POST /projects`, `PUT /projects/:id/*`
- **Operator role**: `GET /operator/*`, `POST /operator/*`

### Validation

- **Project submission**: All required fields validated on submit. Draft only requires `name`.
- **Comment submission**: `content` required (max 500 chars), `comment_type` must be valid enum, `contact_info` required when `can_contact=true`.
- **Operator actions**: `reason` required for require-revision, reject, delist.

### Error Handling

- **Invalid state transitions**: Return 400 with descriptive error
- **Validation errors**: Return 422 with field-level errors
- **Not found**: Return 404
- **Unauthorized**: Return 401 (missing/invalid JWT)
- **Forbidden**: Return 403 (insufficient role)

## Testing Decisions

### Testing Philosophy

- **Test external behavior, not implementation**: Tests should verify API responses and database state, not internal service methods
- **Use `.handle(Request)` for Elysia testing**: Direct request/response testing without spinning up a server
- **Mirror `src/` structure in `test/`**: `test/modules/project/project.test.ts` tests `src/modules/project/`

### Modules to Test

- **Project + ProjectRevision service**: State machine transitions, revision creation rules, denormalized field sync
- **Project submission API**: Create, save draft, submit, validation errors
- **Project detail API**: Public access, founder access, operator access, non-live visibility
- **Project list API**: Filtering, search, sorting, pagination, zero-JOIN performance
- **Operator backend**: All review actions, audit record creation, state transitions
- **Founder backend**: Project listing, stats, audit reason retrieval
- **Comment API**: Submission, validation, visibility rules, flagged content

### Test Scenarios

- **State machine**: Every valid transition succeeds, every invalid transition fails
- **Revision rules**: Draft updates in place, first submission same revision, require-modification same revision, post-live creates new revision
- **Access control**: Public routes work without auth, protected routes require auth, role-specific routes enforce roles
- **Denormalization**: Approval syncs `live_categories` and `live_stage` to Project
- **Filtering**: Category, stage, search, combined filters, empty results
- **Audit trail**: Every operator action creates an AuditRecord with correct fields

### Prior Art

- No existing tests (greenfield project). Establish patterns in first test file, then replicate.

## Out of Scope

The following features are explicitly excluded from v1.0:

- **Hackerathon/activity module**: No activity-specific pages, voting, or leaderboards
- **Likes, votes, follows, shares**: No social interaction features
- **Beta applications**: No beta signup or management
- **Purchase/support**: No e-commerce or payment integration
- **Public comment display**: Comments are submitted but only visible to Founders and Operators
- **Frontend**: This spec covers backend API only. No UI implementation.
- **Project statistics counters**: No view_count, like_count, vote_count, share_count fields (deferred to 2.0)
- **Project form field**: No "project form" (hardware/software/hybrid) field
- **Activity association**: No "belonging to activity" field on projects
- **User profile management**: Backend consumes external auth, doesn't manage user profiles
- **Notification system**: No email or in-app notifications for review results
- **File upload service**: Assumes external file storage (S3, etc.) with URLs stored in database

## Further Notes

### Why ProjectRevision?

The PRD requires that when a Founder edits a live project, the old version remains publicly visible until the new version is approved. This necessitates a two-table design: Project (identity/lifecycle) and ProjectRevision (content snapshot). See ADR-0001.

### Why No Project.status?

Project has no `status` column. Its effective state is derived from `live_revision_id`, `project_flag`, and `current_revision.status`. This avoids maintaining two status fields that would need to stay in sync. See ADR-0002.

### Why Denormalized Fields?

`live_categories` and `live_stage` are duplicated on Project to enable zero-JOIN filtering on the homepage. Write cost is negligible (once per approval), but read performance is critical for the homepage. See ADR-0003.

### Operator Seeding

The platform needs at least one operator from day one. This is handled via a seed migration or script that creates a UserIdentity record with `role=operator` for a known user_id. The actual User record is managed by the external auth system.

### Comment Moderation

Comments are submitted immediately and visible to Founders/Operators without an approval gate. Machine-based content review runs asynchronously and sets `is_flagged=true` on violations. This is a 1.0 simplification — public display (2.0+) will require more sophisticated moderation.

### Terminal Rejection

When a project's first submission is rejected, `project_flag` is set to 1 (Terminally Rejected). This is a terminal state — the Founder cannot resubmit and must create a new project. This prevents endless revision loops on fundamentally unsuitable projects.

### Delisting vs Rejection

Delisting (project_flag=2) is reversible — operators can restore delisted projects. Terminal rejection (project_flag=1) is not — the Founder must start over. This distinction is important for operator workflows.

### Future Considerations

- **2.0+ features**: Likes, votes, follows, shares, public comments, beta applications, purchase support, activity module
- **Performance**: If project count grows significantly, consider caching aggregate statistics instead of real-time COUNT
- **File uploads**: Current design stores URLs. May need to integrate with S3/OSS for file management
- **Notifications**: Email or in-app notifications when project status changes
- **Audit log expansion**: May need to track Founder actions (submit, save draft) in addition to operator actions
