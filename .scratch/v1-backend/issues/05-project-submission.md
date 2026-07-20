# 05 — Project submission (save draft + submit for review)

**What to build:** APIs for Founders to create projects, save drafts, and submit for review. Creating a project inserts a `projects` row with `status=0` (Draft). Saving a draft updates the same `projects` row in place (only allowed while status is 0 Draft or 2 Revision Required). Submitting for review validates all required fields and transitions `status` to `1` (Pending Review). First project creation automatically grants the `founder` role via UserIdentity. No proposal is involved at this stage — proposals are only for post-live edits (see ticket 04 / 08).

**Blocked by:** 04 — Project + ProjectEditProposal schema + core service

**Status:** ready-for-agent

- [ ] POST create project: inserts `projects` row (`status=0`), grants `founder` role. Body: initial draft fields (minimum `name`).
- [ ] PUT save draft: updates the `projects` row in place. Allowed only when `status` is `0` (Draft) or `2` (Revision Required). Validates minimum field (`name`).
- [ ] PUT submit for review: validates all required fields, transitions `status 0|2 → 1` (Pending Review).
- [ ] Submit with missing required fields returns validation error pointing to first missing field.
- [ ] Auth required: all endpoints require authenticated user; the project must belong to the authenticated user.
- [ ] Tests cover: create project, save draft multiple times (same row, no new records), submit for review, submit with missing fields, auto-grant founder role, cannot edit another founder's project, draft edit rejected after status leaves 0/2.
