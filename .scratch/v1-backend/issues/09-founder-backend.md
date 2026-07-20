# 09 — Founder backend — my projects & proposals API

**What to build:** APIs for the Founder dashboard. Founders can view all their own projects with filtering and search. Project overview statistics (total count, live count, pending review count) computed via real-time COUNT queries. Founders can view the reason for revision required, rejection, or delisting (from the latest AuditRecord). Founders can also view their own projects' proposal history and the status/reason of each post-live edit proposal.

**Blocked by:** 05 — Project submission (save draft + submit for review)

**Status:** done

- [x] GET /founder/projects: list all projects owned by the authenticated user.
- [x] Filter by `status` (draft, pending review, revision required, live, rejected, delisted).
- [x] Filter by stage.
- [x] Keyword search on project name / tagline.
- [x] GET /founder/stats: real-time counts (total projects, live projects, pending review projects).
- [x] GET /founder/projects/:id/audit-reason: return the reason text from the latest relevant AuditRecord (revision required / rejection / delisting).
- [x] GET /founder/projects/:id/proposals: list own proposals for the project (status, changes diff, reason, reviewed_at).
- [x] Auth required: all endpoints require authenticated user with `founder` role; only own projects/proposals are accessible (403/404 for others').
- [x] Non-founder (no projects) returns empty list or appropriate response.
- [x] Tests cover: list own projects, filter by status, search, stats accuracy, reason retrieval, own proposal listing, cannot access another founder's project/proposals, non-founder access.

**Implementation notes:**

- Routes: `src/modules/founder/index.ts` (`founderModule`, prefix `/founder`, wired in `src/index.ts` with a `Founder` openapi tag) — 4 endpoints, all `founderOnly: true`. Error mapping: 404 project/audit-reason not found, 403 non-owner or non-founder, 401 unauth.
- Access control: added a `founderOnly` macro to `src/plugins/role-guard.ts` (mirrors `operatorOnly`) that 403s users without the founder role. **Decision:** the issue ("non-founder returns empty list") and the spec doc ("Founder role: GET /founder/*") conflict; the user chose the strict founder-role guard, so a non-founder gets **403** on every `/founder/*` endpoint (the "appropriate response"). Ownership is still enforced on top: a founder accessing another founder's project gets 403 (`getOwnedProject`), a missing project gets 404.
- Service: `FounderService` (`src/modules/founder/service.ts`) — `listProjects` (scoped to `userId`, filter by status/stage, search by name/tagline via `LIKE`, ordered by `updated_at` desc, offset/limit pagination), `getStats` (single `GROUP BY status` scoped to `userId`, derives totalProjects/liveProjects/pendingReviewProjects), `getOwnedProject` (404 not found / 403 not owner), `getAuditReason` (latest **project-level** record — `proposalId IS NULL` — with action in require_revision/reject/delist, ordered by `createdAt desc, id desc` to break same-second timestamp ties; 404 `AUDIT_REASON_NOT_FOUND` when none), `listProposals` (full history for the owned project).
- Model: `FounderProjectQuery` (status/stage/q/offset/limit), `ProjectListResponse`/`ProposalListResponse` (`{ data, total }`), `StatsResponse` (totalProjects/liveProjects/pendingReviewProjects), `AuditReasonResponse` (= `t.Pick(SelectAuditRecord, ['action','reason','createdAt'])`), `AuditReasonNotFoundError`.
- "Latest relevant audit record" returns the newest project-level require_revision/reject/delist reason regardless of current status (matches the issue wording); `restore` carries no founder-facing reason and is excluded. A delisted-then-restored (Live) project still surfaces the stale delist reason — acceptable per the literal spec; the frontend only calls this when a project is in a reason-bearing state.
- Tests: `test/modules/founder/index.test.ts` — 28 cases covering access control (401 unauth, 403 non-founder on all four endpoints), own-project listing + ownership scoping, status/stage filters, name+tagline search, pagination, empty result for a founder with no matches, stats accuracy (delta) + per-caller scoping, audit-reason retrieval for revision-required/rejected/delisted + latest-of-multiple + 404 (no record / draft / missing) + 403 (another founder's project), and proposal listing (fields + 403/404). `FOUNDER`/`OTHER_FOUNDER` are granted the founder role in setup so cross-founder tests exercise ownership rather than the role guard. Full suite 182 pass.
