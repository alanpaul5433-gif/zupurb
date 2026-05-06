# Zupurb — Agent Routing Guide

Five specialized subagents handle the build. Use the Agent tool with the matching `subagent_type` to delegate work. Subagent definitions live in `.claude/agents/`.

---

## Routing Table

| Request type | Agent | Examples |
|---|---|---|
| New screen, widget, navigation, state | `frontend-dev` | "Build the Login screen," "Wire bottom nav," "Add Plus paywall" |
| Schema, Cloud Function, algorithm, ledger | `backend-dev` | "Implement UAR engine," "Calculate dual scores," "Set up points expiry cron" |
| Third-party SDK wiring, vendor evaluation | `integrations-dev` | "Integrate Document AI for OCR," "Wire RevenueCat," "Add Branch deep links" |
| Test authoring, store-policy audit, perf | `qa-tester` | "Write E2E for review submission," "Run T9 checklist," "Audit for ATT compliance" |
| CI/CD, signing, beta, submission | `release-engineer` | "Set up Codemagic," "Configure Fastlane match," "Submit to TestFlight" |

---

## How to Invoke

**From the main session, use the Agent tool:**

```
Agent({
  subagent_type: "frontend-dev",
  description: "Build Splash + Login screens",
  prompt: "Build Phase 1A: Splash and Login screens per Zupurb User App/UI/iPhone 16 Pro - 22.png and iPhone 16 Pro - 41.png. Faithful to mockup. No fixes applied. Stack: Flutter + Riverpod. Confirm scaffold and asset locations before writing widgets."
})
```

**Rules for invocation:**
1. Always include the milestone or phase the work belongs to.
2. Always reference exact file paths the agent should read.
3. Always state whether fixes are allowed (Phase 1A: NO. Phase 1B: YES per `FIX_LIST.md`).
4. Keep prompts self-contained — agents don't see the parent session's context.

---

## Pillar Boundaries

Each agent has a tight scope. Crossings require user routing.

### `frontend-dev`
- ✅ Builds widgets, screens, navigation, theme, design tokens.
- ✅ Holds screen-local state (Riverpod / BLoC / Provider).
- ❌ Does not write Cloud Functions.
- ❌ Does not configure third-party SDKs (only consumes ready-made wrappers).
- ❌ Does not write tests beyond widget smoke tests.

### `backend-dev`
- ✅ Firestore schemas, security rules, Cloud Functions, scoring algorithms.
- ✅ Performance and indexing.
- ❌ Does not touch app UI.
- ❌ Does not configure third-party SDKs (delegates to `integrations-dev`).

### `integrations-dev`
- ✅ Vendor selection, SDK installation, credential management, sandbox setup, integration tests for the integration itself.
- ✅ Writes thin wrappers exposed to frontend or backend.
- ❌ Does not own product logic — only the bridge to the vendor.

### `qa-tester`
- ✅ Test authoring at every level (unit / widget / integration / E2E / visual / a11y / perf / store policy).
- ✅ Runs the T9 store policy checklist.
- ❌ Does not fix bugs — files them. The owning pillar fixes.

### `release-engineer`
- ✅ CI pipelines, signing, beta channels, store metadata, submissions, monitoring, rollback.
- ❌ Does not write product code.
- ❌ Does not approve code merges (that's reviewers).

---

## Handoff Pattern

When work crosses a pillar boundary:

1. The current agent **stops** at the boundary.
2. Returns a summary to the user with: what was completed, what's needed next, which pillar should pick it up.
3. The user invokes the next pillar's agent with the handoff context in the prompt.

Example handoff text the agent should produce:
> "Phase 1A Login screen complete. Next pillar: `backend-dev` to wire Firebase Auth providers (B1 milestone). Files needed: `lib/screens/login_screen.dart`."

---

## Adding a New Agent

If a new pillar is identified later (e.g., "data-science" for ML model training):

1. Add a row to the routing table above.
2. Create `.claude/agents/<new-agent>.md`.
3. Update `DEVELOPMENT_PLAN.md` §1 The Five Pillars.
4. Update `RULES.md` if scope rules change.
