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

## Backend Issues (discovered during B3 implementation)

| # | File | Issue | Fix | Status |
|---|---|---|---|---|
| BE-1 | `functions/src/integrations/rekognition/client.ts` | `@aws-sdk/client-rekognition` package missing from `package.json` — build error (pre-existing, not B3) | Run `npm install @aws-sdk/client-rekognition` in functions/ or stub the import if Rekognition is not yet in scope | P1 — Open |
| BE-2 | `functions/src/reviews/triggers.ts` + `triggers/onReviewWrite.ts` | Two Firestore triggers registered on `reviews/{reviewId}` causes double-reads (UAR, fraud, sandbox). Should be merged into a single fan-out orchestrator in B5. | Merge into single trigger in B5 | P1 — Open (B5 kept separation to avoid scope creep; merge in next pass) |
| BE-4 | `functions/src/http/submitReview.ts` | B4 legacy callable now superseded by `reviews/submit.ts` (B5). Kept as `submitReview_b4` export in index.ts for backward compatibility. | Remove legacy export once client app updates to B5 callable name | P1 — Open |
| BE-3 | `algorithms/uar.ts` `socialProofScore` | Uses `reviewCount` as a proxy for `helpfulVotes` (UserDoc lacks a `helpfulVotesTotal` field). Should add a rolled-up `helpfulVotesTotal` field to UserDoc and update UAR. | Add field + fan-out in B5 | P2 — Open |
| BE-5 | `reviews/triggers.ts` | `updateEstablishmentScore` import flagged as unused by TS `noUnusedLocals` (false-positive resolved by linter auto-fix at B6 build). Root cause: prior autosave removed the import and the usage at line 105 references a stale declaration. Fixed by linter during B6 build. | None — resolved | P1 — Resolved (B6) |
| BE-6 | `integrations/ocr/client.ts` (lines 129, 155, 201, 224) | log.info/warn calls missing required `traceId` field in LogContext — TS2345 build error. Pre-existing before B7. | Pass `traceId: "no-trace"` or thread a real traceId into the OCR client. | P1 — Open |
| BE-7 | `reservations/verification.ts` (line 18) + `reservations/booking.ts` (line 15) | Unused imports `RESERVATIONS_COLLECTION` and `FieldValue` — TS6133 build errors. Pre-existing before B7. | Remove unused imports. | P2 — Open |
| BE-8 | `reviews/submit.ts` (line 226) | `reviewId` (const at line 269) used before declaration — TS2448/TS2454 build errors. Pre-existing before B11. | Move `const reviewId = crypto.randomUUID()` to before line 226. | P1 — Open |
| BE-9 | `reviews/submit.ts` (line 223) | `moderationFlag` declared but TypeScript reports it as never read — TS6133. The spread `...(moderationFlag ? ...)` at line 326 is not recognized as a read. Pre-existing before B11. | Use `void moderationFlag` or refactor the spread to avoid strict-mode false positive. | P2 — Open |
| BE-10 | `social/notifications.ts` (line 24) | `FieldValue` imported but never used — TS6133 build error. Pre-existing before B11. | Remove unused import. | P2 — Open |

| BE-11 | `triggers/onUserCreate.ts` (line 58) | `UserDoc` missing `dateOfBirth`, `birthdayBonusClaimedYear`, `anniversaryBonusClaimedYear` fields added to schema in B14 but not populated in the trigger. TS2739 build error. | Fixed during B12 build — added three null-default fields. | P1 — Resolved (B12) |

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
| I12-1 | `lib/core/services/deep_link_service.dart:168,267,268,286,287,305,306,321,322` | Pre-existing (not introduced by I12): `BranchLinkProperties.addMetaData` method does not exist in `flutter_branch_sdk ^7.0.0`; also `Map<dynamic, dynamic>` type mismatch at line 168. Likely API change in the installed branch SDK version. | Investigate `BranchLinkProperties` API in flutter_branch_sdk 7.x and replace `addMetaData` calls with correct method. | OPEN |
| I12-2 | `lib/core/services/fingerprint_service.dart:112,126,142` | Pre-existing (not introduced by I12): `FingerprintJSProResponse` type argument error and `confidence` getter missing — API shape mismatch with `fpjs_pro_plugin ^4.9.0`. | Check fpjs_pro_plugin 4.x migration guide; update type references. | OPEN |
| I12-3 | `lib/core/services/share_service.dart:60,61,77,78,94,95` | Pre-existing (not introduced by I12): `SharePlus` and `ShareParams` undefined — `share_plus ^10.x` API changed in v10. | Replace `SharePlus.instance.share(ShareParams(...))` with the v10 API (likely `SharePlus.shareXFiles` / `SharePlus.share` with a `ShareContent` object). | OPEN |
| I3-1 | `functions/src/integrations/algolia/client.ts` | Pre-existing tsc TS2307: Cannot find module 'algoliasearch' or its corresponding type declarations. `algoliasearch` npm package not installed. | `cd functions && npm install algoliasearch` then verify tsc passes. | OPEN |

## Web QA Bug Register (BUG-W series)

Filed 2026-05-07 — E2E web pass at https://zupurb-dev.web.app (T9 staging run).

| ID | Pillar | Severity | Screen | Issue | Steps | Status |
|---|---|---|---|---|---|---|
| BUG-W01 | Frontend | P1 | Search — Recent Searches | Tapping the X (remove) button on a recent search item navigates to `#/profile` instead of removing the item from the list. Reproducible 100%. | 1. Go to Search. 2. Type any query and press Enter. 3. Press back to return to Search home. 4. Tap the X next to any recent search chip. Expected: chip removed. Actual: navigates to Profile screen. | OPEN |
| BUG-W02 | Frontend | P2 | Settings — Delete Account dialog | Dialog text says "Account deletion will be available in a future update. Please contact support@zupurb.app to request deletion." This is a placeholder — the account deletion flow is not implemented. Per Apple App Store Review Guidelines §5.1.1(v) and Google Play Policy, account deletion must be available in-app before store submission. | 1. Settings → Delete Account. 2. Dialog appears with no self-service deletion option. | OPEN |

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
| CI-1 | `lib/core/services/iap_service.dart:22` | Unused import `flutter/foundation.dart` | `unused_import` (warning) | DONE |
| CI-2 | `test/widgets/selection_chip_test.dart:103` | Unused local variable `setStateRef` | `unused_local_variable` (warning) | DONE |
| CI-3 | `lib/core/services/deep_link_service.dart` (15 lines) | `print` calls in production code | `avoid_print` (info) | DONE |
| CI-4 | Multiple screens | `withOpacity` deprecated; use `.withValues()` | `deprecated_member_use` (info) | DONE |
| CI-5 | `lib/widgets/plus_paywall.dart` | `Radio.groupValue` / `onChanged` deprecated; missing `RadioGroup` ancestor | Restored `RadioGroup<String>` wrapper; removed deprecated props from `Radio`; fixed `catchError` return type on server sync call | DONE (I6) |
| CI-6 | `lib/main.dart:6` | Unnecessary import `flutter/foundation.dart` | `unnecessary_import` (info) | DONE |
| CI-7 | Multiple test files | Multiple leading underscores on unused params | `unnecessary_underscores` (info) | DONE |

CI workflow may now use `flutter analyze --fatal-infos` — all CI-* items resolved 2026-05-06.

---

## T2 Widget Test Findings (QA — 2026-05-06)

| ID | File | Severity | Issue | Recommendation | Status |
|---|---|---|---|---|---|
| BUG-001 | `lib/widgets/score_badge.dart` | P2 | `ScoreBadge` uses `AppColors.primary` (orange) for all score values. T2 spec and SOW §7 imply green (high) / amber (mid) / red (low) colour ranges to give users an instant quality signal. The widget currently communicates no quality gradient. | In Phase 1B, add a `_colorForScore(double)` helper that returns `AppColors.scoreGreen` (≥4.5), `AppColors.warning` (3.0–4.4), `AppColors.error` (<3.0). All existing `score_badge_test.dart` assertions for colour will need updating when this lands. | OPEN |
| BUG-002 | `lib/screens/home/home_screen.dart:301` | P1 | `_ReviewCard` contains a `Row` (inside a `SizedBox(w:44, h:44)`) that overflows by 2.5 pixels on the right. Triggers a RenderFlex overflow assertion in every widget test and in debug builds. Root cause: fixed-size `SizedBox` wrapping a Row whose children exceed 44 px. | Wrap the inner content with `Flexible` / `Expanded`, or remove the fixed `SizedBox` constraint. Reproduce: `flutter test test/widgets/review_card_test.dart` without the overflow suppressor in `_pump`. | OPEN |

---

## T6 Accessibility Findings (QA — 2026-05-06)

| ID | File | Severity | Issue | Recommendation | Status |
|---|---|---|---|---|---|
| A11Y-001 | `lib/screens/badges/badges_screen.dart` | P1 | Tab selector chips (Badges / Challenges) use bare `GestureDetector` with no `Semantics` wrapper. Selected state is never announced to TalkBack/VoiceOver. Chip height ≈ 30pt — below the 44pt minimum. | Wrap each chip in `Semantics(label: e.value, selected: _tab == e.key, button: true, child: ...)` and set a `constraints: BoxConstraints(minHeight: 44)` on the container, or use Flutter `ChoiceChip` which handles both concerns natively. | OPEN |
| A11Y-002 | `lib/screens/auth/login_screen.dart`, `lib/screens/auth/signup_screen.dart` | P1 | Social sign-in buttons (Google "G", Facebook "f", Apple icon) use a bare `Container` with a single-letter `Text` or `Icon`. VoiceOver/TalkBack will announce "G" or just "image" — meaningless to screen reader users. | Wrap each `_SocialButton` in `Semantics(label: 'Sign in with Google' / 'Sign in with Facebook' / 'Sign in with Apple', button: true)`. | OPEN |
| A11Y-003 | `lib/screens/auth/login_screen.dart`, `lib/screens/auth/signup_screen.dart` | P1 | "Remember Me" checkbox (login) and Terms agreement checkbox (sign-up) use raw `GestureDetector` wrapping a `Container` (22×22 / 24×24 logical pixels). No `Semantics` node announces checked/unchecked state; touch target is below 44pt minimum. | Replace with `Semantics(checked: _remember, label: 'Remember me', button: true)` and expand tap area to 44×44 via `GestureDetector` padding or `InkWell` with `materialTapTargetSize`. | OPEN |
| A11Y-004 | `lib/screens/home/home_screen.dart` | P1 | Home feed tab chips (All / Reviews / Feed / Creators / Deals) use `GestureDetector` with no `Semantics` wrapper. Selected chip is not announced as selected. Chip height ≈ 31pt — below 44pt minimum. | Same fix as A11Y-001: add `Semantics(label: ..., selected: ..., button: true)` wrapper and enforce `minHeight: 44`. | OPEN |
| A11Y-005 | `lib/screens/points/points_wallet_screen.dart` | P2 | Activity row icons (`Icons.rate_review`, `Icons.local_offer`, `Icons.flash_on`, `Icons.share`) are plain `Icon` widgets with no `Semantics` node. VoiceOver announces "image" giving no context about the activity type. | Wrap the `CircleAvatar`+`Icon` combination in `ExcludeSemantics` (if the sibling title text provides sufficient context) or `Semantics(label: '<activity type>')`. | OPEN |
| A11Y-006 | `lib/screens/badges/badges_screen.dart` | P2 | `LinearProgressIndicator` for badge milestone progress (23/75) has no semantic label. Screen readers cannot announce the progress percentage. | Wrap in `Semantics(label: '23 of 75 reviews completed, 31%', child: LinearProgressIndicator(...))`. | OPEN |
| A11Y-007 | `lib/screens/points/points_wallet_screen.dart` | P2 | Balance text `'1,847 pts'` uses a fixed `fontSize: 44`. No `MediaQuery.textScalerOf` guard. At system font scale 2.0× the text likely clips out of the card container. | Constrain the card with `FittedBox` or use `textScaleFactor`-aware sizing so the balance scales gracefully to 1.5× and 2.0× system font sizes. | OPEN |
| A11Y-008 | `lib/theme/colors.dart` (AppColors.primary) | P1 | `AppColors.primary` (#E07B54 — estimated from orange swatch) on white background has a contrast ratio of approximately 2.7:1. This is below WCAG 2.1 AA requirements for normal text (4.5:1) and large text (3:1). Affects: tab chip labels, text-button labels, score badge text (white on primary), and field prefix icons. | Darken primary to achieve ≥3:1 for large text elements and ≥4.5:1 for body text, or use a darker text colour on primary-coloured backgrounds. Exact hex to be confirmed with a contrast analyser against the final brand colour. | OPEN |
| A11Y-009 | `lib/screens/auth/login_screen.dart`, `lib/screens/auth/signup_screen.dart` | P2 | Checkbox containers (22×22 and 24×24 px) are too small for comfortable tapping (iOS HIG and Material require ≥44pt). Covered by A11Y-003 fix — listed separately for completeness. | See A11Y-003. | OPEN |
| A11Y-010 | `lib/screens/points/points_wallet_screen.dart` | P2 | Redeem row navigation arrow: `GestureDetector(onTap: ..., child: Icon(Icons.chevron_right, ...))`. Icon is 24×24 pt with no padding. Below 44pt touch target minimum. No semantic label. | Add `Semantics(label: 'Go to redeem rewards', button: true)` wrapper and expand tap target with `Padding` to at least 44×44. | OPEN |

---

## T11 E2E Web App Smoke Test Findings (QA — 2026-05-07)

Tested at https://zupurb-dev.web.app using anonymous auth ("Try Demo"). Headless Chromium, 390×844 viewport (iPhone 16 Pro size). All findings are reproducible.

| ID | Screen | Severity | Issue | Recommendation | Status |
|---|---|---|---|---|---|
| BUG-W01 | Establish­ment / Discover / Home | P0 | **Age Verification gate is broken — "I am 18 or older" button does nothing.** Tapping any establishment card (Home or Discover) triggers the age gate modal correctly, but pressing "I am 18 or older" does not dismiss the modal or navigate to the establishment. The URL stays at `#/discover`. The entire establishment detail screen, Reserve flow, Review flow, Time Slot, Confirm Booking, and Reservation Pass are all unreachable because this gate is never cleared. "Go Back" works, but forward navigation is permanently blocked. | Investigate `AgeVerificationWidget` (or equivalent bottom sheet / dialog). The confirm handler likely has a broken `setState`, wrong `context`, or a missing `Navigator.pop` / route push. Fix the "I am 18 or older" `onTap` to: (1) persist the verification flag so the gate does not re-appear, and (2) navigate to the establishment detail screen. | OPEN |
| BUG-W02 | Search | P1 | **Search text input does not accept keyboard input.** Tapping the "Search experiences, creators…" field does not open a text input. No `<input>` element is injected into the DOM. Keyboard events typed after clicking the field area have no effect — the placeholder text never changes and no search query is formed. The "Search" submit button runs without any query. | Check `SearchInputField` widget — the `onTap` likely navigates but the `TextField` focus is not requested, or the `TextEditingController` is never wired to the visible hint text. Ensure the input gains focus on tap and that typed text reflects in the search query before the "Search" button is pressed. | OPEN |
| BUG-W03 | Search — Recent Searches | P1 | **Recent search X (remove) buttons overlap the bottom navigation bar.** The remove buttons (aria: "Remove Tacos Downtown from recent searches", etc.) are rendered at top=785, left=330 — which overlaps the Profile nav tab at top=780, left=319. Clicking the X button navigates to the Profile screen instead of removing the search item. Root cause: the Recent Searches list is rendered inside the scrollable body but the semantic hit boxes extend below the SafeArea bottom padding and are occluded by the persistent bottom nav. | Add sufficient bottom padding to the scrollable list (at minimum `MediaQuery.of(context).padding.bottom + 80` to clear the nav bar). Also ensure `flt-semantics` hit-test bounds for remove buttons do not extend below y=756 (bottom of safe scrollable area at 390×844). | OPEN |
| BUG-W04 | Search — Recent Searches | P1 | **Tapping a recent search item does not execute the search.** Tapping "Tacos Downtown" or "Rooftop Bar" in Recent Searches stays on the filter/landing page — no search is executed and no results are shown. Expected: tapping a recent search item should pre-fill the query and run the search immediately. | Wire the `onTap` of each recent search chip to: (1) set the `TextEditingController` text, and (2) trigger the search submit action. | OPEN |
| BUG-W05 | Search | P1 | **Submitting a search with no query shows no results and no empty state.** Pressing the orange "Search" button with no text in the input field keeps the same filter/landing page visible with no result list, no "no results" message, and no loading indicator. | Either (a) disable the Search button when the query is empty, or (b) run a blank search and display a results list or "Enter a search term" empty-state message. | OPEN |
| BUG-W06 | Settings / Profile | P2 | **Username inconsistency between Profile and Settings screens.** Profile screen displays "Alan Paul / @alanpaul" while Settings screen displays "Alex Rivers / @alanpaul" (same handle, different display name). This indicates either two separate mock data sources or a state management bug where the Settings screen is reading from a different user document than Profile. | Ensure both screens read display name from the same Firestore `users/{uid}` document / provider. Eliminate any hardcoded mock `displayName` in the Settings screen widget. | OPEN |
| BUG-W07 | Discover | P2 | **Discover establishment cards show placeholder images (large grey rectangles for "The Social Lounge" and the middle card on Home).** The card image area renders as a dark grey box with only "Establishment Safe Work…" placeholder text visible. Other cards (Bloom Gardenia, Rooftop Garden Bar, Amber Embe..., Velvet Lounge, The Atrium Café) load images correctly. | Check that all mock establishment records in Firestore/seed data have valid `imageUrl` values. The two failing cards likely have null, empty, or 404 `imageUrl` fields — add a fallback `Image.asset` placeholder while the network image loads. | OPEN |
| BUG-W08 | Home — Review Card | P2 | **Review card author images render as empty pink circles** (three circular placeholders below the review text). No profile pictures load for the review author or reaction icons area. | Verify that the demo user data seeds include valid `photoURL` values. Add a fallback `CircleAvatar` with initials when `photoURL` is null or returns 404. | OPEN |
| BUG-W09 | Review Card | P3 | **Share button (web Share API) is a no-op in web context without the native platform share sheet.** The button is tappable and has a correct aria label ("Share review") but the Web Share API is not available in many desktop browsers, causing a silent failure. | Add a fallback: if `navigator.share` is unavailable, show a copy-link bottom sheet or dialog. This is a known Flutter web limitation with `share_plus` (see I12-3). | OPEN |
| BUG-W10 | Login | P3 | **A JavaScript error fires on page load.** `Error at aXa.a (main.dart.js:5117)` is logged to the console. Does not prevent the app from loading but indicates an unhandled Dart exception during initialization (likely a Firebase plugin init race or null-safety issue). | Investigate the stack trace: `aXa.$2 → aW0.$1 → main.dart.js:104759`. Enable source maps in the web build and identify the Dart source line. | OPEN |
| BUG-W11 | Home Feed | P1 | **Home review card body content has zero interactive semantic elements in the y=180–740 content region.** The review card renders visually (action buttons at y=756 are present) but there is no tappable card body, no review text node, no venue link, and no author link in the semantic tree. Users cannot tap the card to open a full review. | Add `Semantics` nodes (or ensure `GestureDetector` widgets inside the card body generate flt-semantics entries) for the card body, author name, and venue name. | OPEN |
| BUG-W12 | Establish­ment → URL routing | P1 | **URL does not update when navigating into Establishment, Reservation, and Review sub-screens.** After clearing the age gate, all subsequent screens (Establishment Detail, Time Slot, Confirm Booking, Reservation Pass, Verify Visit, Rate Experience, Creator Disclosure, Written Review, Review Submitted) keep the URL at `#/discover`. Deep links and browser back button cannot distinguish which sub-screen the user is on. | Ensure each screen in the Establishment and Review stacks pushes a named route (e.g. `#/establishment/:id`, `#/reservation/time-slot`, `#/review/verify`). Use Flutter's `GoRouter` named routes or `Navigator.pushNamed` with path parameters. | OPEN |
| BUG-W13 | Messages | P1 | **Tapping a conversation item does not open the chat screen.** The Messages list shows 5 conversation rows. Tapping any row keeps the URL at `#/messages` and the semantic tree unchanged — no chat history, no text input, and no back button appear. The chat detail screen is never pushed onto the navigation stack. | In the Messages list widget, verify the `onTap` on each `ConversationTile` calls `Navigator.push` / `GoRouter.go` to the chat route with the correct conversation ID. | OPEN |
| BUG-W14 | Messages — Chat | P1 | **No text input field is present on the Messages screen.** Zero `<input>` or `flt-semantics[role=textbox]` elements exist on the Messages screen at any point. Users cannot type or send messages. | Add a `TextField` (or `TextFormField`) to the chat screen for message composition and wire it to the send action. | OPEN |
| BUG-W15 | Messages | P2 | **Messages screen lacks a back button** (no button at x<60, y<60). There is no visible navigation back to the previous screen. The only exit is via the bottom navigation bar. | Add an `AppBar` with a leading back arrow to the Messages screen, or ensure the screen is placed correctly in the navigation stack so the standard back gesture works. | OPEN |
| BUG-W16 | Search Results | P1 | **Search results screen has no back button.** After submitting a search, the results screen (URL still `#/search`) shows 2 result cards and a notifications bell but no back/close button (no button at x<60, y<60). Users cannot return to the search filter screen without using the bottom navigation bar. | Add a back arrow to the search results AppBar that pops the results and returns to the filter/landing state. | OPEN |
| BUG-W17 | Settings | P1 | **Settings screen navigation items do not navigate.** Tapping any of the 6+ navigation rows (items at y=259, 355, 411, 673, 776, 832) keeps the URL at `#/settings` and element count drops to 3 (only back btn + group remain) — no sub-screen is pushed. Privacy Settings, Account, Help, and all other settings rows are non-functional. | Verify that each `ListTile` in `settings_screen.dart` has a correct `onTap` wired to `Navigator.push` or `GoRouter.go`. Check that no modal is opened and immediately dismissed. | OPEN |
| BUG-W18 | Settings — Privacy Settings | P1 | **Privacy Settings screen is unreachable.** Direct consequence of BUG-W17 — no settings item navigates to `#/privacy`. The account deletion flow (required by App Store §5.1.1(v) and Google Play policy) is therefore also blocked. | Fix BUG-W17 first. Ensure the Privacy Settings row wires to `/privacy-settings` route. | OPEN |
| BUG-W19 | All screens | P1 | **No bottom navigation bar on sub-screens (Settings, Points, Badges, Redeem).** These screens are accessed via direct URL navigation (`#/settings`, `#/points`, `#/badges`, `#/redeem`) and show a back button but no bottom navigation bar. Users who deep-link to these routes cannot navigate to other main sections without using the back button first. | Decide whether these screens should be root-level (with bottom nav) or sub-screens (back-only). If sub-screens, ensure they can only be reached from within a root tab so the back button always has a destination. | OPEN |
| BUG-W20 | Search Filter | P1 | **Search filter toggle switches (Open Now, Deals Available, Reservations Available, By Preference) have no semantic labels.** All 4 `flt-semantics[role="switch"]` elements at y=348/396/444/492 carry `label=null`. Screen readers announce them as unlabelled toggles. Additionally, the filter tab bar (y=130) has 8 buttons including tabs at x>390 (off-screen), indicating overflow that truncates the tab list. | Add `Semantics(label: 'Open now filter')` etc. to each switch. Investigate why tab buttons extend beyond x=390 — the tab bar may need a `SingleChildScrollView` or adjusted layout. | OPEN |
| BUG-W21 | Profile | P2 | **Profile content tab bar buttons are too small.** Tabs at y≈540 have heights of 19–25pt, below the 44pt minimum touch target for both iOS HIG and Material Design. Tab at x=20, y=540 (Posts) is 56×25pt; others are 51×19pt, 69×19pt, 105×19pt. | Increase the container height of each tab chip to at least 44pt using `constraints: BoxConstraints(minHeight: 44)`. | OPEN |
| BUG-W22 | Home / Review Cards | P2 | **Mock author profile images fail to load due to CORS policy.** Console errors confirm: `Access to XMLHttpRequest at 'https://randomuser.me/api/portraits/...' from origin 'https://zupurb-dev.web.app' has been blocked by CORS policy`. Four portrait URLs from randomuser.me fail network-level. Review cards display as empty pink circles (see BUG-W08). | Replace `randomuser.me` URLs with images hosted on Firebase Storage or a CDN that sets `Access-Control-Allow-Origin: *`. Or use initials-based fallback avatars as a minimum. | OPEN |
| BUG-W23 | Age Gate / Establish­ment routing | P1 | **BUG-W01 resolution — age gate "I am 18 or older" DOES navigate to the establishment screen, but the URL remains `#/discover` (sub-screen rendered as overlay, not a route push).** The previous BUG-W01 description was incorrect in saying navigation is "permanently blocked." The establishment IS accessible. However, the URL not updating means deep links to establishment detail are broken and the browser back button does not navigate back to Discover as expected. Root cause is BUG-W12 (URL routing). BUG-W01 status should be re-classified. | See BUG-W12 for fix. Update BUG-W01 to PARTIALLY RESOLVED — the screen is accessible but routing is wrong. | OPEN |

## Adding New Items

When a new fix is identified:

1. Add a row to the appropriate severity section.
2. Use ID format `P{0|1|2}-N` continuing the sequence.
3. Reference the screen file path in `Zupurb User App/UI/`.
4. Reference SOW section if applicable.
5. State the fix concretely.

This list is the canonical bug register for Phase 1B. Don't fork it.
