# Hackathon connection requests live in a separate table

> **Status: Accepted**

## Context

The hackathon connection feature (PRD: 黑客松项目建联) needs connection requests aimed at external hackathon projects. The platform already has a `connection_requests` table built for Talent Plaza, and the two features share several mechanics: the `ConnectionRequestStatus` enum (shared package), AES-GCM contact encryption (`lib/contact-encryption.ts`), the `pair_key` pending-unique pattern, the daily-limit table shape, and the connections-record UI.

So the question: extend `connection_requests` with a polymorphic "target type", or create a new `hackathon_connection_requests` table?

Concrete mismatches found in the code:

- **`projectId` semantics are opposite.** In Talent, `projectId` means "a Live Project owned by the sender" — `talent/service.ts` rejects requests where `project.userId !== senderUserId`. For hackathon, the project is the *target* the sender wants to reach, it lives in the external event database (`event_management`), and there is no local `projects` row at all.
- **Receiver preconditions differ.** Talent receivers must have a Published `TalentProfile`; hackathon project teams have no such premise. Their authorization flows through a new platform-side mapping (`hackathon_project_contacts`), not a profile.
- **Lifecycle hooks differ.** Hackathon requests get auto-cancelled when the target project is hidden and re-gated by a 7-day ignore cooldown — rules that don't exist in Talent.

## Decision

Create an independent `hackathon_connection_requests` table (plus its own `hackathon_connection_daily_limits`), and do **not** extend `connection_requests`.

What is shared stays shared without schema changes: the status enum lives in `@shenicest/shared`, contact encryption in `lib/`, the `pair_key` unique-while-pending pattern (`uq_hackathon_connection_requests_active_pair`, NULLed on terminal states — same as Talent's `uq_connection_requests_active_pair`), and the unified connections-record DTO at the API layer.

`hackathon_project_contacts` deliberately has **no `is_active` column** (product confirmed P0 needs no on/off switch): "connectable" = project visible AND a contact row exists. The column can be added later without touching the requests table.

## Considered Options

- **Extend `connection_requests` with nullable polymorphic columns** — Rejected. It would need a nullable `target_type` plus nullable columns whose meaning flips with the type (`project_id` as "sender's own project" vs "target project" is actively dangerous), branching validation and accept/ignore logic inside the existing Talent service, and regression risk for every Talent test currently locking the module's behavior.
- **Single generic `connection_requests` unified from day one** — Rejected for P0. The PRD (section 19) explicitly defers platform-Project connections; building the `ConnectionTarget` abstraction now is speculative generality with one concrete consumer.
- **Separate tables, shared primitives (chosen)** — Isolates the blast radius to a new module; Talent code and tests have zero regression surface. The duplication cost is small: ~14 columns of simple scalar fields.

## Consequences

- **Talent module untouched** — no migration, no behavior change, no test churn in `talent/`.
- **Aggregation is a read-layer concern** — the unified `GET /connections` composes both services into a common DTO (`source`/`target`); it does not imply a unified table.
- **Repetition of mechanics** — daily-limit and pair-key logic exist twice (Talent + Hackathon). Accepted trade-off; if a third connection surface appears, extract the shared service then rather than pre-abstracting now.
- **Future unification path stays open** — when platform Projects join, evaluate a shared `ConnectionTarget` abstraction over the two tables instead of merging rows.
