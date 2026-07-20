# 05 — Project submission (save draft + submit for review)

**What to build:** APIs for Founders to create projects, save drafts, and submit for review. Creating a project inserts a `projects` row with `status=0` (Draft). Saving a draft updates the same `projects` row in place (only allowed while status is 0 Draft or 2 Revision Required). Submitting for review validates all required fields and transitions `status` to `1` (Pending Review). First project creation automatically grants the `founder` role via UserIdentity. No proposal is involved at this stage — proposals are only for post-live edits (see ticket 04 / 08).

**Blocked by:** 04 — Project + ProjectEditProposal schema + core service

**Status:** done

- [x] POST create project: inserts `projects` row (`status=0`), grants `founder` role. Body: initial draft fields (minimum `name`).
- [x] PUT save draft: updates the `projects` row in place. Allowed only when `status` is `0` (Draft) or `2` (Revision Required). Validates minimum field (`name`).
- [x] PUT submit for review: validates all required fields, transitions `status 0|2 → 1` (Pending Review).
- [x] Submit with missing required fields returns validation error pointing to first missing field.
- [x] Auth required: all endpoints require authenticated user; the project must belong to the authenticated user.
- [x] Tests cover: create project, save draft multiple times (same row, no new records), submit for review, submit with missing fields, auto-grant founder role, cannot edit another founder's project, draft edit rejected after status leaves 0/2.

**Implementation notes:**
- Routes: `src/modules/project/index.ts` (`projectModule`, wired in `src/index.ts`) — `POST /projects`, `PUT /projects/:id/draft`, `PUT /projects/:id/submit`. All `auth: true`; ownership checked in the controller (403 on another founder's project, consistent with the role-guard pattern). Error mapping: 400 invalid transition, 422 missing required field (with `field`), 404 not found, 401 unauth, 403 forbidden.
- Service: `ProjectService` now takes a `UserIdentityService`; `createProject` grants `Role.Founder` (idempotent upsert). `submitForReview` validates required fields before transitioning (status guard runs first).
- Model: `SUBMISSION_REQUIRED_FIELDS` (form-display order) + conditional `betaDescription` when `isOpenForBeta=true`; `MissingRequiredFieldError`; `ProjectDraftBody` (name required, rest optional, shared by create + draft), `ProjectIdParams`, `ProjectResponse` (= `SelectProject`), `FieldErrorResponse`.
- Required-field set derived from PRD §3.2. Known deferrals (see project memory `prd-schema-gaps.md`): 项目形态 has no schema column (needs migration); per-field length/format rules and category-enum validation not implemented (presence-only validation here).
- Tests: `test/modules/project/service.test.ts` (founder grant + idempotency, required-field ordering, conditional betaDescription, multi-save same row) and `test/modules/project/index.test.ts` (HTTP: auth 401, ownership 403, 404, draft 400 after status leaves 0/2, submit 422 first-missing-field). Full suite 89 pass.
