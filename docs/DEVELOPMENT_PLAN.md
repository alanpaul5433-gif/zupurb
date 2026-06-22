# Zupurb User App — Master Development Plan

**Status:** Planning complete. Awaiting approval to begin Phase 1A.
**Stack assumption:** Flutter (mobile) + Firebase (backend). Confirm before kickoff.
**Model:** Sonnet 4.6, Medium mode. Token-efficient execution required.

---

## 1. The Five Pillars

The build is organized into five pillars. Each pillar has a dedicated subagent (see `AGENTS.md`). Pillars run in parallel where dependencies allow.

| Pillar | Owner Agent | Scope |
|---|---|---|
| **Frontend** | `frontend-dev` | Screens, widgets, state, navigation, design tokens |
| **Backend** | `backend-dev` | Firestore schemas, Cloud Functions, scoring/UAR/fingerprint algorithms, ledgers |
| **Integrations** | `integrations-dev` | OCR, AI summary, image moderation, gift cards, maps, IAP, push, chat, deep links |
| **Testing** | `qa-tester` | Unit, integration, E2E, store-policy compliance, accessibility, performance |
| **Deployment** | `release-engineer` | CI/CD, signing, beta channels, store metadata, submissions, monitoring |

---

## 2. Frontend — Two-Phase Sequencing

### Phase 1A — Build-to-Mockup *(starts first; blocking)*

**Goal:** Implement every screen in `Zupurb User App/UI/` exactly as designed. Faithful translation only.

**Rule:** Do **not** apply any of the fixes from `FIX_LIST.md` during Phase 1A. Typos, scoring scale mismatches, duplicate onboarding screens, missing tabs, off-spec point costs — all preserved verbatim. Reason: visual sign-off before logic correction.

**Screens in scope (from `Zupurb User App/UI/`):**

| Group | Screens |
|---|---|
| Splash & Auth | Splash, Sign Up, Login, Forgot Password, Email-Sent modal, OTP entry |
| Onboarding (8 steps) | Welcome, Basics, Incentive Hook, Identity, Food & Drink, Activity (×2 duplicate), Sports, Profile Complete |
| Home | Feed (All / Reviews / Feed / Creator / Deals tabs), Deals tab variant |
| Search | Search landing + filters, Search results |
| Discover | Discover list with rails |
| Establishment | Detail page (compose from Reservation + Add-a-Place sources) |
| Add a Place | Venue creation form |
| Review Flow | Verify Visit, Rate Experience, Creator Disclosure, Written Review, Submission Confirmation |
| Reservations | Time-slot picker, Confirm Booking, My Reservations, Check-In (QR + OTP), Plus, Exclusive Benefits |
| Messages | Conversation list, 1:1 chat |
| Profile | Own profile, Other/Creator profile, Notifications |
| Badges & Rewards | Badges & Challenges, Points Wallet, Redeem Rewards |
| Settings | Settings, Privacy Settings |

**Definition of Done for 1A:**
- Every screen pixel-comparable to the mockup at iPhone 16 Pro size.
- Navigation between screens works.
- All chips, toggles, and inputs are interactive (state held locally; no backend yet).
- Hard-coded mock data populates lists.
- Approved by user with explicit sign-off message.

**🛑 APPROVAL GATE — DO NOT PROCEED PAST THIS POINT WITHOUT USER CONFIRMATION 🛑**

### Phase 1B — Fix List Application *(starts only after Phase 1A is approved)*

**Goal:** Apply the audit fixes from `FIX_LIST.md` in priority order: P0 → P1 → P2.

**Rule:** When Phase 1A is signed off, the `frontend-dev` agent must explicitly ask the user: *"Phase 1A is complete. Do you approve starting Phase 1B (UI Fix List application)?"* Wait for "yes / approved / go." Only then proceed.

**Sub-phases:**
- **1B-P0** — Critical fixes (review questionnaire restructure, score scale unification, missing onboarding screens, phone verification, verification tier copy, point-cost corrections).
- **1B-P1** — Significant fixes (search tabs, messaging tabs, badge naming, Founder cap, etc.).
- **1B-P2** — Polish (typos, copy cleanup, duplicate elements).

---

## 3. Backend — Milestones

Backend can begin in parallel with Frontend Phase 1A (it has no dependency on UI being final).

| Milestone | What ships | Depends on |
|---|---|---|
| **B1 — Foundation** | Firebase projects (dev/staging/prod), Firestore rules skeleton, Auth providers wired, Cloud Functions scaffolding, Remote Config, App Check | Phase 0 decisions |
| **B2 — Identity & Profile** | User schema, demographic fingerprint generator, profile CRUD, account-deletion + data-export jobs | B1 |
| **B3 — UAR & Anti-Fraud Foundations** | UAR engine, similarity scorer, sandbox trigger, weekly review caps, silent quarantine | B2 |
| **B4 — Establishments** | Venue schema, search indexing pipeline (Algolia), claiming workflow, geo queries | B1 |
| **B5 — Review Engine** ⭐ | Review schema, score calculation, weight matrix, time decay, dual-score (Overall + From People Like You), Q8 contradiction detector, AI summary call orchestration | B3, B4 |
| **B6 — Points Ledger** | Append-only ledger, earn engine, expiry engine, multiplier engine, eligibility gate | B2 |
| **B7 — Badges & Challenges** | Progression engine, challenge cron, Founder cap enforcement | B6 |
| **B8 — Reservations** | Slot availability, booking creation, QR + OTP generation, no-show tracking | B4 |
| **B9 — Deals** | Deal schema, matching engine, redemption flow with QR + 2hr TTL, anti-abuse throttle | B6 |
| **B10 — Social** | Follow graph, feed ranking, notification fanout, messaging gates (mutual-follow, business 1-msg) | B2 |
| **B11 — Plus & IAP Validation** | Subscription state, entitlement checks, Plus benefit gating | B6 |
| **B12 — Admin Hooks** | Suspend/sandbox/ban states, moderation queue API, Founder badge admin endpoint | All above |
| **B13 — Referral System** | Per §11.2 spec: referral code generation, attribution tracking, trigger on referee's first verified review, 500 pts referrer + 250 pts referee, 10/rolling-30day cap, self-referral blocking via phone/device/email heuristics, referral dashboard in profile. **Unblocked.** | B2, B6 |
| **B14 — Loyalty Tiers** | Tier engine per §11.1 spec: 4 tiers (Bronze/Silver/Gold/Platinum) on rolling 12-month points, quarter-end downgrade, 12-month inactivity reset. Tier-specific perks (birthday/anniversary bonuses, prize draw entries, deal cap increase, gift card discount, priority support, profile frames). Tier-up/down notifications. UI surfaces in Points Wallet + Profile. **Unblocked.** | B6 |

---

## 4. Integrations — Milestones

Integrations are wired pillar-by-pillar as the Backend milestones become consumers.

| Milestone | Integrations |
|---|---|
| **I1 — Auth & Comms** | Firebase Auth providers (Google, Apple, Facebook), Phone Auth (SMS OTP), SendGrid (transactional email) |
| **I2 — Storage & Media** | Firebase Storage, image compression, Mux/Cloudflare Stream for video, AWS Rekognition for image moderation |
| **I3 — Maps & Search** | Google Maps SDK, Google Places API, Algolia (multi-index search) |
| **I4 — Receipt OCR** ⭐ | Vendor evaluation (Document AI / Textract / Mindee / Veryfi), 50-receipt accuracy harness, integration into review flow |
| **I5 — AI Services** | Anthropic Claude (Haiku) for review summaries, Perspective API for toxicity, OpenAI/Claude Vision for photo validation |
| **I6 — IAP & Subscriptions** | RevenueCat (cross-platform receipt validation, paywall builder, Plus subscription) |
| **I7 — Gift Cards** | Tango Card / Tremendous (KYC + contract takes 2–4 weeks; start early) |
| **I8 — Push & Notifications** | FCM, OneSignal (if smart timing required) |
| **I9 — Chat** | Stream Chat (build-vs-buy decision needed; default = Stream) |
| **I10 — Deep Linking** | Branch.io or AppsFlyer OneLink (Firebase Dynamic Links is deprecated) |
| **I11 — Anti-Fraud** | FingerprintJS Pro (device fingerprinting), reCAPTCHA Enterprise, Firebase App Check |
| **I12 — Analytics** | Firebase Analytics, Mixpanel/Amplitude, PostHog (session replay, optional) |

---

## 5. Testing — Milestones

Testing runs continuously. Some checks are gated to specific milestones.

| Milestone | Coverage |
|---|---|
| **T1 — Unit Tests** | Score calculator, UAR adjustments, fingerprint similarity, points engine, expiry math, weight matrix, Q8 contradiction logic |
| **T2 — Widget Tests** | Critical components: review card, score badge, time-slot grid, OTP input, demographic chip group |
| **T3 — Integration Tests** | Review submission end-to-end, reservation booking + check-in, deal redemption, points expiry warnings |
| **T4 — E2E (Patrol/Maestro)** | Sign-up → onboarding → first review → first reservation → first redemption (golden path) |
| **T5 — Visual Regression** | Applitools or Percy on all screens; runs on every PR |
| **T6 — Accessibility** | TalkBack/VoiceOver pass, dynamic type, contrast, semantic labels, touch targets ≥44pt |
| **T7 — Performance** | Cold start <2s, list scroll 60fps, image-heavy screens, memory profiling |
| **T8 — Security** | MobSF scan, IDOR checks, file upload validation, gift card eligibility cannot be bypassed client-side, App Check enforcement |
| **T9 — Store Policy Compliance** ⭐ | See section 5.1 |
| **T10 — Beta Testing** | TestFlight (iOS) + Play Internal Testing (Android), structured bug capture |
| **T11 — Localization Smoke** | English-only at launch; verify framework is in place for future languages |

### 5.1 Store Policy Compliance Checklist

This is treated as a first-class testing milestone because store rejections are the most common launch delay.

#### Apple App Store
- [ ] App Store Review Guidelines compliance (latest version on day of submission)
- [ ] Privacy nutrition labels accurate vs actual data collection
- [ ] App Tracking Transparency (ATT) prompt before any tracking SDK fires
- [ ] Sign in with Apple offered when other social logins exist (mandatory)
- [ ] In-app purchases (points, Plus) use StoreKit, not external payment
- [ ] No mention of payment outside the app inside the app
- [ ] Content moderation visible to user (block, report, hide)
- [ ] User-generated content has EULA agreement
- [ ] User can delete their account from inside the app (per Apple §5.1.1(v))
- [ ] Push notification permission rationale shown
- [ ] Camera/photo/location permission strings in Info.plist are user-friendly
- [ ] Demo account credentials provided to App Review
- [ ] App icon, screenshots, preview video meet spec
- [ ] No private API usage (caught by static analysis)
- [ ] Background modes only used for declared purposes
- [ ] iPad support or "iPhone only" declared cleanly

#### Google Play Store
- [ ] Play Console Data Safety form accurate
- [ ] Target API level meets Play's current requirement
- [ ] Permissions declared match actual usage
- [ ] Sensitive permissions justified in Play Console (location, camera)
- [ ] No restricted permission misuse (SMS, Call Log)
- [ ] Account deletion accessible inside app AND via web (Play policy)
- [ ] Content rating questionnaire completed honestly
- [ ] Family Policy compliance if appealing to under-18s
- [ ] Background location justified and minimized
- [ ] Foreground service types declared (Android 14+)
- [ ] Photo & Video permissions use Android 13+ granular model
- [ ] Notification permission requested at runtime (Android 13+)
- [ ] App Bundle (AAB) format, signed with Play App Signing
- [ ] No deceptive behaviour, ads in notifications, or system-impersonating UI
- [ ] In-app purchases use Google Play Billing
- [ ] Pre-launch report (automated) passes without crashes

#### Cross-cutting
- [ ] Privacy Policy URL live and reachable
- [ ] Terms of Service URL live and reachable
- [ ] Support contact email monitored
- [ ] CCPA "Do Not Sell My Personal Information" available (California focus per SOW)
- [ ] Age gate (alcohol-related content per SOW = bars/nightclubs)

---

## 6. Deployment — Milestones

| Milestone | Deliverables |
|---|---|
| **D1 — CI Setup** | GitHub Actions or Codemagic. Lint + format + test on every PR. Build matrix: iOS + Android, dev + staging + prod flavors |
| **D2 — Signing & Provisioning** | Fastlane match (iOS), Play App Signing (Android), key rotation policy |
| **D3 — Internal Distribution** | Firebase App Distribution for nightly builds to internal team |
| **D4 — Beta Channels** | TestFlight external testing setup, Play Closed Testing track |
| **D5 — Staging Backend** | Mirror of prod Firebase project with seeded test data |
| **D6 — Production Readiness Audit** | Run T9 store policy checklist; fix every blocker |
| **D7 — Submission** | Fastlane deliver (iOS) + Play submission (Android) |
| **D8 — Post-Submission** | Crashlytics + Sentry alerting, Statuspage live, on-call rota documented, rollback plan |
| **D9 — Release Management** | Semantic versioning, release notes generation, staged rollout (Play 5%→20%→50%→100%), iOS phased release |

---

## 7. Cross-Pillar Sequencing (Suggested Calendar)

```
Week 0–2   Phase 0 (decisions, infra, design system)
Week 2–6   Frontend Phase 1A   ║ Backend B1, B2
Week 6     [APPROVAL GATE]      ║ Integrations I1, I2 wiring
Week 6–10  Frontend Phase 1B    ║ Backend B3, B4, B5  ║ Integrations I3, I4, I5
Week 10–14 — joins on the build  ║ Backend B6, B7, B8  ║ Integrations I6, I7
Week 14–18 — feature work cont.  ║ Backend B9–B12      ║ Integrations I8–I12
Week 18–22 Hardening              ║ Testing T1–T8 sustained
Week 22–24 Beta + T9 + T10       ║ Deployment D1–D6
Week 24–26 Submission + D7–D9
```

Total estimate: ~6 months for User App alone with a small focused team.

---

## 8. Decision Log (To Be Filled)

| Date | Decision | Owner | Rationale |
|---|---|---|---|
| 2026-05-05 | **Stack confirmed: Flutter + Firebase** | Client (Alan) | Existing Flutter SDK + Firebase CLI on dev machine; SOW maps cleanly to Firestore + Cloud Functions |
| 2026-05-05 | **Chat: In-house on Firestore** | Client (Alan) | Vendor lock-in avoidance; data sovereignty; accepts ~6–10 wks build cost |
| 2026-05-07 | **ADR-002 upheld** — Stream Chat rejected, in-house Firestore chat confirmed. Flutter service + providers wired to `social_sendMessage`, `social_getConversations`, `createConversation`, `markConversationRead` callables. | integrations-dev | Flutter wrappers at `lib/core/services/chat_service.dart` + `lib/core/providers/chat_providers.dart`. |
| 2026-05-05 | **Loyalty tiers: INCLUDED at launch — spec approved** | Client (Alan) | 4 tiers (Bronze/Silver/Gold/Platinum), rolling 12-month points, quarter-end downgrade. Full spec in §11.1. B14 unblocked |
| 2026-05-05 | **Reservation flow: Instant-confirm** | Client (Alan) | Matches SOW §11; remove "Requested" status from UI in Phase 1B |
| 2026-05-05 | **Cancellation policy: hard cutoff 48 hours before reservation** | Client (Alan) | No financial penalty; cancel allowed >48hrs out, blocked within 48hrs (counts as no-show per SOW §11.2 if user fails to attend) |
| 2026-05-05 | **Gift card flow: per SOW §14.4** | Client (Alan) | Vendor TBD (Tremendous recommended); start KYC early |
| 2026-05-05 | **Founder Badge cap: 150** | Client (Alan) | Matches SOW §13.1; preserves scarcity. Fix UI copy in Phase 1B (P1-7) |
| 2026-05-05 | **Partially Verified points: 25 flat** | Client (Alan) | Resolves SOW §7.1 vs §12.1 conflict in favor of §12.1; 75% score weight remains the real incentive |
| 2026-05-05 | **Referral system: INCLUDED — spec approved** | Client (Alan) | 500 referrer / 250 referee pts on referee's first verified review; 10 per rolling 30 days; self-referral blocked. Full spec in §11.2. B13 unblocked. SOW addendum still pending from client |
| 2026-05-05 | **OCR harness: APPROVED at $60 (4-vendor incl. Veryfi)** | Client (Alan) | "Do what's best for the app" — full evaluation across Document AI, Textract, Mindee, Veryfi |
| 2026-05-05 | **Gift card vendor: Tremendous** | Client (Alan) | Modern API, no min spend, broader reward catalog. Start KYC immediately |
| 2026-05-05 | **I4 OCR harness scaffolded** | integrations-dev | 4-vendor harness (Document AI, Textract, Mindee, Veryfi) under `functions/src/integrations/ocr/`. Two callables: `runOCRHarness` (admin, batch eval) and `extractReceiptData` (production, single vendor). RC: `ocr_selected_vendor` defaults to `textract`. Veryfi adapter uses REST directly (no npm SDK needed). Run harness with real images to pick winner before enabling in verify-visit flow. |
| 2026-05-05 | **I8 Tremendous gift card integration complete** | integrations-dev | Wrapper at `functions/src/integrations/tremendous/` (client, types, fulfillment, webhookHandler). Stub in `redeemDeal.ts` replaced with real `fulfillGiftCardRedemption` call. Env vars: `TREMENDOUS_API_KEY`, `TREMENDOUS_FUNDING_SOURCE_ID`, `TREMENDOUS_WEBHOOK_SECRET`, `TREMENDOUS_SANDBOX`. Idempotency via `externalId=redemptionId`. Failed orders auto-refund points via `earn_deal_cashback`. Webhook verified via HMAC-SHA256. Product IDs: replace `TREMENDOUS_*_ID` placeholders after Tremendous dashboard setup. RC: `tremendous_product_map` for runtime product ID overrides. |
| 2026-05-06 | **I1 Auth & Comms complete** | integrations-dev | `lib/core/services/auth_service.dart` extended with `signInWithGoogle()`, `signInWithApple()`, `signInWithFacebook()`, `signInWithPhone()`, `verifyOTP()`. Legacy aliases (`verifyPhoneNumber`, `signInWithPhoneCredential`) kept for backward compat. New pubspec deps: `google_sign_in ^6.2.2`, `flutter_facebook_auth ^7.1.1` (Apple was already present). SendGrid wrapper at `functions/src/lib/email.ts` with `sendTransactionalEmail` + 4 typed helpers (welcome, otpFallback, reviewConfirmation, reservationConfirmation). `@sendgrid/mail ^8.1.3` added to functions/package.json. Env vars needed: `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`. Template IDs in `TEMPLATE_IDS` map are placeholders — replace with real SendGrid Dynamic Template IDs. Platform setup notes in auth_service.dart header (SHA fingerprints, Apple capability, Facebook manifest entries). |
| 2026-06-09 | **I5 Gemini free-tier AI summary provider added (client request)** | Client (Alan) | Google Gemini free API added as the **default** review-summary provider with **Claude Haiku as automatic fallback**. New: `functions/src/integrations/ai/geminiSummary.ts` (REST, no SDK — mirrors Veryfi pattern; model `gemini-2.0-flash`) + `summaryProvider.ts` (selector + fallback). `reviews/aiSummary.ts` `generateReviewSummary()` now calls the selector instead of Claude directly; its output populates `establishments/{estId}.aiSummary`, which the **owner portal** dashboard (`getOwnerAnalytics`) reads — so both review summaries and owner AI insights share one provider. **Env vars:** `GEMINI_API_KEY` (free key from aistudio.google.com/apikey), optional `GEMINI_MODEL` (default `gemini-2.0-flash`), `AI_SUMMARY_PROVIDER` (`gemini`\|`claude`, default `gemini`), `AI_SUMMARY_FALLBACK` (`1`\|`0`, default `1`). Photo validation (`photoValidation.ts`) intentionally left on its current provider. Free tier is rate-limited (~15 req/min) — fallback covers 429s. `tsc` clean. |

---

## 9. Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| OCR accuracy below threshold | High | Run 50-receipt vendor harness in Phase 0; have fallback to Partially Verified |
| SOW contradictions cause rework | High | Resolve all in `RULES.md` decision log before any milestone starts |
| California ABC compliance miss | High | Legal review of all deal copy before deals go live |
| Store rejection on submission | Medium | Run T9 checklist twice; demo account ready |
| Cold-start review density too low for "From People Like You" | Medium | Soft-launch seeding strategy; surface "Need more reviews" state gracefully |
| Anti-fraud arms race post-launch | Medium | Plan for ongoing tuning; do not treat Phase 12 as one-and-done |
| Vendor lock-in on RevenueCat / Algolia / Stream | Low | Document migration paths in vendor selection doc |

---

## 11. Open Specs Needed From Client

These are scoped-in features that require additional specification before development can begin.

### 11.1 Loyalty Tiers — APPROVED SPEC

**Status:** Drafted 2026-05-05. **Approved by Alan 2026-05-05.** B14 is unblocked.

#### Tier list — 4 tiers

| Tier | Position |
|---|---|
| Bronze | Entry — every new account starts here |
| Silver | Engaged user |
| Gold | Active reviewer |
| Platinum | Power user (~top 5%) |

#### Threshold metric

**Rolling 12-month points earned.** Picked over lifetime because lifetime locks everyone into the top tier eventually; picked over activity-score for simplicity and communicability. Aligns naturally with the existing 12-month points-expiry window.

#### Thresholds

| Tier | 12-month points required |
|---|---|
| Bronze | 0–999 |
| Silver | 1,000 |
| Gold | 5,000 |
| Platinum | 15,000 |

Calibration logic:
- Casual user (~1 review/mo + occasional reservation) ≈ 1,800 pts/yr → Silver
- Active reviewer (~4 verified reviews/mo) ≈ 3,840 pts/yr → Silver/lower-Gold
- Power reviewer (~8/mo with 1.2× multiplier + reservations) ≈ 7,200+ pts/yr → Gold
- Top-tier engagement (Plus + heavy reviewing + reservations + deals) ≈ 15,000+ pts/yr → Platinum

#### Perks per tier

Designed to **not duplicate Plus benefits** (which already gives 1.25× multiplier, unlimited deals, ad-free, profile viewer, priority reservations) and **not duplicate badges** (which signal credibility). Tier perks focus on bonus points triggers, exclusive access, and status visibility.

| Perk | Bronze | Silver | Gold | Platinum |
|---|---|---|---|---|
| Birthday bonus | — | 100 pts | 200 pts | 500 pts |
| Account anniversary bonus | — | — | 250 pts | 750 pts |
| Free-tier deal redemption cap (free user baseline = 3/mo) | 3/mo | 4/mo | 5/mo | 7/mo |
| Monthly prize draw entries (auto) | — | — | 1 | 3 |
| Exclusive tier-only seasonal challenges | — | — | ✅ | ✅ |
| Early access to new venue launches | — | — | — | 24 hrs before public |
| Gift card threshold discount | — | — | — | 5% off (e.g., $10 Starbucks at 3,325 pts instead of 3,500) |
| Priority support response | Standard | Standard | <24 hrs | <4 hrs |
| Tier badge frame on profile | — | Silver frame | Gold frame | Platinum frame + sparkle |

Note: Plus subscribers retain all Plus benefits regardless of tier. Tiers stack on top of Plus.

#### Downgrade rule

**Quarter-end review.** Tier is recalculated every 3 months based on the rolling 12-month points window. A user who drops below their tier's threshold receives a 30-day notification with their current pts vs threshold; if still below at quarter-end, downgrade by one tier. Cannot drop more than one tier per quarter (cushion against streaks of low activity).

#### Inactivity expiry

**Yes — 12 months of zero point-earning activity drops user to Bronze immediately.** Aligned with the 12-month points-expiry window. User receives 60-day and 7-day warnings (reuse the points-expiry notification cadence).

#### Visibility

**Public on profile.** Tier acts as a soft trust signal complementing badges. Privacy-conscious users can hide it via a Profile Settings toggle (default: visible).

---

### 11.2 Referral System — APPROVED SPEC

**Status:** Drafted 2026-05-05. **Approved by Alan 2026-05-05.** B13 is unblocked.

#### Rewards

| Who | Reward |
|---|---|
| Referrer | 500 pts |
| Referee | 250 pts |

Total cost per successful referral: 750 pts ≈ $2.25 face value.

#### Trigger

**Referee's first receipt-verified review.** Receipt OCR + photo validation must pass. Strongest anti-fraud trigger — requires physical venue visit and real receipt; not fakeable remotely.

#### Limits & anti-fraud

- **10 successful referrals per referrer per rolling 30 days** (anti-farming cap)
- No lifetime cap beyond the rolling 30-day window
- **One referee per phone + device fingerprint** — uses existing anti-fraud stack from B3
- **Self-referral blocked** — same phone / same device / same email-domain heuristic = rejected
- **Referral codes** — auto-generated, unique per user, visible in profile

#### SOW addendum (action required from client)

Client to send one-paragraph addendum to formalize. Suggested text:

> *"Zupurb shall include a referral system at launch. A user (referrer) generates a unique referral code or link. When a new user (referee) signs up using the code and posts their first receipt-verified review, the referrer earns 500 points and the referee earns 250 points. Referrals are capped at 10 per referrer per rolling 30 days. Self-referrals and gaming attempts are blocked via the platform's existing anti-fraud stack. Referral activity is logged in the user's profile and visible to the user."*

#### UI surfaces

- Referral code + share button in profile / settings
- Referral history list (pending vs completed) in profile
- "+500 pts Referral Bonus" entry in Points Wallet recent activity (already in mockup `Points Wallet.png`)
- Toast notification on successful referral conversion

---

## 12. Adding New Features Later

When a new feature is requested after launch:

1. Identify which pillar(s) it touches.
2. Route to the appropriate subagent(s).
3. Append a milestone to the relevant pillar in this doc (B-N, I-N, etc.).
4. Update `RULES.md` if the feature changes any guardrail.
5. Run T9 store policy checklist if the feature touches purchases, permissions, or UGC.
6. New approval gates may be added for high-risk changes (algorithmic changes, monetization changes).

This doc is the canonical plan. Update it; don't fork it.
