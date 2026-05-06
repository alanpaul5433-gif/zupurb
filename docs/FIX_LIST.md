# Zupurb — UI Fix List Register

Source: screen-by-screen audit of `Zupurb User App/UI/` against `ZUPURB - SOW V6.pdf`.

**Use:** Phase 1B applies these fixes in priority order. Frontend Phase 1A intentionally preserves all of these issues to allow visual sign-off first.

**Phase 1B Status: COMPLETE — 2026-05-05**

---

## P0 — Critical (Blocks Build / Algorithmic Correctness)

| # | Screen | Issue | Fix | Status |
|---|---|---|---|---|
| P0-1 | `iPhone 16 Pro - 34.png` (Rate) | Q1 has 3 options (SOW: 4); Q2 uses 5-emoji scale (SOW: 4 named); Q3 shows vibe categorization (SOW: quality scale); Q4 question/answer pair scrambled; Q5–Q8 not present | Redesigned to 8 separate question cards each with 4 named chip options per SOW §7.2. File: `lib/screens/review/rate_experience_screen.dart` | DONE |
| P0-2 | All score displays | Mixed 0–10 (8.4, 9.4) and 0–5 (4.6, 5.0) scales | Unified to 1.00–5.00 format across Home (4.2), Establishment (4.4), Discover (4.6, 4.4, 4.5, 4.6), Search results (4.7/5, 4.8/5) | DONE |
| P0-3 | Onboarding | "STEP X OF 8" but SOW specifies 10 screens | Added steps 9 (Bio) and 10 (Neighborhood). Updated all progress indicators to "of 10". Added routes `/onboarding/9` and `/onboarding/10`. | DONE |
| P0-4 | `iPhone 16 Pro - 29.png` (Sign Up) | No phone number field | Added phone number field to signup. Added PhoneOtpScreen at `/signup/phone-otp` with 6-digit input boxes and mock verification. | DONE |
| P0-5 | `iPhone 16 Pro - 33.png` (Verify Visit) | "Partially Verified" labelled "GPS location check only" | Changed to photo-only upload with AI validation loading state. Icon updated to camera. Conditional UI per selection. | DONE |
| P0-6 | Multiple | Off-spec point costs | Free Dessert: 3500→750 pts; Starbucks $10: 2500→3500 pts; Weekend Warrior: 500→150 pts. | DONE |
| P0-7 | Onboarding Steps 6 & 7 | Duplicate "What Do You Like To Do?" screens | Step 7 replaced with Sensitive Topics screen (Political/Religion preferences). | DONE |

## P1 — Significant (Affects Feature Scope)

| # | Screen | Issue | Fix | Status |
|---|---|---|---|---|
| P1-1 | Search | Missing tabs: Entertainers, Content/Posts, Brands | Added to `_tabs` list in `search_screen.dart` | DONE |
| P1-2 | Messages | Entertainers tab missing | Added 'Entertainers' to `_tabs` in `messages_list_screen.dart` | DONE |
| P1-3 | Messages | Mutual-follow gating not visualized | Added lock icon + italic "Follow each other to message" state on conversation tiles | DONE |
| P1-4 | Messages | Business→user 1-msg limit not enforced | Added "Business intro — reply to continue" label on first business message tile | DONE |
| P1-5 | `Points Wallet.png` | Tiered loyalty (Elite/Platinum) not in SOW | **Resolved scope-wise:** included in launch (milestone B14). UI surface stays. Phase 1B keeps Elite Tier card; build the tier engine in B14 once client provides spec | N/A — deferred |
| P1-6 | `Points Wallet.png` | Referral Bonus surfaced but no flow built | **Resolved scope-wise:** include in launch (milestone B13). UI surface stays; build the underlying referral system in Phase 1B + B13 | N/A — deferred |
| P1-7 | `User Profile (Own)-1.png` | Founder Badge "first 1,000 members" — SOW caps at 150 | Updated copy to "first 150 members" in `badges_screen.dart` | DONE |
| P1-8 | Profile | Invented badges: "Verified," "Local Guide," "Connoisseur" | Replaced with SOW §13.1 names: Taster, Founder, First Bite, Critic, Explorer | DONE |
| P1-9 | `Reservation Check-In-1.png` | "Plus members redeem 25% more value" — SOW says multiplier on earning | Rephrased to "Earn 1.25× points on this visit with Plus." | DONE |
| P1-10 | `Reservation Check-In-2.png` | Profile tabs "Reviews / Photos / Lists" — SOW §9.2 says "Posts / Reels / Reviews / Places Visited" | Already correct in Phase 1A — no change needed | N/A — was already correct |
| P1-11 | `Discover.png` | "New on Zupurb" rail missing | Added horizontal scroll rail with 3 mock new venue cards | DONE |
| P1-12 | Search | "Reservations available" filter missing | Added toggle filter in search filters section | DONE |
| P1-13 | Search | "By preference" (activity-type) filter missing | Added "By preference" dropdown filter | DONE |
| P1-14 | Discover/Search list cards | Reservation availability badge missing | Added "Reservations available" chip to discover NearbyItem cards | DONE |
| P1-15 | `iPhone 16 Pro - 39.png` (Add Place) | "+150 pts for adding venue" not surfaced | Added reward pill banner below header in `add_place_screen.dart` | DONE |
| P1-16 | Add Place | User-set price range conflicts with SOW §17.2 (business-set) | Added helper text: "Price range you set may be updated by the business when they claim this listing." | DONE |
| P1-17 | `My Reservations.png` | "Requested" status not in SOW | Changed "Requested" → "Upcoming" (instant-confirm flow per R5.3) | DONE |
| P1-18 | `Reservation Check-In-3.png` | $25 cancellation fee not in SOW | Removed fee. Added: "Cancellations are only permitted more than 48 hours before your reservation." | DONE |
| P1-19 | Check-In | OTP TTL not shown | Added "Code refreshes every 60s · 42s remaining" to reservation pass screen | DONE |
| P1-20 | Home Feed | "Share Your Latest Discovery" composer not in SOW §3.2 | Removed `_EmptyFeedCard` widget and its usage from home_screen | DONE |
| P1-21 | `Reservation Check-In-2.png` | Plus creator analytics shown on public profile (SOW: Plus-only personal dashboard) | Removed "Creator Insights" block from `other_profile_screen.dart` | DONE |

## P2 — Polish (Copy, Typos, Minor)

| # | Screen | Issue | Fix | Status |
|---|---|---|---|---|
| P2-1 | `iPhone 16 Pro - 29.png` | Sign-up CTA labelled "Sign In" | Changed to "Create Account" | DONE |
| P2-2 | `iPhone 16 Pro - 53.png` | "Forgot Your Passwords" plural | Changed to "Forgot Your Password" | DONE |
| P2-3 | `iPhone 16 Pro - 56.png` | "info@zurpurb.co" misspelt | Fixed to "info@zupurb.co" in `otp_screen.dart` | DONE |
| P2-4 | `iPhone 16 Pro - 54.png` | "[email address]" placeholder leaking; stray apostrophe | Fixed to "We sent a reset link to your registered email address." in `email_sent_screen.dart` | DONE |
| P2-5 | `iPhone 16 Pro - 36.png` | "AI Summaryy" double y | Fixed to "AI Summary" in `written_review_screen.dart` | DONE |
| P2-6 | `User Profile (Own).png` | Header reads "Redeem Rewards" | Changed to "My Profile" in `own_profile_screen.dart` | DONE |
| P2-7 | `Settings.png` | "premium concierge bookings" copy from another product; "until Oct 2024" stale | Rewritten with Zupurb Plus benefits + "Active until Dec 31, 2026" | DONE |
| P2-8 | `Settings-1.png` | "see your walks and history" — wrong domain | Changed to "your posts, reels, and activity" in `privacy_settings_screen.dart` | DONE |
| P2-9 | `iPhone 16 Pro - 25.png` | "Select Sports Viewing to pick teams" hint always visible | Made conditional — only shown when Sports Viewing is selected in `onboarding_step6_screen.dart` | DONE |
| P2-10 | `iPhone 16 Pro - 28.png` | Completion missing first-badge unlock pill | Added "Badge Unlocked: First Bite" pill to `profile_complete_screen.dart` | DONE |
| P2-11 | `iPhone 16 Pro - 37.png` | Submission shows +80 pts but Taster bonus +150 not visible | Added "+150 pts" badge bonus chip to review submitted Taster row | DONE |
| P2-12 | `User Profile (Own)-1.png` | Two "First Bite" tiles | Renamed second "First Bite" to "Explorer" in `badges_screen.dart` | DONE |
| P2-13 | `User Profile (Own)-1.png` | Leaderboard tab not in SOW | Removed Leaderboard from badges screen tabs | DONE |
| P2-14 | `User Profile (Own)-2.png` | "Points expiring 3 days" — SOW cadence is 60-day + 7-day | Updated to "expire in 7 days — final warning" with 60-day context in `points_wallet_screen.dart` | DONE |
| P2-15 | `iPhone 16 Pro - 30.png` (Home) | Tab "Creator" should be "Creators" | Pluralized in `home_screen.dart` | DONE |
| P2-16 | `iPhone 16 Pro - 38.png` (Home Deals) | Different tab set than main Home | No separate deals screen found — single home screen with consistent tabs. N/A. | N/A — single screen |
| P2-17 | `User Profile (Own).png` | Income brackets not exposed on Identity step (verify drill-down respects SOW brackets) | INCOME RANGE field present with dropdown chevron. Mock expansion deferred. Field placement is correct. | ACKNOWLEDGED |

## Integration Fix Register (I-series)

| # | Domain | Issue | Fix | Status |
|---|---|---|---|---|
| I-info-1 | Multiple screens (Phase 1B) | `withOpacity` deprecated (10 instances across splash, discover, home, onboarding, reservation, settings) | Replace with `.withValues(alpha: ...)`. Not introduced by I1; pre-existing. | OPEN |
| I2-1 | `lib/widgets/establishment_map.dart` | `_openDirections` builds the Google Maps URL but does not launch it — `url_launcher` not yet in pubspec. | Add `url_launcher: ^6.3.0` to pubspec.yaml and wire `launchUrl(uri)` in `_openDirections`. | OPEN |
| I12-1 | `lib/core/services/analytics_service.dart:74` | Pre-existing parser error: "Expected an identifier" on `_analytics.logEvent(name:…)`. Not introduced by I12. Likely a `firebase_analytics ^11.3.3` API mismatch — `logEvent` parameter names may have changed. | Investigate `FirebaseAnalytics.logEvent` signature in v11 and update call site. | OPEN |
| I3-1 | `functions/src/integrations/algolia/client.ts` | Pre-existing tsc TS2307: Cannot find module 'algoliasearch' or its corresponding type declarations. `algoliasearch` npm package not installed. | `cd functions && npm install algoliasearch` then verify tsc passes. | OPEN |

## Security Fix Register (T8)

| ID | Pillar | Severity | Issue | Recommendation | Status |
|---|---|---|---|---|---|
| BUG-SEC-01 | Backend | P1 | `pointsLedger` Firestore rule allows clients to create earn entries with uncapped `delta`. A malicious client can write arbitrarily large fake earn entries. If any server code sums raw ledger entries instead of reading from the Admin-written `userBalances` projection, the fake entry inflates balance. | Remove `allow create` from the `pointsLedger` rule entirely. All writes go through Cloud Functions via Admin SDK. Implement optimistic UI in Flutter local state only. | OPEN |
| BUG-SEC-02 | Backend | P1 | `redeemDeal.ts` does not validate Plus entitlement server-side for deals that require Plus (`deal.isPlusRequired`). Plus gating exists only in the Flutter UI. A client calling the function directly bypasses the gate. | In `redeemDeal.ts`, after loading the deal, add: `if (deal.isPlusRequired && !(await isPlusActive(uid))) throw HttpsError('permission-denied', ...)`. | OPEN |
| BUG-SEC-03 | Frontend | P1 | `firebase_init.dart` uses `AndroidProvider.debug` and `AppleProvider.debug` unconditionally. Production builds do not receive real attestation, leaving all Cloud Function endpoints open to bot/script abuse. | Wrap providers in `kReleaseMode` conditional: PlayIntegrity (Android) + DeviceCheck (iOS) in release; debug otherwise. Must be done before any beta or production distribution. | OPEN |
| BUG-SEC-04 | Backend | P1 | `submitReview`, `createReservation`, `redeemDeal`, `verifyCheckIn`, `sendMessage`, and ~40 other callables lack `enforceAppCheck: true`. Without it, any HTTP client with a valid Firebase API key can call these functions directly, bypassing device attestation. | Add `enforceAppCheck: true` to the `onCall` options for at minimum the five high-value functions listed. Do this after BUG-SEC-03 is resolved so legitimate clients are not broken. | OPEN |

## Backend Fix Register (B-series)

| # | Domain | Issue | Fix | Status |
|---|---|---|---|---|
| B-P2-1 | UAR / UserDoc | `socialProofScore` uses `reviewCount` as a proxy for `helpfulVotes` because `UserDoc` has no `helpfulVotesTotal` field. Accuracy is degraded. | Add `helpfulVotesTotal: number` to `UserDoc` schema and roll it up from `review.upvoteCount` on review fan-out (B4). Update `socialProofScore` in B5 once field exists. | OPEN |
| B-P2-2 | UAR / profileCompleteness | `neighbourhood` field is not in `UserDoc` schema (onboarding collects it but doesn't persist it). The +0.10 neighbourhood bonus in the spec is omitted. | Add `neighbourhood: string \| null` to `UserDoc` in schema.ts and populate it in `completeOnboarding` callable (B2 follow-up). | OPEN |
| P2-18 | `Reservation Check-In-5.png` | Rewards not in SOW redemption list ($2 booking credit, $8 dinner) | Replaced "$2 Booking Credit" with "Gift Card Redemption" in `exclusive_benefits_screen.dart` | DONE |

---

## D1 — CI Analyze Suppressions (Deployment scope)

`flutter analyze` (run 2026-05-06) exits non-zero under `--fatal-infos`. Root causes are frontend code, logged here for the frontend agent.

| ID | File | Issue | Rule | Status |
|---|---|---|---|---|
| CI-1 | `lib/core/services/iap_service.dart:22` | Unused import `flutter/foundation.dart` | `unused_import` (warning) | OPEN |
| CI-2 | `test/widgets/selection_chip_test.dart:103` | Unused local variable `setStateRef` | `unused_local_variable` (warning) | OPEN |
| CI-3 | `lib/core/services/deep_link_service.dart` (15 lines) | `print` calls in production code | `avoid_print` (info) | OPEN |
| CI-4 | Multiple screens | `withOpacity` deprecated; use `.withValues()` | `deprecated_member_use` (info) | OPEN |
| CI-5 | `lib/widgets/plus_paywall.dart` | `Radio.groupValue` / `onChanged` deprecated | `deprecated_member_use` (info) | OPEN |
| CI-6 | `lib/main.dart:6` | Unnecessary import `flutter/foundation.dart` | `unnecessary_import` (info) | OPEN |
| CI-7 | Multiple test files | Multiple leading underscores on unused params | `unnecessary_underscores` (info) | OPEN |

CI workflow uses `flutter analyze` (no `--fatal-infos`) until these are resolved. Re-add `--fatal-infos` once all CI-* items are cleared.

---

## Adding New Items

When a new fix is identified:

1. Add a row to the appropriate severity section.
2. Use ID format `P{0|1|2}-N` continuing the sequence.
3. Reference the screen file path in `Zupurb User App/UI/`.
4. Reference SOW section if applicable.
5. State the fix concretely.

This list is the canonical bug register for Phase 1B. Don't fork it.
