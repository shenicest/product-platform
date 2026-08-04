# 02 — Listing full experience: filter, search, sort, pagination

**What to build:** A visitor can narrow down the home listing — filter by category and stage, search by keyword, change sort order, and page through results. All state lives in the URL, so every filtered view is shareable and stays server-rendered (SEO-friendly). Empty result sets get a proper empty state instead of a blank grid.

**Blocked by:** 01 — Web foundation + listing tracer bullet

**Status:** ready-for-agent

- [ ] Category filter over the fixed category set from `@shenicest/shared` (no hardcoded magic values)
- [ ] Stage filter (MVP阶段 / 成长阶段, values from `@shenicest/shared`)
- [ ] Keyword search box; search term carried in the URL
- [ ] Sort control: latest / recently_updated (the two sorts the API implements)
- [ ] All filter/search/sort/page state in URL searchParams; filters combine with AND; any view is shareable/bookmarkable
- [ ] Numbered pagination (`?page=n`) mapped to the API's offset/limit; page size matches API default
- [ ] Empty state when no projects match the current filters (user story 24)
- [ ] Cards show full list info: cover, name, tagline, stage, categories
- [ ] Interactive controls (search input, filter/sort widgets) are small client islands that navigate via URL; results remain server-rendered
- [ ] `bun run build` (web) and lint pass
