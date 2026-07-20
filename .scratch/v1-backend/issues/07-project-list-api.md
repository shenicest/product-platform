# 07 — Project list API (browse + filter + search)

**What to build:** GET endpoint for the project list (homepage). Returns only `status=3` (Live) projects with pagination. Supports filtering by category, stage, and keyword search (matching project name or founder name). Supports sorting by latest, most commented, recently updated, most liked. Reads the `projects` table directly — `categories` and `stage` are columns on `projects`, so filtering is zero-JOIN and needs no denormalized copy.

**Blocked by:** 04 — Project + ProjectEditProposal schema + core service

**Status:** ready-for-agent

- [ ] GET /projects returns paginated list of `status=3` (Live) projects only.
- [ ] Filter by category: `JSON_CONTAINS(categories, ?)` on the `projects` row (or generated-column / multi-valued index). Zero JOIN.
- [ ] Filter by stage: `stage = ?` on the `projects` row. Zero JOIN.
- [ ] Keyword search matches project name or founder name (founder name may require a join to the external User table or a denormalized founder_name field — confirm with the User table integration).
- [ ] Multiple filters combine with AND logic.
- [ ] Sorting: latest (`created_at` desc), recently updated (`updated_at` desc), most comments (subquery/aggregate), most likes (deferred to 2.0 — omit if no like table exists).
- [ ] Pagination: cursor or offset based, configurable page size.
- [ ] Each item in list includes: cover, name, tagline, stage, categories, founder nickname.
- [ ] Empty results return empty array (not error).
- [ ] Tests cover: only Live projects returned, category filter, stage filter, keyword search, combined filters, sorting, pagination, empty results.
