# Zupurb — Staged Rollout Plan (D7)

---

## Overview

Play Store supports percentage-based rollout promotion. App Store supports a 7-day phased release (automatic percentage ramp). Both can be paused or halted at any gate if criteria are not met.

---

## Gate Criteria (must be green before advancing)

| Metric | Pass threshold | Fail threshold (halt) |
|---|---|---|
| Crash-free users rate | > 99.5% | < 98% (rollback trigger) |
| ANR rate (Android) | < 0.5% | > 1% |
| 1-star review spike | < 5% of new reviews | >= 10% of new reviews in 24 h |
| P0 bug reported | None open | Any single P0 open |
| D1 retention (Week 2+) | Measure; no hard gate yet | Significant drop vs. internal beta |

---

## Rollout Schedule

### Week 1 — 1% (Play) / Day 1–2 of phased release (App Store)

**Target audience:** ~1% of eligible users.

**Focus metrics:**
- Crash-free users rate (Crashlytics)
- ANR rate (Play Console → Android Vitals)
- App cold start time (Firebase Performance)
- Cloud Function error rate (Cloud Monitoring)

**Actions:**
1. Play Console → Production → Manage release → Edit rollout percentage → set 1%.
2. App Store Connect → Version → Phased Release → Enable (7-day automatic ramp begins).
3. Monitor Crashlytics dashboard every 4 h for first 48 h.
4. Monitor Cloud Monitoring alerts for function error spikes.

**Gate check:** End of Week 1, confirm all gate criteria are green before advancing.

---

### Week 2 — 10% (Play) / Day 3–4 (App Store automatic)

**Target audience:** ~10% of eligible users.

**Additional focus metrics (beyond Week 1):**
- D1 retention (Analytics: users returning on Day 1 after first open)
- Review submission funnel drop-off
- IAP conversion (plus_subscribed event)

**Actions:**
1. Play Console → Production → Manage release → Update rollout to 10%.
2. App Store phased release advances automatically to ~33% around Day 3–4; monitor but no manual action needed unless halting.

**Gate check:** End of Week 2, confirm criteria met.

---

### Week 3 — 25% (Play) / Day 5–6 (App Store automatic ~66%)

**Additional focus metrics:**
- App Store / Play Store public ratings (target >= 4.2 stars)
- 1-star review content — scan for critical bugs not caught in testing
- Referral code usage (referral_used event) — confirm growth loop is active
- Firestore cost trend — confirm no runaway reads at scale

**Actions:**
1. Play Console → Update rollout to 25%.
2. Respond to any 1-star reviews flagging functional bugs; route to engineering if P0.

**Gate check:** End of Week 3.

---

### Week 4 — 100% (Play) / Day 7 (App Store automatic 100%)

**Condition:** All gate criteria green across Weeks 1–3.

**Actions:**
1. Play Console → Update rollout to 100% → Confirm.
2. App Store phased release completes automatically on Day 7; no manual action.
3. Post to Statuspage: "v[X.Y.Z] fully rolled out."
4. Tag git: `v[X.Y.Z]-full-rollout` (annotation only, not a new build tag).

---

## How to Pause or Halt a Rollout

### Google Play

1. Play Console → Your app → Production → [active release] → Manage release.
2. Click "Halt rollout."
3. The release remains visible to users already on it but no new users receive it.
4. To resume: click "Resume rollout" and select the same or lower percentage.
5. To promote previous version: go to the prior release → "Promote to production."

### App Store

1. App Store Connect → Your app → App Store tab → Version → Phased Release.
2. Click "Pause phased release." iOS will stop delivering the update to additional users.
3. Pause can be held for up to 30 days before Apple forces a resume or the release must be removed.
4. To remove entirely: contact App Store Review (expedited review required for replacement build).

---

## Rollback Triggers

Immediately halt rollout and initiate rollback procedure (see ROLLBACK_PROCEDURES.md) if any of the following occur:

| Trigger | Threshold |
|---|---|
| Crash-free rate drops | < 98% (i.e., crash rate > 2%) |
| P0 bug confirmed | Any single P0 in production |
| IAP billing failure | > 1% of purchase attempts failing |
| Data integrity issue | Any confirmed Firestore data loss or corruption |
| App Check bypass confirmed | Any confirmed unauthorized access reaching production data |

---

## Required GitHub Actions Secrets (for CI promotion scripts)

These secrets are required if automated promotion scripts are added to the release workflow:

| Secret name | Purpose |
|---|---|
| `PLAY_STORE_JSON_KEY` | Service account for Play Console API calls |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect API — key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect API — issuer ID |
| `APP_STORE_CONNECT_PRIVATE_KEY` | App Store Connect API — .p8 private key |

Note: Week 1 rollout initiation is a manual Play Console action. Automation of percentage bumps (via Fastlane `supply` or direct Play Developer API) can be added in a follow-up milestone.

---

*Milestone: D7 | Owner: Release Engineer | Last updated: 2026-05-07*
