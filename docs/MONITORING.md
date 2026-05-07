# Zupurb — D8 On-Call Monitoring Runbook

**Last updated:** 2026-05-06
**Milestone:** D8 — Post-submission monitoring
**Firebase projects:** `zupurb-dev` | `zupurb-staging` | `zupurb-prod`

---

## 1. Alert Channels

| Source | Event | Delivery |
|--------|-------|----------|
| Firebase Crashlytics | Fatal crash (any) | Slack `#alerts-prod` via Cloud Function webhook |
| Firebase Crashlytics | ANR detected | Slack `#alerts-prod` via Cloud Function webhook |
| Firebase Crashlytics | Velocity alert (crash rate spike) | Slack `#alerts-prod` via Cloud Function webhook |
| Firebase Crashlytics | Daily stability digest | Slack `#digest-prod` via Cloud Function webhook |
| Firebase Performance | Slow network calls, slow app start | Manual review in Firebase Console — weekly |
| GitHub Actions CI | Build or test failure on `main` | GitHub email + Slack `#ci-failures` |

The Slack webhook Cloud Function (D8 backend deliverable) listens to Crashlytics Pub/Sub topic
`projects/zupurb-prod/topics/firebase-crashlytics-*` and posts formatted messages.
It is NOT yet deployed. Until it is, monitor Crashlytics dashboard directly.

`CrashlyticsService` is instrumented with:
- `FlutterError.onError` → fatal crash capture
- `recordError(e, stack, fatal: false)` → non-fatal breadcrumbs
- `setUser(uid)` / `clearUser()` → session identity (UID only, never PII)
- Collection disabled in debug builds via `kDebugMode` guard

---

## 2. Severity Levels

| Level | Trigger | Response Time | Owner |
|-------|---------|---------------|-------|
| P0 | Production down OR crash-free sessions < 95% (>5% crash rate) | 30 min | Page primary on-call immediately |
| P1 | New fatal crash type affecting >1% of sessions | 2 hours | Page primary on-call |
| P2 | ANR rate spike OR non-fatal error spike (>10% session increase) | Next business day | Notify primary via Slack |
| P3 | Stability digest item or minor regression | Weekly review | Review at weekly eng sync |

Crash-free session thresholds are measured in the Crashlytics dashboard under
**Trends > Crash-free users** for the `zupurb-prod` project.

---

## 3. On-Call Rota

Weekly rotation, Monday 09:00 UTC handoff.

| Week | Primary | Secondary |
|------|---------|-----------|
| TBD  | [Name]  | [Name]    |
| TBD  | [Name]  | [Name]    |

Primary: first responder for P0/P1. Secondary: backup if primary unreachable.
Engineering lead: final escalation for unresolved P0 beyond 1 hour.

Fill in names and rotate schedule before D8 goes live.

---

## 4. Escalation Path

```
Alert fires
  → Page primary on-call (Slack + phone)
      → No response in 15 min
          → Page secondary on-call
              → No response in 15 min
                  → Escalate to engineering lead
                      → If still unresolved after 1 hr: customer comms + Statuspage incident
```

For P0: open a Statuspage incident immediately, even before root cause is known.
For P1+: Statuspage optional; use judgment based on user-visible impact.

---

## 5. Key Dashboards and Links

| Resource | URL |
|----------|-----|
| Firebase Console — prod | https://console.firebase.google.com/project/zupurb-prod |
| Firebase Console — staging | https://console.firebase.google.com/project/zupurb-staging |
| Crashlytics dashboard — prod | https://console.firebase.google.com/project/zupurb-prod/crashlytics |
| Firebase Performance — prod | https://console.firebase.google.com/project/zupurb-prod/performance |
| GitHub Actions CI | https://github.com/[org]/zupurb/actions |
| Play Console | https://play.google.com/console |
| App Store Connect | https://appstoreconnect.apple.com |
| Statuspage | https://[placeholder].statuspage.io |

Replace `[org]` and Statuspage URL before D8 deployment.

---

## 6. Common Runbook Entries

### 6.1 Crash rate spike after release

1. Open Crashlytics dashboard → **Trends** → confirm crash-free session drop.
2. Filter by app version (the newly released build number).
3. Open the top crash issue → read stack trace → identify the faulting frame.
4. Check `CrashlyticsService.log` breadcrumbs in the crash detail for user journey context.
5. Check GitHub Actions CI for the release commit — confirm lint and tests passed.
6. **Rollback decision tree:**
   - If crash affects >2% of sessions AND root cause is not a one-line fix: halt rollout (see `ROLLBACK.md §1-2`).
   - If crash is in a feature behind a Remote Config flag: flip the kill switch first (see `ROLLBACK.md §3`), then investigate.
   - If crash is in a Cloud Function: redeploy previous function version (see `ROLLBACK.md §4`).

### 6.2 FCM push not delivering

**Android:**
- Confirm `POST_NOTIFICATIONS` is declared in `AndroidManifest.xml` (known gap: G3/G12 in `STORE_POLICY_CHECKLIST.md`).
- Check Firebase Console → Cloud Messaging → Delivery diagnostics for the affected device token.
- Verify the device has granted notification permission at runtime.
- Check Cloud Function logs for `sendMessage` / push dispatch errors.

**iOS:**
- Check APNs certificate expiry in App Store Connect → Certificates.
- Confirm `remote-notification` is listed in `UIBackgroundModes` in `Info.plist` (known gap: A15).
- Check Firebase Console → Cloud Messaging → APNs configuration for the `zupurb-prod` project.
- Test with `firebase messaging:send` CLI to isolate app vs APNs vs FCM.

### 6.3 Firestore quota exceeded

1. Firebase Console → `zupurb-prod` → Usage and billing → Quotas.
2. Identify which operation type is spiking (reads, writes, deletes).
3. Check Cloud Function logs for runaway queries — common causes: unbounded `getDocs()` without limit, missing index causing full collection scan.
4. If reads are spiking: check `getHomeFeed` / `getDiscoverFeed` functions — these are high-frequency and lack `enforceAppCheck` (known gap: SEC-16 in `SECURITY_AUDIT.md`).
5. Short-term mitigation: raise quota limit in Firebase Console (Blaze plan) or temporarily disable the offending Cloud Function.
6. File a P1 fix to add pagination limits and App Check enforcement.

---

## 7. D6 Monitoring Targets & Alert Setup

### 7.1 Firebase Crashlytics

**Target:** Crash-free users rate > 99.5% at all times.

| Alert | Threshold | Channel |
|---|---|---|
| Crash rate spike (velocity) | > 0.5% of sessions in any 1-hour window | Slack `#alerts-prod` + PagerDuty |
| New fatal issue type | Any new fatal issue detected | Slack `#alerts-prod` |
| Regression | Previously resolved issue re-opens | Slack `#alerts-prod` |
| ANR (Android) | ANR rate > 0.5% | Slack `#alerts-prod` |

Setup: Firebase Console → Crashlytics → Alerts tab → enable "Velocity alerts" with threshold 500 affected users or 0.5% of daily active users, whichever is lower.

### 7.2 Firebase Performance Monitoring

| Metric | Target | Alert threshold |
|---|---|---|
| App cold start (iOS + Android) | < 2 000 ms | > 2 500 ms |
| Network latency P95 | < 500 ms | > 750 ms |
| Firestore read P95 | < 300 ms | > 500 ms |

Custom traces to instrument (owned by backend/frontend pillars):

| Trace name | Trigger |
|---|---|
| `feed_load` | Home feed first render |
| `search_results` | Search results screen painted |
| `review_submit` | Review submission round-trip |
| `reservation_create` | Reservation confirmation received |
| `ocr_receipt_scan` | OCR request start → result received |

Setup: Firebase Console → Performance → Configure alerts → set per-metric thresholds above.

### 7.3 Firebase Analytics — Key Events

| Event name | Trigger |
|---|---|
| `screen_view` | Automatic (FlutterFire Analytics) |
| `review_submitted` | User completes review submission flow |
| `reservation_created` | Reservation confirmed by venue |
| `points_earned` | Points credited to user ledger |
| `plus_subscribed` | Zupurb Plus IAP purchase completed |
| `referral_used` | Referral code redeemed at sign-up |
| `deal_viewed` | Deals tab item tapped |
| `check_in_completed` | QR or OTP check-in confirmed |

Validate via DebugView on a test device before and after every release.

### 7.4 Cloud Functions — Error Rate Monitoring

**Target:** Error rate < 1% on any individual function.

GCP Console → Monitoring → Alerting → Create Policy:
- Metric: `cloudfunctions.googleapis.com/function/execution_count`, filtered `status != "ok"`.
- Condition: ratio (errors / total) > 0.01 over a 5-minute rolling window.
- Notification: PagerDuty + on-call email.
- Label policy: `zupurb-functions-error-rate`.

High-risk functions requiring individual monitoring: `processReview`, `creditPoints`, `validateOcr`, `createReservation`, `verifyIap`.

### 7.5 Firestore Cost Monitoring

| Tier | Monthly spend | Action |
|---|---|---|
| Warning | $80 | Email to engineering lead |
| Critical | $100 | Email + PagerDuty page |

Setup: GCP Console → Billing → Budgets & Alerts → Create Budget → scope to `zupurb-production`, services: Firestore → set $80 (80%) and $100 (100%) thresholds.

Note: Firebase does not enforce a hard spending cap. If runaway reads are detected, short-term mitigation is to disable the offending function (see §6.3) or temporarily tighten Firestore security rules.

### 7.6 Uptime

Firebase-managed infrastructure (Firestore, Cloud Functions, Auth, Storage) does not require a separate uptime URL check. Monitor at https://status.firebase.google.com.

App Check enforced in production acts as the primary DDoS mitigation layer — unauthorized clients are blocked before reaching quota. Confirm App Check enforcement is active on all production resources before D7 submission (see POST_LAUNCH_CHECKLIST.md).
