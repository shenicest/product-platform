# 02 — Auth plugin (consume external JWT)

**What to build:** A global Elysia plugin that parses JWT tokens issued by an external auth system. The plugin extracts `user_id` from the token and decorates it onto the request context. Routes that require authentication use a guard or macro to enforce it. Unauthenticated requests to protected routes receive 401.

**Blocked by:** 01 — Project scaffolding + DB setup

**Status:** done

- [x] JWT plugin registered as a global or reusable plugin
- [x] Valid JWT decorates `user_id` onto context
- [x] Missing or invalid JWT on protected routes returns 401
- [x] Public routes (e.g. project list, project detail) work without a token
- [x] Guard/macro mechanism for marking routes as auth-required
- [x] Tests cover: valid token, missing token, expired token, malformed token

**Implementation notes:**
- Plugin: `src/plugins/auth.ts`, named `{ name: 'auth' }` for deduplication
- Uses `@elysiajs/jwt` with `JWT_SECRET` env var
- Macro pattern: routes opt in with `{ auth: true }` in route config
- On success, decorates `{ user: { userId: string } }` onto context
- Returns `status(401, 'Unauthorized')` for missing/malformed/expired/wrong-secret tokens
- Public routes simply omit `auth: true` — no enforcement
- Tests: `test/plugins/auth.test.ts` (7 cases)
