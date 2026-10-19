# Talent skills become a dual-state wall; direction is derived, never asked

> **Status: Accepted**

## Context

The Talent Plaza editor rendered the same ~40-tag skill wall twice (「我能交付的」skills and 「希望一起做的」seekingSkills), the single biggest source of "表单太长、压力大". Separately, 方向 (`roles`, 7 categories) duplicated information already implied by skills — picking 后端开发 already means 开发.

Validated against the code: `talent_profiles` already stored both `skills` and `seekingSkills` JSON arrays, so the dual-state data model existed; only the UI rendered two walls. Skills grouping (`TALENT_SKILL_GROUPS`) was hardcoded as `slice()` indices over the shared `TALENT_SKILLS` array — any reorder of the catalog silently corrupted every group. The list page also offered a direction dropdown backed by the `roles` column; array-length rules (skills 3–10 etc.) lived only in frontend validation.

## Decision

- **Skills UI = one wall, three states.** A tag cycles 未选 → 我能提供 → 我想寻找 → 未选. 我能提供 stays required 3–10; 我想寻找 stays optional 0–5; a tag cannot hold both states. The state maps directly onto the existing `skills` / `seekingSkills` columns — no schema change for this half of the decision.
- **Delete `roles`.** Direction is derived from the skill groups of a profile's `skills`; it is never asked as a question. The list-page direction dropdown is removed (skills text search remains) rather than re-implemented as a derived query.
- **Move TALENT_SKILL_GROUPS into `@shenicest/shared`** as structured vocabulary (skill → group), eliminating the slice-index coupling.
- **bio and links form an at-least-one pair**: `bio` 30–500 chars with template prompts, `links` 0–3 URLs (GitHub / portfolio / personal site — proof-of-work over prose).
- **Add required `TalentAvailability`** (tinyint: ActivelySeeking 0 / OpenToChat 1 / ConsultOnly 2) — the "减少无效沟通" signal.
- **Unify `headline` with the Project tagline** at 4–50 characters.

Required checklist items settle at 6 (headline / bio-or-links / skills / domains / durations / availability), and the page renders one skill wall instead of two.

## Considered Options

- **方案 B: 只选角色大类 + 一句补充** — Rejected. Simplest build, but matching granularity collapses from 40 skills to 7 roles; two-way matching with Project `seekingSkills` (ADR-0012) depends on skill-level granularity.
- **方案 C: 第二面墙排除已选 + 默认折叠** — Rejected. Smallest diff, but the page stays long; it treats the symptom (rendering) not the cause (asking the same taxonomy twice).
- **Keep `roles` and derive the filter server-side** — Rejected. Keeping a redundant stored field violates the same denormalization judgment as ADR-0006; and once direction is derivable, the filter itself was deemed low-value compared to skills search.

## Consequences

- `talent_profiles.roles` column is dropped — breaking migration, whole-database reset (same policy as ADR-0012).
- `TALENT_SKILL_GROUPS` becomes shared vocabulary; the web talent UI and any future skill-group consumers (e.g., derived direction display) read one source of truth.
- Matching (`talent/matching.ts`) keeps working off skills/seekingSkills unchanged.
- The bio requirement relaxes from unconditional to at-least-one-with-links; `bio` column must become nullable and `links` a new JSON column.
