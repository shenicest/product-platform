# 01 — Web foundation + listing tracer bullet

**What to build:** The public site skeleton serving real data. A visitor opens the home page and sees Live projects rendered as cards from the API. This ticket establishes the whole stack end to end: site shell, typed API client, server-side data fetching — the tracer bullet every later ticket builds on.

**Decisions encoded (from grilling session):**

- Rendering: React Server Components fetch the API on the server. No client-side fetch library. Filters/pagination will live in URL searchParams (ticket 02).
- API typing: Eden Treaty. The web app imports the backend `App` type and creates a treaty client — end-to-end typed routes/params/responses. Note: `@shenicest/api` currently has no package `exports`/`main`, so its package.json must expose the entry for type import (mirror how `@shenicest/shared` does it). Type-only import — no elysia runtime code enters the web bundle.
- API base URL comes from a server-side env var (not `NEXT_PUBLIC_*`), with a sensible dev default pointing at the local API.
- UI language zh-CN. Light mode only — no dark mode this round.
- Visual direction: restrained minimalism, content-first, on top of shadcn/ui defaults. Generous whitespace, cards as the unit, no decoration that competes with project covers/copy.
- No authentication anywhere in this round — pure anonymous visitor experience.
- IMPORTANT: this repo's Next.js is NOT stock — before writing any Next.js code, read the guides in `node_modules/next/dist/docs/` (from `apps/web`). APIs/conventions may differ from training data.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] Home page (`/`) renders Live projects as cards (cover, name, tagline) from real API data, verified against seed data (`bun run seed`)
- [x] Site shell: lightweight header (logo + nav placeholder) and footer; zh-CN; light theme only
- [x] Eden Treaty client wired with the backend `App` type; list call is fully typed end to end
- [x] `@shenicest/api` package exposes its entry/App type for web consumption
- [x] API base URL read from a server-side env var, validated at module top (no bare `process.env.X!`)
- [x] `bun run build` (web) and lint pass

## Implementation Notes

- **Eden version pinning**: installed `@elysiajs/eden@1.4.9`. The lockfile resolves `elysia@1.4.29` (package.json declares `^1.2.25`), so the modern Eden is the correct pairing — `eden@1.2.0` was tried and rejected because its type-level `elysia` resolution degrades under the repo's isolated (non-hoisted) node_modules.
- **API type export**: added `main` + `exports` to `@shenicest/api` pointing at `src/index.ts` (mirrors `@shenicest/shared`), and added `@shenicest/api` as a `workspace:*` dependency of web. Web consumes it via `import type { App }` only — erased before bundling, so no elysia runtime code ships to the client.
- **Client**: `src/lib/api.ts` creates `treaty<App>(API_URL)`; `API_URL` defaults to `http://localhost:3000` and is validated with `URL.canParse` at module top.
- **Data layer**: `src/server/projects.ts` exposes `getLiveProjects` (wrapped in `React.cache`) and derives `Project` / `ProjectListResponse` types from the Eden response — no manual type duplication.
- **Rendering**: home page is `export const dynamic = 'force-dynamic'`. With `cacheComponents` off, an uncached fetch before any request-time API would otherwise be prerendered at build time (making `next build` call the API). `force-dynamic` keeps it server-rendered per request (SEO intact) while letting the build pass with the API offline. Route table shows `/` as `ƒ (Dynamic)`.
- **Images**: covers use a plain `<img>` (with an eslint-disable for `@next/next/no-img-element`) because cover URLs are arbitrary user input and cannot be enumerated in `next/image` `remotePatterns`. Revisit once covers are constrained to a known CDN.
- **Seed**: `apps/api/src/db/seed.ts` now also inserts 7 demo projects (5 Live, 1 Draft, 1 Pending Review) so the public listing is verifiable; it skips project seeding if the table is non-empty. Verified the list endpoint returns only the 5 Live rows.
- **Verification**: `next build` (web) clean; `eslint` clean (0 errors); `tsc --noEmit` clean in both apps; full api suite 207/207 pass; live render confirmed via dev server (all 5 Live projects server-rendered, Draft/Pending excluded, zh-CN + metadata correct).

## Code Review Dispositions (Standards + Spec, two-axis)

No blocking issues. Dispositions per finding:
- `dynamic = "force-dynamic"` — **kept, verified correct.** Bundled route-segment-config doc: `dynamic`/`revalidate`/`fetchCache` are removed only when `cacheComponents` is enabled; it is off here, so the previous-model config is valid.
- `STAGE_LABELS: Record<number,string>` — **kept.** Eden types `stage` as `number` (tinyint), not the `ProjectStage` (0|1) union, so a `Record<ProjectStage,string>` would force a cast at the index site.
- Seed category literals — **kept (fixture data).** Values intentionally match `CATEGORIES`; referencing by index would hurt readability. Domain enums (`ProjectStatus`/`ProjectStage`) are imported from `@shenicest/shared`.
- Card links to `/projects/[id]` — **kept (scaffolding).** Route 404s until ticket 03 lands; that is the intended target.
- Follow-ups (not blocking ticket 01): (a) consider extracting the Elysia `app` into a side-effect-free module and pointing `@shenicest/api` exports there, so the package entry isn't the `.listen()` bootstrap (currently safe because web uses `import type` only); (b) centralize the repeated `max-w-6xl` container class; (c) surface Eden error details instead of a bare throw; (d) pick a quote/semicolon style for web (nothing enforces one; repo is mixed).
