# 06 — Project detail API (public read)

**What to build:** GET endpoint for a single project's detail. Returns the `projects` row content directly for publicly visible (`status=3` Live) projects. Non-Live projects return a "not available" response for regular users. Founders can view their own projects regardless of status (including draft, pending review, revision required, rejected, delisted). Operators can view any project. Founders/Operators can additionally list the project's proposal history via a separate endpoint.

**Blocked by:** 04 — Project + ProjectEditProposal schema + core service

**Status:** done

- [x] GET /projects/:id returns the Project row content for `status=3` (Live) projects (no auth required).
- [x] Non-Live project accessed by a regular user returns appropriate "not available" response (404).
- [x] Founder accessing own non-Live project sees full content.
- [x] Operator accessing any project sees full content.
- [x] Non-existent project returns 404.
- [x] Response includes: name, tagline, description, cover, demo assets, demo link, stage, categories, target users, progress, message to users, founder info — read directly from the `projects` row (no JOIN).
- [x] GET /projects/:id/proposals: Founder (own project) or Operator sees the proposal history for the project. Public users cannot access this.
- [x] Tests cover: public access to Live project, regular user blocked from non-Live, founder sees own project, operator sees any project, 404 for missing project, proposal history visibility.

**Implementation notes:**

- Routes: `src/modules/project/index.ts` — `GET /projects/:id` (public, optional auth via inline JWT parsing) and `GET /projects/:id/proposals` (`auth: true`, owner or operator).
- `GET /projects/:id`: Live projects returned publicly. Non-Live returns 404 for unauthenticated/non-owner/non-operator users (hides existence). Owner and operator see full content regardless of status.
- `GET /projects/:id/proposals`: Returns `{ data, total }` (all proposals, newest first). 401 unauthenticated, 403 non-owner/non-operator, 404 missing project.
- Service: `ProjectService.listProposals(projectId)` added (ordered by `createdAt desc`).
- Model: `ProposalListResponse` schema added (`{ data: SelectProjectEditProposal[], total }`).
- Tests: 11 new HTTP-level tests in `test/modules/project/index.test.ts` covering all visibility rules. Full suite 141 pass.
