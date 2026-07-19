# 07 — Project list API (browse + filter + search)

**What to build:** GET endpoint for the project list (homepage). Returns only Live projects with pagination. Supports filtering by category, stage, and keyword search (matching project name or founder name). Supports sorting by latest, most commented, recently updated, most liked. Uses denormalized fields on Project for zero-JOIN filtering.

**Blocked by:** 04 — Project + ProjectRevision schema + core service

**Status:** ready-for-agent

- [ ] GET /projects returns paginated list of Live projects only
- [ ] Filter by category (from `live_categories` JSON, zero JOIN)
- [ ] Filter by stage (from `live_stage`, zero JOIN)
- [ ] Keyword search matches project name or founder name
- [ ] Multiple filters combine with AND logic
- [ ] Sorting: latest (created_at desc), recently updated, most comments, most likes
- [ ] Pagination: cursor or offset based, configurable page size
- [ ] Each item in list includes: cover, name, tagline, stage, categories, founder nickname
- [ ] Empty results return empty array (not error)
- [ ] Tests cover: only Live projects returned, category filter, stage filter, keyword search, combined filters, sorting, pagination, empty results
