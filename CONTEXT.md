# Product Showcase Platform

A platform for discovering, submitting, and managing early-stage products. Founders submit projects, operators review them, users browse and interact.

## Language

**User**:
A person authenticated via the external auth system. Identified by `user_id` from JWT. Profile data lives in the existing shared User table.
_Avoid_: Account, member

**UserIdentity**:
A platform-specific role record linking a User to a role. Stored as `tinyint`, not database enum. A User can hold multiple roles simultaneously (e.g. both `founder` and `operator`). Granted explicitly — a User becomes a Founder when their first Project is created; an Operator is seeded or assigned out-of-band.
_Avoid_: Role, permission, profile

**Operator**:
A User with `role=operator` in UserIdentity. Authenticates through the same external auth system as all other Users. Has access to the operator backend for project review and management. Referenced by `user_id` in AuditRecord.
_Avoid_: Admin, Manager, Moderator

**Founder**:
A User who has submitted at least one Project. Identity is explicitly granted (not derived by query). A Project has exactly one Founder.
_Avoid_: Creator, author, submitter, owner

**Project**:
A product submitted by a Founder for review and public display. The Project holds BOTH the lifecycle state AND the source-of-truth content directly — `id`, `user_id`, `status` (tinyint 0-5), all displayable content fields (name, tagline, description, cover, demo assets, stage, categories, contact info, etc.), and timestamps. No separate content table. Pre-live edits (draft, first submission, revision-required rework) modify the Project row directly. Post-live edits go through a ProjectEditProposal. Only `status=3` (Live) projects appear in public listings.
_Avoid_: Submission, entry, listing, Version, Snapshot, Revision

**Project Status** (tinyint, single stored field on Project):
- `0` Draft — initial, not yet submitted
- `1` Pending Review — first submission awaiting operator approval
- `2` Revision Required — operator requested changes; Founder edits the Project row and resubmits
- `3` Live — currently displayed publicly
- `4` Delisted — was Live, removed by operator; can be restored
- `5` Rejected — first submission rejected; terminal, cannot be resubmitted (Founder must create a new Project)

Only `status=3` (Live) projects appear in public listings. `status=5` is terminal — the Founder must create a new Project to try again. A Live project stays Live through post-live edits — those edits are tracked by ProjectEditProposals, not by changing Project status. Delisting (`status=4`) is reversible; Rejected (`status=5`) is not.
_Avoid_: State, phase, flag

**ProjectEditProposal**:
A record of a Founder's proposed changes to an already-Live Project. Stores a `changes` JSON diff — only the fields the Founder wants to modify and their new values (NOT a full content snapshot). Has its own status (tinyint):
- `0` Pending Review — awaiting operator approval
- `1` Approved — diff applied to the Project row; new version is live
- `2` Rejected — operator rejected; Project row unchanged, old version stays live
- `3` Revision Required — operator requested changes to the proposal; Founder edits the proposal's `changes` diff and resubmits (status back to 0)

Only one Pending/Revision-Required proposal may exist per Project at a time. Creating a proposal does NOT modify the Project row — the Project keeps showing the current Live content until the proposal is Approved. The old Live version therefore remains publicly visible while a proposal is under review.
_Avoid_: Revision, Version, Snapshot, Edit, ChangeRequest, PullRequest

**Proposal creation rules**:
- Pre-live Project (status 0/1/2): no proposals. Founder edits the Project row directly. Submit transitions status to `1` (Pending Review).
- Post-live edit (status=3): Founder creates a proposal (status=0) with a `changes` diff. Project row is untouched.
- Approve proposal: apply the diff to the Project row (partial PATCH of changed fields); proposal status → `1` (Approved). Project stays `status=3` (Live).
- Reject proposal: proposal status → `2` (Rejected). Project row unchanged.
- Require revision on proposal: proposal status → `3` (Revision Required). Founder edits the proposal's `changes` diff and resubmits (status back to `0`). No new proposal is created.
- Constraint: at most one proposal in status `0` or `3` per Project at any time.

**Comment**:
A user's feedback on a Project. In 1.0, comments are NOT publicly displayed — only visible to the Founder and operators in their respective dashboards. No approval gate — submitted comments are immediately visible to Founder/operators. Machine-based content review runs asynchronously and sets `is_flagged` on violations. A user can submit multiple comments on the same project. Comments can only be submitted on Live (`status=3`) projects.
_Avoid_: Feedback, Review, Reaction

**Project Stage** (tinyint on Project):
- `0` MVP阶段 — early validation
- `1` 成长阶段 — has test version, test slots, etc.
_Avoid_: Phase, Level

**Category**:
A label for classifying projects. Stored as a JSON array directly on Project — the source of truth is the Project row itself, so no denormalized copy is needed. Homepage filtering reads the Project table directly (zero JOIN). A Project can have multiple categories (multi-select). Categories are a fixed set: 女性健康, 效率工具, 教育学习, 开发者工具, 生活方式, 其他.
_Avoid_: Tag, Label, Topic, ProjectCategory

**AuditRecord**:
A record of an operator's action on a Project. Only created when an operator performs an action (approve, reject, require_revision, delist, restore). Founder's own actions (submit, save draft, create/edit proposal) are NOT recorded. Captures `action`, `reason`, `operator_id`, and `proposal_id` (nullable — set only when the action targets a post-live edit proposal). No `revision_id` — revisions no longer exist.
_Avoid_: AuditLog, ReviewLog, HistoryEntry
