# Platform-Project connections live in their own table

> **Status: Accepted**

## Context

Users can already contact hackathon project teams (external event DB) and talent profiles. The product now wants the same "联系项目方" flow on platform `Project` detail pages (`/projects/[id]`). [ADR-0010](./0010-hackathon-connection-separate-table.md) explicitly deferred this third surface and asked for a shared `ConnectionTarget` abstraction when it arrived.

The platform-Project case is structurally different from both existing tables:

- The target is a local `projects` row, and the receiver is that row's `user_id` (project ownership never transfers).
- No receiver-configuration table is needed: ownership is the authorization basis, unlike `hackathon_project_contacts`.
- Requests are only creatable while the project is Live; delisting must end Pending requests (same visibility gate as hackathon hiding).
- The contact-intent vocabulary matches hackathon ("试用产品", "合作交流", …), not Talent's cooperation vocabulary.

## Decision

Add `project_connection_requests` and a `project-connection` module, keeping the three request tables separate. Reuse the shared primitives: `ConnectionRequestStatus`, AES-GCM contact encryption (WeChat / phone / email, at least one), the `pair_key` pending-unique pattern, the `connection_daily_limits` table with a new `project_connection` scope, and the unified `/connections` DTO.

The receiver is snapshotted as `receiver_user_id = projects.user_id` at creation. The create transaction locks the project row, checks `status = Live`, blocks self-connection, enforces one Pending request per `(sender, project)`, a 7-day ignore cooldown, and the 3/day quota. Accept/ignore/contacts/status mirror hackathon semantics; a no-longer-Live project cancels its Pending requests.

Notification deliveries reuse the generic delivery table and worker. New types `project_connection_created` / `project_connection_accepted` let the worker dispatch to a project-specific content resolver while the hackathon resolver stays unchanged.

## Considered Options

- **Extend `connection_requests` with a target-project column** — Rejected. Its `project_id` already means "a Live project owned by the sender", the receiver currently requires a Published `TalentProfile`, and its pair uniqueness is user-to-user. Reusing it would flip field semantics and change Talent behavior.
- **Reuse `hackathon_connection_requests` with nullable event/project discriminators** — Rejected. Hackathon projects live in an external DB and need `hackathon_project_contacts`; platform projects already have an owner. A polymorphic receiver would complicate every query.
- **Extract a generic `ConnectionTarget` service first** — Deferred. Three surfaces now share mechanics, but their receiver resolution, lifecycle hooks, and target DTOs still differ. The duplicated service logic is acceptable for P0; a shared abstraction can be extracted with all three concrete consumers in hand.

## Consequences

- **Third table, same primitives** — new surfaces add a scope constant and a thin module, not a new counter table.
- **Unified connections list gains `source: 'project'`** — the aggregate composes Talent, hackathon, and platform-project services read-only.
- **Email copy is shared with a label** — the created template accepts an optional `projectLabel` ("项目" vs "黑客松项目"); the accepted template is already surface-neutral.
- **Delist hook** — the Operator delist path now calls `projectConnectionService.cancelPendingByProject` after a successful transition; Accepted connections are preserved.
