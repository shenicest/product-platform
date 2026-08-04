# 03 — Project detail page

**What to build:** A visitor opens a project and sees its full story: what it is, who it's for, how far it's come, how to try it, and whether the team is recruiting beta users. Non-Live or unknown projects show a graceful "not available" page rather than a raw error. Contact fields are never rendered — the public page is display-only this round.

**Blocked by:** 01 — Web foundation + listing tracer bullet

**Status:** ready-for-agent

- [ ] `/projects/[id]` renders the full public content from the detail API: name, tagline, description, cover, demo images, demo video, demo link, stage, categories, team name
- [ ] Long-form sections rendered: target users, user problem, progress, next steps, message to users
- [ ] Beta recruitment block shown when `isOpenForBeta` is true (with `betaDescription`)
- [ ] Contact fields (`contactName`, `contactPhone`, `contactEmail`, `contactWechat`) are NEVER rendered anywhere on the public page
- [ ] Non-Live or nonexistent project → friendly "not available" page (user story 23), correct 404 semantics
- [ ] Demo assets section handles missing fields gracefully (no empty frames/broken media)
- [ ] Page metadata (title/description/OG) generated from project content for SEO
- [ ] `bun run build` (web) and lint pass
