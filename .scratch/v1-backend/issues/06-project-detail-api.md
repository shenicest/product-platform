# 06 — Project detail API (public read)

**What to build:** GET endpoint for a single project's detail. Returns the `projects` row content directly for publicly visible (`status=3` Live) projects. Non-Live projects return a "not available" response for regular users. Founders can view their own projects regardless of status (including draft, pending review, revision required, rejected, delisted). Operators can view any project. Founders/Operators can additionally list the project's proposal history via a separate endpoint.

**Blocked by:** 04 — Project + ProjectEditProposal schema + core service

**Status:** ready-for-agent

- [ ] GET /projects/:id returns the Project row content for `status=3` (Live) projects (no auth required).
- [ ] Non-Live project accessed by a regular user returns appropriate "not available" response (404).
- [ ] Founder accessing own non-Live project sees full content.
- [ ] Operator accessing any project sees full content.
- [ ] Non-existent project returns 404.
- [ ] Response includes: name, tagline, description, cover, demo assets, demo link, stage, categories, target users, progress, message to users, founder info — read directly from the `projects` row (no JOIN).
- [ ] GET /projects/:id/proposals: Founder (own project) or Operator sees the proposal history for the project. Public users cannot access this.
- [ ] Tests cover: public access to Live project, regular user blocked from non-Live, founder sees own project, operator sees any project, 404 for missing project, proposal history visibility.
