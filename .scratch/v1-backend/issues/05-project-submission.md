# 05 — Project submission (save draft + submit for review)

**What to build:** APIs for Founders to create projects, save drafts, and submit for review. Saving a draft creates a Project + ProjectRevision (status=0) if new, or updates the existing revision in place. Submitting for review validates all required fields and transitions revision to status=1. First project creation automatically grants the `founder` role via UserIdentity.

**Blocked by:** 04 — Project + ProjectRevision schema + core service

**Status:** ready-for-agent

- [ ] POST create project: creates Project + Revision (status=0), grants `founder` role
- [ ] PUT save draft: updates existing revision in place, validates minimum field (project name)
- [ ] PUT submit for review: validates all required fields, transitions revision to status=1
- [ ] Submit with missing required fields returns validation error pointing to first missing field
- [ ] Auth required: all endpoints require authenticated user
- [ ] Tests cover: create project, save draft multiple times (same revision), submit for review, submit with missing fields, auto-grant founder role
