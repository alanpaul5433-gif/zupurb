# Zupurb — Project Instructions

This file is loaded automatically by Claude Code in every session for this project. It defines the rules of engagement. **Do not bypass these rules without explicit user approval.**

## Model & Mode

- **Model:** Claude Sonnet 4.6
- **Mode:** Medium
- **Token efficiency is mandatory.** Prefer concise edits over rewrites. Read only what you need. Don't restate context the user already has.

## Project Structure

```
C:\Projects\Zupurb\
├── CLAUDE.md                          ← you are here
├── docs/
│   ├── DEVELOPMENT_PLAN.md            ← master plan (read this first)
│   ├── ARCHITECTURE.md                ← system architecture, data, algorithms, folder structures
│   ├── RULES.md                       ← guardrails & gates
│   ├── AGENTS.md                      ← who does what
│   └── FIX_LIST.md                    ← P0/P1/P2 fix register
├── .claude/agents/                    ← specialized subagents
│   ├── frontend-dev.md
│   ├── backend-dev.md
│   ├── integrations-dev.md
│   ├── qa-tester.md
│   └── release-engineer.md
└── Zupurb User App/
    ├── ZUPURB - SOW V6.pdf            ← spec
    └── UI/                            ← Figma mockup exports (truth for Phase 1A)
```

## The Five-Pillar Build Model

Work is organized into five pillars. Each has a dedicated subagent. See `docs/AGENTS.md`.

1. **Frontend** — UI, screens, state, navigation
2. **Backend** — data models, business logic, Cloud Functions, algorithms
3. **Integrations** — third-party services (OCR, AI, gift cards, maps, IAP, etc.)
4. **Testing** — unit, integration, E2E, store-policy compliance
5. **Deployment** — CI/CD, signing, store submission, releases

## ⚠️ Critical Frontend Sequencing Rule

Frontend is split into two phases with a hard approval gate between them:

- **Phase 1A — Build-to-Mockup:** Implement every screen in `Zupurb User App/UI/` exactly as designed. **Do not apply audit fixes.** Typos, scoring inconsistencies, missing screens — all preserved as-is. Phase 1A is purely a faithful translation of mockups to code.
- **APPROVAL GATE:** When Phase 1A is complete and signed off by the user, stop. Do not proceed to 1B without explicit "approved" or equivalent confirmation.
- **Phase 1B — Fix List Application:** Only after approval, apply the audit fixes from `docs/FIX_LIST.md` (P0 → P1 → P2).

This is a non-negotiable rule. Future sessions must respect this gate even if context has been compacted.

## Working Rules

1. **Read the plan first.** Before any task, read `docs/DEVELOPMENT_PLAN.md` and `docs/RULES.md`.
2. **Use the right agent.** Don't do frontend work in the backend agent's session, or vice versa. See `docs/AGENTS.md` for routing.
3. **Token economy:**
   - Don't re-read files already shown in the session.
   - Use Edit, not Write, for modifications to existing files.
   - Use Grep before Read; don't read entire files to find one symbol.
   - Use Agent tool only when truly parallelizable; subagents are for handoffs, not duplication.
4. **No autonomous scope expansion.** Stick to the milestone in flight. If you discover an out-of-scope issue, log it in `docs/FIX_LIST.md` and continue.
5. **Document decisions inline.** When you make a non-obvious choice, write it to the relevant doc, not just the chat.
6. **Never commit without being asked.** No git operations unless the user explicitly requests them.
7. **No development has started yet.** Until the user says "begin Phase 1A," all work is planning only.

## When in Doubt

Default to: read the plan → ask the user → execute the smallest viable step → confirm before continuing.
