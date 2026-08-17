# Product Showcase Platform

A platform for discovering, submitting, and managing early-stage products. Founders submit projects, operators review them, users browse and interact.

## Language

**User**:
A person authenticated via the external auth system. Identified by `user_id` from JWT. Profile data lives in the existing shared User table.
_Avoid_: Account, member

**Shared User table**:
The external auth system's `users` table (default `event_management.users`, overridable via `SHARED_USERS_TABLE`). Keyed by integer `id`; this platform carries the same id as a string. **Read-only for runtime code** — never created, migrated, or written to by this service (only the dev seed and tests insert fixture rows there). Provides the **public founder profile** (`nickname`, `avatar_url`), surfaced as `founder` on the project detail response. A missing row, a non-integer user id, or an unreachable table all degrade to `founder: null` — the public page simply omits the founder block.
_Avoid_: profile table, member table

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
A product submitted by a Founder for review and public display. The Project holds BOTH the lifecycle state AND the source-of-truth content directly — `id`, `user_id`, `status` (tinyint 0-5), all displayable content fields (name, tagline, description, cover, demo assets, stage, categories, contact info, etc.), and timestamps. No separate content table. Draft and revision-required edits modify the Project row directly. A Pending Review Project is read-only until the Operator acts. Post-live edits go through a ProjectEditProposal. Only `status=3` (Live) projects appear in public listings.
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
- Pre-live Project (status 0/2): no proposals. Founder edits the Project row directly. Submit transitions status to `1` (Pending Review). A Project already in status 1 is read-only.
- Post-live edit (status=3): Founder creates a proposal (status=0) with a `changes` diff. Project row is untouched.
- Approve proposal: apply the diff to the Project row (partial PATCH of changed fields); proposal status → `1` (Approved). Project stays `status=3` (Live).
- Reject proposal: proposal status → `2` (Rejected). Project row unchanged.
- Require revision on proposal: proposal status → `3` (Revision Required). Founder edits the proposal's `changes` diff and resubmits (status back to `0`). No new proposal is created.
- Constraint: at most one proposal in status `0` or `3` per Project at any time.
- In 1.0, post-live proposals may change only `description`, `demoLink`, and `betaDescription`.

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

**Like**:
A User's endorsement of a specific Project. Targets Projects only (never Founders). A user may hold at most one Like per Project — uniquely keyed on `(user_id, project_id)`. POST/DELETE endpoints are idempotent (repeated calls return 200). Likes may only be **created** on Live (`status=3`) projects; if a Project is later delisted, existing Like records are **preserved** (kept for analytics and potential restoration), but no new likes may be added while the project is not Live. The `like_count` denormalized column on `projects` is incremented/decremented on real state changes (insert / delete), driven by DB `affectedRows` so idempotent no-ops don't double-count.
_Avoid_: Vote, Star, Heart, Favorite, Reaction

**Follow**:
A directional relationship from a follower User to a followee User with the Founder role. The Follow is anchored on the **User** (not on any single Project), so if the same User later gains additional roles or publishes more projects, one Follow covers all their work. Targets must currently hold `role=founder` in UserIdentity — following a non-Founder returns 400 `NotAFounder`. Self-follow is disallowed (400 `CannotFollowSelf`). Uniquely keyed on `(follower_user_id, followee_user_id)`. POST/DELETE endpoints are idempotent. **No denormalized `follower_count` column** — follower counts are computed on demand via COUNT (see ADR-0008). If the target User's `founder` role were ever revoked, existing Follow rows are retained (analog to Like retention on delisted projects); new follows would be blocked by the role check.
_Avoid_: Subscribe, Watch, Friend, Connection

**TalentProfile**:
A User's structured public profile in Talent Plaza. A User has at most one TalentProfile. It is independent of Founder identity: creating one does not grant the Founder role. `Published` profiles are discoverable; `Paused` profiles are hidden from discovery but the User may still initiate connections and process Pending requests received while Published; `Suspended` profiles are removed by an Operator and cannot participate in connection operations. A TalentProfile state describes the profile, not a general ban on the User. P0 does not provide self-service deletion; a User pauses the profile to stop public discovery.
_Avoid_: Resume, CV, MemberProfile

**ConnectionRequest**:
A User's cooperation request to another User who has a Published TalentProfile. The sender must be authenticated but does not need a TalentProfile; if the sender has one, it must not be Suspended. The request may optionally reference a Live Project owned by the sender. The receiver's Published status is required when the request is created. A request carries the sender's locked, per-request contact authorization and, after acceptance, the receiver's locked contact authorization.
_Avoid_: Connection, Invitation, Follow

ConnectionRequest does not require a TalentProfile from the sender. A referenced Project is valid only when it is Live and owned by the sender at request creation time; TalentProfile and Project ownership remain separate concerns.

ConnectionRequest reads the current public TalentProfile and shared User identity when displaying participants; it does not snapshot TalentProfile fields. A missing sender TalentProfile is displayed explicitly rather than represented by fabricated profile fields. Referenced Project information is also read from the current Project state; a delisted Project is shown as unavailable without cancelling the request.

Each side authorizes at least one contact method per request; each side may provide at most one WeChat ID and one email address. The sender authorizes when creating the request, and the receiver authorizes when accepting it. These per-request authorizations are locked after the relevant operation and cannot be edited or withdrawn in P0.

Once either direction between two Users is `Accepted`, the pair is considered connected and neither direction may create another ConnectionRequest. The request itself remains directional, while the established connection is mutual.

An `Ignored` request may be followed by a new request immediately; P0 has no ignore cooldown. At most one Pending request may exist for a User pair at a time, and an Accepted request in either direction blocks future requests.

**Talent matching**:
P0 matching is a detail-page aid, not a list-ranking mechanism. A match score and readable reasons are shown only when both the viewer and candidate have Published TalentProfiles. They are hidden for visitors, users without a TalentProfile, and either profile in another state. A score of zero is shown as “暂无明显匹配” rather than as a numeric score.

**Skill catalog**:
P0 uses a fixed standard skill list. Talent Plaza does not provide Operator skill enable/disable/add management or user-created skills in P0.

P0 TalentProfile creation has no server-side Draft state. Before first publication, edits are temporary browser-local data only. The first successful publish creates the TalentProfile; subsequent edits update the existing profile directly.

`Suspended` is terminal in P0. There is no Operator restore or appeal workflow in Talent Plaza; the profile owner is directed to contact operations.

P0 Operator capabilities for Talent Plaza are limited to searching/viewing TalentProfiles, suspending a profile with a reason, and viewing the suspension audit record. P0 has no skill-catalog management, User-level connection ban, in-product report inbox, contact-method access, or profile restoration.
