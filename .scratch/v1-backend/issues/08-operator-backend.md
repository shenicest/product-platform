# 08 — Operator backend (review + management + audit records + statistics)

**What to build:** Complete operator backend API covering four areas: (1) Review actions — approve, require modification, reject, delist, restore; each creates an AuditRecord and updates revision status + denormalized fields + project_flag. (2) Project management — list all projects with filters (stage, status, category), search (project name, founder name), sorting (by various metrics), expandable card view. (3) Audit records — queryable list of all operator actions. (4) Statistics — aggregated project data.

**Blocked by:** 03 — UserIdentity module, 04 — Project + ProjectRevision schema + core service

**Status:** ready-for-agent

- [ ] All endpoints require `operator` role (403 for non-operators)
- [ ] POST approve: revision status → 3 (Live), project `live_revision_id` updated, denormalized fields synced, AuditRecord created
- [ ] POST require modification: revision status → 2, AuditRecord created with reason
- [ ] POST reject: revision status → 5, project_flag → 1 (if first submission), AuditRecord created with reason
- [ ] POST delist: project_flag → 2, AuditRecord created with reason
- [ ] POST restore: project_flag → 0, AuditRecord created
- [ ] Invalid state transitions return error (e.g. approving a draft)
- [ ] GET project management list: filter by stage/status/category, search by name/founder, sort by metrics
- [ ] GET audit records: filter by project, time range; list fields per PRD
- [ ] GET statistics: aggregated counts (total projects, by status, by stage, by category)
- [ ] Tests cover: each review action with valid/invalid transitions, AuditRecord creation, operator-only access, management list filters, audit record queries
