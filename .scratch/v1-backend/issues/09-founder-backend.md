# 09 — Founder backend — my projects API

**What to build:** APIs for the Founder dashboard. Founders can view all their own projects with filtering and search. Project overview statistics (total count, live count, pending review count) computed via real-time COUNT queries. Founders can view the reason for revision required, rejection, or delisting (from the latest AuditRecord).

**Blocked by:** 05 — Project submission (save draft + submit for review)

**Status:** ready-for-agent

- [ ] GET /founder/projects: list all projects owned by the authenticated user
- [ ] Filter by derived project state (draft, pending review, revision required, live, rejected, delisted)
- [ ] Filter by stage
- [ ] Keyword search on project name / tagline
- [ ] GET /founder/stats: real-time counts (total projects, live projects, pending review projects)
- [ ] GET /founder/projects/:id/audit-reason: return the reason text from the latest relevant AuditRecord (revision required / rejection / delisting)
- [ ] Auth required: all endpoints require authenticated user with `founder` role
- [ ] Non-founder (no projects) returns empty list or appropriate response
- [ ] Tests cover: list own projects, filter by state, search, stats accuracy, reason retrieval, non-founder access
