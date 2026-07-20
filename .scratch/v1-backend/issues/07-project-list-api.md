# 07 — Project list API (browse + filter + search)

**What to build:** GET endpoint for the project list (homepage). Returns only `status=3` (Live) projects with pagination. Supports filtering by category, stage, and keyword search (matching project name or founder name). Supports sorting by latest, most commented, recently updated, most liked. Reads the `projects` table directly — `categories` and `stage` are columns on `projects`, so filtering is zero-JOIN and needs no denormalized copy.

**Blocked by:** 04 — Project + ProjectEditProposal schema + core service

**Status:** done

- [x] GET /projects returns paginated list of `status=3` (Live) projects only.
- [x] Filter by category: `JSON_CONTAINS(categories, ?)` on the `projects` row (or generated-column / multi-valued index). Zero JOIN.
- [x] Filter by stage: `stage = ?` on the `projects` row. Zero JOIN.
- [x] Keyword search matches project name or founder name (founder name may require a join to the external User table or a denormalized founder_name field — confirm with the User table integration).
- [x] Multiple filters combine with AND logic.
- [x] Sorting: latest (`created_at` desc), recently updated (`updated_at` desc), most comments (subquery/aggregate), most likes (deferred to 2.0 — omit if no like table exists).
  - `latest` and `recently_updated` implemented. `most_comments` deferred — no comments table exists yet. `most_likes` deferred to 2.0.
- [x] Pagination: cursor or offset based, configurable page size.
- [x] Each item in list includes: cover, name, tagline, stage, categories, founder nickname.
- [x] Empty results return empty array (not error).
- [x] Tests cover: only Live projects returned, category filter, stage filter, keyword search, combined filters, sorting, pagination, empty results.

## Implementation Notes

- **Route**: `GET /projects` — public, no auth required. Added to `src/modules/project/index.ts`.
- **Service**: `ProjectService.listLiveProjects(query)` in `src/modules/project/service.ts`. Always filters `status=3`. Supports `category` (JSON_CONTAINS), `stage`, `q` (LIKE on name/contactName/teamName), `sort` (latest | recently_updated), `offset`, `limit` (default 20, max 100).
- **Model**: `ProjectListQuery` + `ProjectListResponse` in `src/modules/project/model.ts`.
- **Search**: Matches `name`, `contactName`, `teamName` via SQL LIKE. No external User table join needed — `contactName` serves as the founder nickname in 1.0.
- **Sorting**: `latest` (created_at DESC, default) and `recently_updated` (updated_at DESC). `most_comments` deferred — no comments table exists yet. `most_likes` deferred to 2.0.
- **Tests**: 13 new integration tests in `test/modules/project/index.test.ts` covering all acceptance criteria.
