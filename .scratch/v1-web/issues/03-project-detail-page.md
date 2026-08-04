# 03 — Project detail page

**What to build:** A visitor opens a project and sees its full story: what it is, who it's for, how far it's come, how to try it, and whether the team is recruiting beta users. Non-Live or unknown projects show a graceful "not available" page rather than a raw error. Contact fields are never rendered — the public page is display-only this round.

**Blocked by:** 01 — Web foundation + listing tracer bullet

**Status:** done

- [x] `/projects/[id]` renders the full public content from the detail API: name, tagline, description, cover, demo images, demo video, demo link, stage, categories, team name
- [x] Long-form sections rendered: target users, user problem, progress, next steps, message to users
- [x] Beta recruitment block shown when `isOpenForBeta` is true (with `betaDescription`)
- [x] Contact fields (`contactName`, `contactPhone`, `contactEmail`, `contactWechat`) are NEVER rendered anywhere on the public page
- [x] Non-Live or nonexistent project → friendly "not available" page (user story 23), correct 404 semantics
- [x] Demo assets section handles missing fields gracefully (no empty frames/broken media)
- [x] Page metadata (title/description/OG) generated from project content for SEO
- [x] `bun run build` (web) and lint pass

## Implementation Notes

- **Data layer**: `getProject(id)` in `src/server/projects.ts` calls `api.projects({ id }).get()` (Eden treaty2 path-param form). Returns `null` only on a 404 — the API answers 404 for both nonexistent and non-Live projects for anonymous visitors. Any other failure (network, 5xx — Eden surfaces network errors as status 503) throws, matching `getLiveProjects`. Wrapped in React `cache()` so `generateMetadata` and the page share one fetch.
- **Page** (`src/app/projects/[id]/page.tsx`): `force-dynamic`; `parseProjectId` rejects non-numeric/unsafe IDs before fetching; `notFound()` on null. `generateMetadata` derives title (name), description (tagline, else description, truncated to 150 chars), and OG (title/description/type + cover image when present). Unavailable projects get title "项目不可用"; Next auto-injects `noindex` on 404s.
- **Detail component** (`src/components/project-detail.tsx`): header (cover, name, tagline, badges, team name), demo section, description, long-form sections, beta block. All optional fields pass through a `nonEmpty` trim guard, so whitespace-only values render nothing. Contact fields are deliberately never referenced — verified by rendering a stub project containing contact values and grepping the HTML.
- **Demo media** (`src/lib/demo-media.ts`): `resolveDemoVideo` maps arbitrary user-provided video URLs to an embeddable iframe (YouTube watch/embed/shorts/youtu.be, Bilibili BV → player.bilibili.com), a `<video>` element (direct .mp4/.webm/.ogg/.mov/.m4v files), or a plain link fallback — so unknown URLs never produce a broken player.
- **Not-available page** (user story 23): `notFound()` renders `src/app/projects/[id]/not-found.tsx` ("该项目暂不可用" + explanation + link back to the list) with real 404 status. Also added a root `src/app/not-found.tsx` for unmatched URLs; both share `src/components/not-found-shell.tsx`.
- **Refactors**: extracted `ProjectBadges` (stage + category pills) shared by `ProjectCard` and the detail header — the detail row uses Tailwind `contents` so badges and team name sit in one flex row.
- **Verification**: stub-API smoke tests covered full/minimal/missing/invalid projects, contact-leak grep, all three video fallback modes, metadata tags, and 404 statuses. `next build` + `eslint` clean; api suite 207/207. No web test suite this ticket (per agreement — build + lint are the gate).

## Code Review Dispositions (Standards + Spec, two-axis)

Fixed after review:
- `getProject` no longer conflates transport/5xx failures with 404 — only a 404 maps to `null` (friendly page); anything else throws, consistent with `getLiveProjects` and the ticket's "graceful page is for non-Live/unknown projects" semantics.
- Empty/whitespace-only demo values can no longer produce broken media: `demoImages` entries are filtered, `demoLink`/`demoVideoUrl`/`coverUrl`/`teamName`/long-form/beta text are trim-guarded.
- Duplicated code extracted: `NotFoundShell` (both 404 pages) and `ProjectBadges` (card + detail badge pills, incl. the `stageLabel` derivation).
- Detail header no longer renders an empty badge-row wrapper when stage/categories/team are all absent.

Kept as deliberate scope: root `app/not-found.tsx` (ticket only requires the project case, but the site had no 404 at all), and YouTube/Bilibili embed resolution in `resolveDemoVideo` (a reading of "no broken media" for real-world URLs). Judgement calls left alone: `parseProjectId`'s 10-digit cap (int PK; `isSafeInteger` is the real guard).
