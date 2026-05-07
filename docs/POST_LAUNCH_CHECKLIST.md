# Zupurb — Post-Launch Checklist (D9)

Complete these checks in order within the first 24 hours of the 1% rollout going live.
Each item must be confirmed by a named person before it is ticked off.

---

## Observability

- [ ] **Crashlytics receiving data** — Open Firebase Console → Crashlytics → confirm sessions are appearing (not just "SDK initialized"). At least one session from a real device must show in the dashboard before marking this done.
- [ ] **Firebase Analytics events firing** — Enable DebugView on a physical device, walk through the core flows, and confirm every event listed in `MONITORING.md §3` appears in real time. Check: `screen_view`, `review_submitted`, `reservation_created`, `points_earned`, `plus_subscribed`, `referral_used`.
- [ ] **Cloud Functions error rate baseline** — Open Cloud Monitoring → confirm error rate < 0.5% across all functions for the first hour of live traffic.
- [ ] **Firebase Performance cold start** — Confirm cold start P50 < 2 000 ms in Performance dashboard after first 50 sessions.

---

## Security & Backend

- [ ] **App Check blocking unauthorized requests** — Check Cloud Functions logs for any requests marked as App Check failures from non-app clients. Confirm zero unauthorized requests reach production data in the first hour.
- [ ] **Firestore costs in first 24 h** — Open GCP Billing → confirm read/write counts are tracking within expected range (no runaway query detected). Cross-reference with Analytics DAU to sanity-check reads-per-user.
- [ ] **Firestore security rules correct** — Run Firestore Rules Playground against at least three scenarios: unauthenticated read (should fail), authenticated own-data read (should pass), authenticated other-user write (should fail).

---

## Payments & Integrations

- [ ] **First IAP transaction processed** — Confirm via RevenueCat dashboard that at least one `plus_subscribed` event shows a successful entitlement grant. Verify receipt validation completed without error.
- [ ] **Push notifications delivering** — Send a test notification via FCM console to a registered production token. Confirm delivery on both iOS and Android within 60 seconds.
- [ ] **Referral codes working end-to-end** — Create a referral code on a test account, use it on a second account sign-up, confirm `referral_used` event fires and points are credited to both accounts.
- [ ] **Deep links routing correctly (Branch.io)** — Test at minimum: venue detail deep link, referral deep link. Confirm correct screen opens on both iOS and Android from a cold start.
- [ ] **Gift card redemption (Tremendous)** — Execute one end-to-end redemption in production using a low-value test reward. Confirm Tremendous API returns success and the redemption is marked complete in Firestore. Verify the production API key (not sandbox) is active.
- [ ] **Receipt OCR working (Mindee)** — Submit one test receipt image via the production app. Confirm Mindee production key is active (not sandbox), extraction succeeds, and points are credited correctly.

---

## Store Health

- [ ] **App Store Connect policy flags** — Log in to App Store Connect → Activity → confirm no automated policy flags or rejection notices on the submitted version.
- [ ] **Play Console policy flags** — Play Console → Policy status → confirm no warnings or policy violations on the production release.
- [ ] **1-star reviews monitored** — Check App Store and Play Store public reviews within 6 h of rollout. If any 1-star review describes a functional bug (not a preference), route immediately to engineering for triage. A single confirmed P0 from a review is a rollback trigger.

---

## Rollout Activation

- [ ] **Play staged rollout set to 1%** — Play Console → Production → Manage release → confirm rollout percentage is 1%. Screenshot and log timestamp.
- [ ] **App Store phased release enabled (7-day)** — App Store Connect → Version → Phased Release → confirm "Phased release" is ON. The 7-day ramp is automatic from this point; confirm Day 1 percentage (~1–2%) is live.
- [ ] **Statuspage incident page live** — Confirm Statuspage URL is accessible, showing "All systems operational," and linked from app support page.
- [ ] **Rollback plan confirmed ready** — Confirm the on-call engineer has read `ROLLBACK_PROCEDURES.md` and knows how to halt the Play rollout and pause the App Store phased release without assistance.

---

## Sign-Off

| Role | Name | Date confirmed |
|---|---|---|
| Release engineer | | |
| Engineering lead | | |
| Founder / product owner | | |

All items above must be checked and this table signed off before advancing to Week 2 (10% rollout).

---

*Milestone: D9 | Owner: Release Engineer | Last updated: 2026-05-07*
