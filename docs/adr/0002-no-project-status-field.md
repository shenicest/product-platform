# No `status` field on Project — derive from Revision + project_flag

Project has no `status` column. Its effective state is derived from `live_revision_id`, `project_flag`, and `current_revision.status`. This avoids maintaining two status fields that would need to stay in sync.

## Considered Options

- **Dual status fields** (Project.status + ProjectRevision.status): Clearer queries but requires careful synchronization, especially during the pre-live phase where they would be nearly identical.
- **Single source of truth** (Revision.status + project_flag): Project-level concerns (terminal rejection, delisting) that don't belong on any Revision are captured via `project_flag` (tinyint: 0=Normal, 1=Terminally Rejected, 2=Delisted).

## Consequences

- "Is this project Live?" requires checking `live_revision_id IS NOT NULL AND project_flag != 2`.
- Terminal rejection (first submission rejected, no resubmission allowed) is a Project-level concept that no Revision status can express — hence `project_flag = 1`.
- Delisting affects the Project, not the Revision — the Revision remains status=3 (Live) but the project is hidden.
