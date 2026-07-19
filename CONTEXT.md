# Product Showcase Platform

A platform for discovering, submitting, and managing early-stage products. Founders submit projects, operators review them, users browse and interact.

## Language

**User**:
A person authenticated via the external auth system. Identified by `user_id` from JWT. Profile data lives in the existing shared User table.
_Avoid_: Account, member

**UserIdentity**:
A platform-specific role record linking a User to a role. Stored as `varchar`, not database enum. A User can hold multiple roles simultaneously (e.g. both `founder` and `operator`). Granted explicitly — a User becomes a Founder when their first Project is created; an Operator is seeded or assigned out-of-band.
_Avoid_: Role, permission, profile

**Operator**:
A User with `role=operator` in UserIdentity. Authenticates through the same external auth system as all other Users. Has access to the operator backend for project review and management. Referenced by `user_id` in AuditRecord.
_Avoid_: Admin, Manager, Moderator

**Founder**:
A User who has submitted at least one Project. Identity is explicitly granted (not derived by query). A Project has exactly one Founder.
_Avoid_: Creator, author, submitter, owner

**Project**:
A product submitted by a Founder for review and public display. Identity/lifecycle container — holds `id`, `user_id`, `current_revision_id` (the revision being worked on or in review), `live_revision_id` (the currently displayed revision, nullable), `project_flag` (tinyint), and timestamps. Also holds denormalized fields synced from the Live revision at approval time for zero-JOIN filtering: `live_categories` (JSON array) and `live_stage` (tinyint). Does NOT hold the source-of-truth content. All content changes go through revision + review.
_Avoid_: Submission, entry, listing

**Project Flag** (tinyint values on Project):
- `0` Normal — no special project-level flag
- `1` Terminally Rejected — first submission rejected; terminal state, cannot be resubmitted
- `2` Delisted — was Live, removed by operator; can be restored

**Derived Project State** (computed, not stored):
- Has `live_revision_id` and `project_flag != 2` → **Live**
- Has `live_revision_id` and `project_flag == 2` → **Delisted**
- No `live_revision_id` and `project_flag == 1` → **Rejected** (terminal)
- No `live_revision_id` and `project_flag == 0` → see `current_revision.status` (Draft / Pending Review / Revision Required)

Only Live projects appear in public listings. Rejected is a terminal state — Founder must create a new project to try again.
_Avoid_: Status, State, phase

**ProjectRevision**:
A snapshot of a Project's content fields at a point in time. Holds ALL displayable content (name, description, cover, demo, stage, categories, contact info, etc.). Has its own status (tinyint):
- `0` Draft — initial, not yet submitted
- `1` Pending Review — awaiting operator approval
- `2` Revision Required — operator requested changes; Founder must resubmit
- `3` Live — currently displayed version
- `4` Superseded — was Live, replaced by a newer approved revision
- `5` Rejected — edit rejected by operator; old revision remains displayed

**Revision creation rules**:
- Draft phase: repeated "save draft" updates the same revision in place.
- First submission: same revision, status changes to 1.
- "Require modification" from operator: same revision, status changes to 2. Founder edits and resubmits (status back to 1).
- Post-live edit: a NEW revision is created (status=1); the old revision remains Live until the new one is approved.

A Project tracks its working revision via `current_revision_id` and its displayed revision via `live_revision_id`.
_Avoid_: Version, Draft, Snapshot

**Comment**:
A user's feedback on a Project. In 1.0, comments are NOT publicly displayed — only visible to the Founder and operators in their respective dashboards. No approval gate — submitted comments are immediately visible to Founder/operators. Machine-based content review runs asynchronously and sets `is_flagged` on violations. A user can submit multiple comments on the same project.
_Avoid_: Feedback, Review, Reaction

**Project Stage** (tinyint values):
- `0` MVP阶段 — early validation
- `1` 成长阶段 — has test version, test slots, etc.
_Avoid_: Phase, Level

**Category**:
A label for classifying projects. Stored as a JSON array on ProjectRevision (source of truth) and denormalized to Project.live_categories at approval time for zero-JOIN filtering. A Revision can have multiple categories (multi-select). Categories are a fixed set: 女性健康, 效率工具, 教育学习, 开发者工具, 生活方式, 其他.
_Avoid_: Tag, Label, Topic, ProjectCategory

**AuditRecord**:
A record of an operator's action on a Project. Only created when an operator performs an action (approve, reject, require revision, delist, restore). Founder's own actions (submit, save draft) are NOT recorded. Captures before/after status, reason, and the operator's user_id.
_Avoid_: AuditLog, ReviewLog, HistoryEntry
