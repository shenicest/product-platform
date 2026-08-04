# 02 — Listing full experience: filter, search, sort, pagination

**What to build:** A visitor can narrow down the home listing — filter by category and stage, search by keyword, change sort order, and page through results. All state lives in the URL, so every filtered view is shareable and stays server-rendered (SEO-friendly). Empty result sets get a proper empty state instead of a blank grid.

**Blocked by:** 01 — Web foundation + listing tracer bullet

**Status:** done

- [x] Category filter over the fixed category set from `@shenicest/shared` (no hardcoded magic values)
- [x] Stage filter (MVP阶段 / 成长阶段, values from `@shenicest/shared`)
- [x] Keyword search box; search term carried in the URL
- [x] Sort control: latest / recently_updated (the two sorts the API implements)
- [x] All filter/search/sort/page state in URL searchParams; filters combine with AND; any view is shareable/bookmarkable
- [x] Numbered pagination (`?page=n`) mapped to the API's offset/limit; page size matches API default
- [x] Empty state when no projects match the current filters (user story 24)
- [x] Cards show full list info: cover, name, tagline, stage, categories
- [x] Interactive controls (search input, filter/sort widgets) are small client islands that navigate via URL; results remain server-rendered
- [x] `bun run build` (web) and lint pass

## Implementation Notes

- **Param parsing/validation**: `src/lib/project-filters.ts` centralizes `parseListParams` (validates category against `CATEGORIES`, stage against `ProjectStage`, sort against the allowed set, page ≥ 1) plus `PAGE_SIZE = 20`, `STAGE_LABELS`, and `hasActiveFilters`. Invalid/unknown values are dropped, so bad URLs degrade to a clean default view.
- **Data layer**: `getLiveProjects(query)` now forwards `{ category, stage, q, sort, offset, limit }` to `api.projects.get({ query })`; the query type is checked against the Eden-inferred API schema.
- **FilterBar** (`src/components/filter-bar.tsx`, client island): category + stage chips and a sort `<select>` toggle URL params via `router.replace` (page reset on every filter change); the search box is an uncontrolled input submitted as `q`. Results stay server-rendered — the island only rewrites the URL.
- **Pagination** (`src/components/pagination.tsx`, server component): numbered page `<Link>`s with a windowed range + ellipses, prev/next, `aria-current="page"`; each href preserves all active filter params and omits `page=1`.
- **Empty state** distinguishes "no projects at all" from "no matches for the current filters".
- **Seed**: now deterministic — it deletes the demo founder's projects and re-inserts 27 rows (25 Live / 1 Draft / 1 Pending), including 20 generated Live rows so pagination and filters are exercisable.
- **Verification**: API-level checks (category / stage / q / sort / offset+limit / combined) and server-rendered HTML checks (card counts per filter, page 2, empty state, pagination hrefs preserving filters) all pass. `next build` + `eslint` + `tsc --noEmit` clean; api suite 207/207.
- **Note**: `q` searches name/contactName/teamName (per spec user story 18), not description/tagline. Sort order looks identical in demo data because all rows seed within the same second — the param is wired correctly.

## Code Review Dispositions (Standards + Spec, two-axis)

Fixed after review:
- `stage` is now typed as `ProjectStage` (from `@shenicest/shared`) in `ProjectFilters`/`ProjectListQuery`, not `number` (documented enum rule).
- Search placeholder corrected to "搜索项目名称、团队或负责人" — the old copy claimed tagline was searched, which it is not (user story 18).
- `hasActiveFilters` no longer counts `sort` (sort only reorders; it never narrows results), so the empty-state message distinguishes correctly.
- De-duplicated: sort options now derive from `SORTS`/`SORT_LABELS`; the `SearchParams` type is exported once from `project-filters.ts`; `ProjectListQuery` extends a shared `ProjectFilters` shape.
Deferred (judgement calls): pagination's home-route coupling (only one route exists), seed/window magic numbers, and `STAGE_LABELS` living in a "filters" module. Known limitation noted: an out-of-range `?page=` renders the empty state rather than clamping (page bounds aren't known until after fetch).
