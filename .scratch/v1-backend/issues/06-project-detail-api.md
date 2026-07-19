# 06 — Project detail API (public read)

**What to build:** GET endpoint for a single project's detail. Returns the live revision's content for publicly visible projects. Non-Live projects return a "not available" response for regular users. Founders can view their own projects regardless of status (including draft, pending review, revision required, rejected, delisted). Operators can view any project.

**Blocked by:** 04 — Project + ProjectRevision schema + core service

**Status:** ready-for-agent

- [ ] GET /projects/:id returns live revision content for Live projects (no auth required)
- [ ] Non-Live project accessed by regular user returns appropriate "not available" response
- [ ] Founder accessing own non-Live project sees full content + current revision
- [ ] Operator accessing any project sees full content + all revisions
- [ ] Non-existent project returns 404
- [ ] Response includes: name, tagline, description, cover, demo assets, demo link, stage, categories, target users, progress, message to users, founder info
- [ ] Tests cover: public access to Live project, regular user blocked from non-Live, founder sees own project, operator sees any project, 404 for missing project
