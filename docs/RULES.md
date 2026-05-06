# Zupurb — Rules & Guardrails

This file defines non-negotiable rules for every session and every agent. Violations require explicit user override.

---

## R1. The Frontend Approval Gate (Hard Rule)

- **R1.1** Frontend Phase 1A must complete before Phase 1B begins.
- **R1.2** Phase 1A = build to mockups in `Zupurb User App/UI/` exactly as designed. No fixes applied.
- **R1.3** When Phase 1A is complete, the agent must explicitly request approval: *"Phase 1A is complete. Do you approve starting Phase 1B?"*
- **R1.4** No work on Phase 1B may begin until the user replies with "yes," "approved," "go," or equivalent affirmative.
- **R1.5** This gate persists across sessions. If a new session opens with Phase 1A unfinished, the new agent must continue 1A — not jump to 1B.

## R2. Pillar Separation

- **R2.1** Each pillar (Frontend / Backend / Integrations / Testing / Deployment) has a dedicated agent. See `AGENTS.md`.
- **R2.2** Don't do backend work in a frontend agent session. Hand off via the user.
- **R2.3** Cross-pillar coordination flows through the user, not agent-to-agent calls.

## R3. Token Economy

- **R3.1** Use Sonnet 4.6, Medium mode.
- **R3.2** Read only what's needed. Use Grep before Read where possible. Never read a file you've already read in the same session.
- **R3.3** Use Edit, not Write, for modifications. Write is for new files only.
- **R3.4** Don't restate context the user has visible in the conversation.
- **R3.5** End-of-turn summaries: 1–2 sentences. No headers, no bullet recaps, unless the user asks.
- **R3.6** Do not spawn parallel subagents for trivially small tasks.

## R4. Scope Discipline

- **R4.1** Stick to the milestone in flight.
- **R4.2** If you discover an out-of-scope issue, log it in `FIX_LIST.md` and continue.
- **R4.3** No autonomous refactors. No "while I'm here" cleanup.
- **R4.4** No new features without an updated milestone in `DEVELOPMENT_PLAN.md`.

## R5. SOW Contradictions Must Be Resolved Before Build

- **R5.1** ~~Partially Verified weight vs points~~ — **RESOLVED 2026-05-05:** 25 pts flat (same as Unverified). 75% score weight remains the differential incentive.
- **R5.2** ~~Founder Badge cap~~ — **RESOLVED 2026-05-05:** 150 (per SOW §13.1). Fix UI copy in Phase 1B P1-7.
- **R5.3** ~~Reservation flow~~ — **RESOLVED 2026-05-05:** Instant-confirm. Remove "Requested" status from UI in Phase 1B.
- **R5.4** ~~$25 cancellation fee~~ — **RESOLVED 2026-05-05:** No fee. Hard cutoff: cancellation only allowed more than 48 hours before reservation. Within 48 hours = no-show penalty applies.
- **R5.5** ~~Tiered loyalty~~ — **RESOLVED 2026-05-05:** Included at launch (reversed). New milestone B14. Blocked until client provides tier design spec — see `DEVELOPMENT_PLAN.md` §11.1.
- **R5.6** ~~Referral bonus~~ — **RESOLVED 2026-05-05:** Included in launch scope. New milestone B13 + I-referral added to plan. Requires SOW addendum from client. ~2–3 wks build.

**All R5 contradictions are now resolved.**

Track resolutions in `DEVELOPMENT_PLAN.md` §8 Decision Log.

## R6. No Premature Development

- **R6.1** No code is written until the user says **"begin Phase 1A"** (or another explicit kickoff).
- **R6.2** Until kickoff, all work is planning, documentation, and decision capture only.

## R7. Git & Releases

- **R7.1** Never commit without an explicit user request.
- **R7.2** Never push, force-push, or rebase published branches without explicit user request.
- **R7.3** Never bypass hooks (`--no-verify`).
- **R7.4** Never amend a published commit.
- **R7.5** Branching: `feat/*`, `fix/*`, `chore/*`, `docs/*`. PRs target `main` via `develop` once `develop` exists.

## R8. Store Policy Compliance

- **R8.1** The T9 checklist in `DEVELOPMENT_PLAN.md` §5.1 is mandatory before submission.
- **R8.2** Account deletion must be accessible from inside the app (Apple §5.1.1(v) + Google Play policy).
- **R8.3** All IAP must use StoreKit (iOS) and Google Play Billing (Android). No external payment links.
- **R8.4** ATT prompt before any tracking SDK fires on iOS.
- **R8.5** Privacy nutrition labels must match actual data collection.

## R9. Documentation Discipline

- **R9.1** Non-obvious decisions are captured in `DEVELOPMENT_PLAN.md` §8 Decision Log.
- **R9.2** New rules go in `RULES.md` (this file).
- **R9.3** New audit findings go in `FIX_LIST.md`.
- **R9.4** This documentation set is the canonical plan. Don't fork it.

## R10. Confirmation Before Risky Actions

- **R10.1** Any destructive operation (file deletion, dependency removal, schema migration, force-push) requires explicit user confirmation in chat.
- **R10.2** Cost-incurring third-party API calls during development (e.g., Document AI batches, gift card sandbox) need explicit per-batch authorization.
- **R10.3** Adding a new third-party SDK requires updating `DEVELOPMENT_PLAN.md` §4 Integrations and getting user sign-off.
