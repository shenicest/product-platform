# 04 — Project + ProjectRevision schema + core service

**What to build:** The `projects` and `project_revisions` tables with their core service logic. Project is an identity/lifecycle container (id, user_id, current_revision_id, live_revision_id, project_flag, live_categories, live_stage). ProjectRevision holds all displayable content with its own status (0-5). The service enforces state machine transitions, revision creation rules, and denormalized field synchronization.

**Blocked by:** 01 — Project scaffolding + DB setup, 03 — UserIdentity module

**Status:** ready-for-agent

- [ ] `projects` table: `id`, `user_id`, `current_revision_id`, `live_revision_id`, `project_flag` (tinyint 0-2), `live_categories` (JSON), `live_stage` (tinyint), `created_at`, `updated_at`
- [ ] `project_revisions` table: `id`, `project_id`, `status` (tinyint 0-5), all content fields (name, tagline, description, cover, demo assets, demo link, stage, categories, target users, user problem, progress, next steps, message to users, beta settings, contact info, team name), `created_at`, `updated_at`
- [ ] State machine: valid transitions enforced in service (invalid transitions rejected)
- [ ] Revision creation rules: draft updates in place, first submission same revision, require-modification same revision, post-live edit creates new revision
- [ ] Denormalized sync: on revision approval, `live_categories` and `live_stage` updated on Project
- [ ] Derived project state logic: compute effective state from `live_revision_id` + `project_flag` + `current_revision.status`
- [ ] Tests cover: all valid state transitions, all invalid transitions rejected, revision creation rules for each scenario, denormalized field sync on approval
