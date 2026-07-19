# 03 — UserIdentity module (schema + service + routes)

**What to build:** The `user_identities` table and module that manages platform-specific roles. A User can hold multiple roles (`founder`, `operator`). Roles are stored as `varchar`, not database enum. The module provides APIs to grant and query roles. An operator seed user is created via migration or seed script.

**Blocked by:** 01 — Project scaffolding + DB setup, 02 — Auth plugin

**Status:** ready-for-agent

- [ ] `user_identities` table: `id`, `user_id`, `role` (varchar), `created_at`
- [ ] Service: `grantRole(userId, role)`, `hasRole(userId, role)`, `getRoles(userId)`
- [ ] Duplicate role grants are idempotent (no error, no duplicate row)
- [ ] Operator seed data created (a known user_id with role=operator)
- [ ] Routes for querying identity (protected, operator-only where appropriate)
- [ ] Tests cover: grant role, check role, idempotent grant, query roles
