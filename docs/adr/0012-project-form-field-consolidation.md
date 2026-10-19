# Project form field consolidation (breaking)

> **Status: Accepted**

## Context

The 2026-10-18 audit of the submission form (`产品平台表单优化方案.md`) found priority inversion: the only field pointing at future prospects (下一步计划) was optional, the marketing blurb (想对用户说的话) was required with no length limit, and description/targetUsers/userProblem/progress forced founders to write the same narrative four times (~160 chars minimum of prose). 12 of 20 fields were required.

Validated against the code: project field length rules lived almost entirely in the frontend (`project-form-validation.ts` + DOM `maxLength`); the backend `ProjectDraftBody` enforced only `name` minLength. Demo video was a ≤200MB file upload; contact phone was restricted to 11-digit mainland China numbers; and `GET /projects/:id` leaked all contact columns to any visitor.

## Decision

Rebuild the Project content model, accepting a **breaking migration with a full database reset** — no compatibility shim, no data-migration script:

- **Drop** `description` and `messageToUsers` outright.
- **Merge** `targetUsers` + `userProblem` into one required field `problemStatement` ("为谁解决什么问题", 30–300 chars).
- **Re-weight**: `progress` optional ≤300 chars (stage now carries structure); `nextSteps` required ≤300 chars (the only forward-looking field, promoted to required).
- **Add**: `differentiation` (optional ≤100), `businessModel` (optional ≤200), Traction trio `userCount`/`monthlyRevenue` (CNY/month)/`retentionRate` (% 30-day) all optional integers, `seekingSkills` (≤5 from the shared TALENT_SKILLS vocabulary, aligning projects with the Talent Plaza skill catalog for two-way matching).
- **Video**: file upload replaced by URL paste (B站/YouTube), reusing `demoVideoUrl` as an http(s) link.
- **Contact**: keep `contactPhone`/`contactEmail`/`contactWechat` as three nullable columns with an at-least-one rule at submission; drop the mainland-China phone format rule (overseas and remote founders); contact fields become **private** — filtered from list/detail responses for anyone who is not the owner or an Operator.
- **Stage**: expand ProjectStage from 2 to 5 ascending levels (`Idea`/`Prototype`/`Mvp`/`Launched`/`Revenue` = 0–4).
- **Tagline**: unify to 4–50 characters, same rule as the Talent headline.
- **Proposal whitelist** (per ADR-0004 mechanics, unchanged) becomes `problemStatement`, `nextSteps`, `demoLink`, `betaDescription`.

Required fields drop from 12 to 7; required long-text from 4 fields (~160 chars) to 2 (~40 chars minimum).

## Considered Options

- **Keep `description` as optional 50–800** / keep `messageToUsers` as optional ≤100 — Rejected. Prose already lives in problemStatement/nextSteps; every retained "just in case" field re-opens the overlap the audit set out to remove.
- **Two-column preferred-contact pair (`type`+`value`)** — Rejected. Three nullable columns with an at-least-one rule let founders leave multiple channels; structure is identical in practice and simpler in the form.
- **One-shot data-migration script** (concatenating old narratives into problemStory, merging contacts) — Rejected. The deleted fields were identified as redundant marketing prose with no preservation value; the platform resets the whole database and re-seeds.

## Consequences

- Old `projects` rows are discarded; existing submissions must be re-entered. Accepted — the platform resets in full.
- The project detail page body restructures around problemStatement/nextSteps/traction; there is no `description` to render.
- API responses must actively filter contact fields for non-owner/non-operator callers — new server-side responsibility that did not exist before.
- Proposal flows touching `description` (fixtures, tests, CONTEXT.md, proposal service) all migrate to the new 4-field whitelist.
