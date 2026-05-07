# Zupurb — Beta Testing Plan (T10)

**Status:** Draft — awaiting first beta build  
**Last updated:** 2026-05-07  
**Crash reporting:** Firebase Crashlytics (integrated in all beta builds)  
**Feedback form:** https://forms.gle/PLACEHOLDER — replace with live Google Form URL before Phase 1 launch

---

## 1. Beta Phases

### Phase 1 — Internal QA (5–10 testers)

| Attribute        | Value |
|------------------|-------|
| Distribution     | Firebase App Distribution |
| Platform         | Android (APK) + iOS (via Firebase App Distribution invite) |
| Tester group     | `internal-qa` (Firebase console group) |
| Build trigger    | Push to `beta` branch OR manual `workflow_dispatch` |
| Duration         | Continuous — runs throughout active development |
| Goal             | Catch crashes, broken flows, and build-stability issues before external testers see them |
| Entry criteria   | `flutter test` passes; no P0 open bugs from previous build |
| Exit criteria    | All golden-path test scenarios pass; no P0/P1 open bugs; Crashlytics crash-free sessions ≥ 95% |

**Tester roster (internal):**
- Engineering lead
- QA tester (this agent's operator)
- Product owner / Alan
- Designer (UI sign-off)
- Backend engineer

---

### Phase 2 — Closed Beta (50–100 testers)

| Attribute        | Value |
|------------------|-------|
| Distribution     | iOS: TestFlight (external testing group) / Android: Play Internal Testing track |
| Tester group     | Invited via TestFlight public link (closed) + Play Console email invite |
| Duration         | 2–3 weeks |
| Goal             | Real-device coverage across OS versions and screen sizes; surface UX issues outside the core team |
| Entry criteria   | Phase 1 exit criteria met; T9 store policy checklist partially complete (Apple + Google must not block beta); demo account ready |
| Exit criteria    | Crash-free sessions ≥ 98%; all P0/P1 bugs resolved; feedback themes documented and triaged |

**iOS TestFlight configuration:**
- Internal group: team Apple IDs (no review required)
- External group: up to 10,000 testers; requires Apple beta review (typically 1 business day)
- TestFlight link: https://testflight.apple.com/join/PLACEHOLDER

**Android Play Internal Testing configuration:**
- Track: `internal` (invited testers only, up to 100 users)
- Invite via Play Console > Internal Testing > Testers tab

---

### Phase 3 — Open Beta (500+ testers)

| Attribute        | Value |
|------------------|-------|
| Distribution     | iOS: TestFlight public link / Android: Play Open Testing track |
| Tester pool      | Unlimited (TestFlight cap: 10,000); Play Open Testing: public opt-in |
| Duration         | 1–2 weeks before production submission |
| Goal             | Scale stress, geo-diversity, edge-case device coverage, final UX validation |
| Entry criteria   | Phase 2 exit criteria met; T9 checklist fully green; staged rollout plan in place |
| Exit criteria    | Crash-free sessions ≥ 99%; ANR rate < 0.47% (Play threshold); no new P0/P1 filed in final 48 hours |

**iOS TestFlight public link:** https://testflight.apple.com/join/PLACEHOLDER  
**Android Play Open Testing opt-in URL:** https://play.google.com/store/apps/details?id=com.zupurb.app — replace when open testing track is published

---

## 2. Test Scenarios

All testers are asked to execute the scenarios below on first install and after each update. Scenarios are ordered by risk.

### 2.1 Onboarding

| # | Scenario | Expected result |
|---|----------|-----------------|
| ON-1 | Cold launch on fresh install | Splash shows, transitions to Sign Up |
| ON-2 | Sign up with Google | Account created; 8-step onboarding starts |
| ON-3 | Sign up with Apple | Account created; Apple credentials stored |
| ON-4 | Sign up with email + password | OTP email received; OTP entry accepted |
| ON-5 | Complete all 8 onboarding steps | Profile Complete screen shown; home feed loads |
| ON-6 | Skip optional onboarding steps | App does not crash; defaults applied |
| ON-7 | Log out then log back in | Onboarding not re-shown; home feed loads |
| ON-8 | Forgot password flow | Reset email received; new password accepted |
| ON-9 | Age gate shown for alcohol venue content | Under-21 blocked from that content |

### 2.2 Search & Discovery

| # | Scenario | Expected result |
|---|----------|-----------------|
| SE-1 | Search for a restaurant by name | Relevant results appear |
| SE-2 | Apply category filter | Only matching venues returned |
| SE-3 | Search near current location (location permission granted) | Geo results sorted by distance |
| SE-4 | Deny location permission | Graceful fallback; no crash |
| SE-5 | Open venue detail page | All sections load; no blank cards |
| SE-6 | Discover rails load on home feed | No infinite spinner |

### 2.3 Reviews

| # | Scenario | Expected result |
|---|----------|-----------------|
| RV-1 | Submit a review without receipt (Unverified) | Review saved; 25 pts awarded |
| RV-2 | Submit a review with receipt photo (OCR verify) | Verify Visit flow completes; correct points awarded |
| RV-3 | Submit a review with Creator Disclosure toggled | Disclosure recorded; review flagged correctly |
| RV-4 | Rate each sub-category | Scores save and display correctly |
| RV-5 | Written review under and over character minimum | Validation messages shown appropriately |
| RV-6 | Duplicate review submission attempt | App blocks; shows existing review |
| RV-7 | Review Submission Confirmation screen | Points balance updates within 5 seconds |

### 2.4 Reservations

| # | Scenario | Expected result |
|---|----------|-----------------|
| RS-1 | Book a time slot (Instant Confirm) | Booking confirmed immediately; confirmation screen shown |
| RS-2 | Cancel reservation more than 48 hours before | Cancellation accepted; no penalty |
| RS-3 | Attempt to cancel within 48 hours | Cancel blocked; no-show penalty warning shown |
| RS-4 | Check in via QR code | QR scanned; check-in confirmed |
| RS-5 | Check in via OTP | OTP entered; check-in confirmed |
| RS-6 | View My Reservations | All upcoming and past bookings listed |
| RS-7 | Plus exclusive reservation booking | Plus badge required; non-Plus users see upgrade prompt |

### 2.5 Points & Rewards

| # | Scenario | Expected result |
|---|----------|-----------------|
| PT-1 | View Points Wallet | Balance, history, and expiry warnings shown |
| PT-2 | Redeem points for gift card | Redemption flow completes; balance deducted |
| PT-3 | Redeem points for deal | Deal unlocked; QR code shown with 2-hour TTL |
| PT-4 | Points expiry warning | Banner appears when points near expiry |
| PT-5 | Referral flow (invite a friend) | Referral code shared; attribution tracked |

### 2.6 Plus Subscription

| # | Scenario | Expected result |
|---|----------|-----------------|
| PL-1 | Tap Plus upsell prompt | Paywall shown |
| PL-2 | Subscribe via sandbox IAP (iOS) | Subscription activated in sandbox; Plus badge appears |
| PL-3 | Subscribe via sandbox IAP (Android) | Subscription activated in sandbox; Plus badge appears |
| PL-4 | Restore purchases | Subscription state restored on reinstall |
| PL-5 | Cancel subscription (sandbox) | Entitlement removed at period end |

### 2.7 Chat & Social

| # | Scenario | Expected result |
|---|----------|-----------------|
| CH-1 | Send message to a mutual follow | Message delivered; appears in Conversation list |
| CH-2 | Receive message | Push notification delivered; message shown |
| CH-3 | Business sends first message to user | Allowed (business 1-message rule); thread opens |
| CH-4 | Non-mutual follow attempts to message | Blocked with appropriate error |
| CH-5 | Block a user | User removed from feed and messages |
| CH-6 | Report content | Report submitted; confirmation shown |

### 2.8 Badges & Challenges

| # | Scenario | Expected result |
|---|----------|-----------------|
| BD-1 | View Badges & Challenges screen | Badge progress shown correctly |
| BD-2 | Complete a challenge | Badge awarded; points credited |
| BD-3 | Founder badge cap (150 users) | 151st user does not receive Founder badge |

### 2.9 Settings & Account

| # | Scenario | Expected result |
|---|----------|-----------------|
| ST-1 | Open Privacy Settings | All toggles functional |
| ST-2 | Delete account from within app | Deletion confirmation → account removed; data export offered |
| ST-3 | Push notification permission prompt | Rationale shown before OS prompt |
| ST-4 | Notifications screen | All notification types list correctly |

---

## 3. Feedback Collection

**Primary method:** Google Form — https://forms.gle/PLACEHOLDER  
Replace placeholder with a live form containing:
- Tester name / email (optional)
- Device model + OS version
- App version (from Settings screen)
- Bug or feedback category (crash / UX / wrong data / other)
- Steps to reproduce
- Screenshot / screen recording upload field
- Severity self-assessment (blocker / significant / minor)

**Crash reports:** Captured automatically by Firebase Crashlytics. No manual step required from testers. Team monitors Crashlytics dashboard daily during beta phases.

**In-app feedback shortcut:** Shake gesture (if implemented in beta builds) opens the feedback form URL in the default browser.

---

## 4. Crash Reporting — Firebase Crashlytics

Crashlytics is integrated in all beta builds with the following configuration:

- Crash-free sessions rate monitored daily in Firebase Console
- Critical crash types trigger an email alert to the team (configure via Firebase Alerts)
- Each crash report includes: device model, OS version, app version, Flutter engine version, stack trace
- Non-fatal errors are also captured for network timeouts and auth failures
- Custom keys logged per session: `user_tier` (free/plus), `has_completed_onboarding`, `platform_version`

**Crashlytics alert threshold:** Email alert fires when crash-free sessions drop below 99% in any 24-hour window.

---

## 5. Bug Triage Process

### Severity Definitions

| Severity | Definition | Target resolution |
|----------|------------|-------------------|
| P0 | App crash on golden path, data loss, auth bypass, payment error | Fix before next build; hot-patch if in Phase 3 |
| P1 | Feature broken but workaround exists; significant UX blocker | Fix within 2 builds |
| P2 | Minor UX issue, copy error, non-blocking visual glitch | Fix before production submission |

### Triage Workflow

1. Tester reports bug via feedback form OR Crashlytics auto-captures crash.
2. QA agent reviews within 24 hours. Assigns severity (P0/P1/P2) and pillar (Frontend / Backend / Integrations).
3. Bug is logged in `C:\Projects\Zupurb\docs\FIX_LIST.md` using the standard format:
   ```
   ID: BUG-NNN
   Title: <short>
   Severity: P0 / P1 / P2
   Pillar: Frontend / Backend / Integrations / Deployment
   Environment: dev / staging / prod, OS, device, app version
   Steps:
   1.
   2.
   Expected:
   Actual:
   Repro rate:
   Workaround:
   Logs/screenshot:
   ```
4. P0 bugs block the next distribution build until resolved.
5. P1/P2 bugs are batched into the next sprint fix cycle.
6. QA agent re-tests fix on the build that includes it. Only then marks bug closed in FIX_LIST.md.

### Build Gate Rules

| Phase | Gate condition |
|-------|---------------|
| Phase 1 → Phase 2 | Zero open P0s; ≤ 3 open P1s; crash-free ≥ 95% |
| Phase 2 → Phase 3 | Zero open P0s; zero open P1s; crash-free ≥ 98% |
| Phase 3 → Production | Zero open P0s; zero open P1s; crash-free ≥ 99%; ANR < 0.47%; T9 checklist fully green |

---

## 6. Out-of-Scope for Beta

- Production payment processing — all IAP testing uses Apple Sandbox and Google Play Test accounts only
- Production gift card redemption — sandbox/test mode only
- Admin moderation dashboard (internal tool, separate testing track)
- Localization (English only at launch; framework test is T11)
