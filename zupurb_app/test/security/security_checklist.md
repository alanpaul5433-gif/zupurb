# Zupurb — T8 Security Checklist

**Milestone:** T8 Security Audit
**Date:** 2026-05-07
**Auditor:** QA Agent (Sonnet 4.6)
**Scope:** Firestore rules, Storage rules, Cloud Functions, Flutter app (Dart), deep links

---

## 1. IDOR — Insecure Direct Object Reference

### 1.1 Firestore — Cross-User Read Prevention

| Collection | Rule | Status | Notes |
|---|---|---|---|
| `users/{userId}` | Owner reads own doc; authenticated users read only non-deleted accounts | PASS | `isOwner(userId)` enforced; soft-deleted docs blocked via `!isDeletedUser(resource.data)` |
| `private_user_data/{userId}` | Admin-only read and write | PASS | `allow read, write: if isAdmin()` — no client path exists |
| `users/{userId}/fingerprintSnapshots/{snapshotId}` | Admin read only; no client write | PASS | `allow read: if isAdmin(); allow write: if false` |
| `pointsLedger/{entryId}` | Caller reads only entries where `userId == request.auth.uid` | PASS | Field-level ownership check: `resource.data.userId == request.auth.uid` |
| `userBalances/{userId}` | Owner reads own doc | PASS | `isOwner(userId)` |
| `reservations/{reservationId}` | Guest reads own doc; staff reads venue docs | PASS | `resource.data.guestUid == request.auth.uid` |
| `notifications/{userId}/items/{notifId}` | Owner reads own items | PASS | `isOwner(userId)` |
| `conversations/{conversationId}` | Participant reads only; `isParticipant()` helper | PASS | `request.auth.uid in threadData.participantUids` |
| `conversations/.../messages/{messageId}` | Participant reads via `get()` parent doc | PASS | Cross-document `get()` call verifies participation |
| `plusSubscriptions/{uid}` | Owner reads only | PASS | `isOwner(uid)` |
| `userTiers/{uid}` | Owner reads only | PASS | `isOwner(uid)` |
| `dealRedemptions/{redemptionId}` | Owner reads only (`resource.data.userId == request.auth.uid`) | PASS | Field-level check |
| `referrals/{referralId}` | Referrer or referee can read | PASS | `request.auth.uid == resource.data.referrerUid OR refereeUid` |
| `giftCardRedemptions/{uid}/redemptions/{redemptionId}` | Owner reads only | PASS | `isOwner(uid)` |
| `userChallengeProgress/{compositeId}` | Owner reads only (`resource.data.userId == request.auth.uid`) | PASS | Field-level check |

### 1.2 Firestore — Cross-User Write Prevention

| Collection | Intended Writer | Client Write Blocked? | Notes |
|---|---|---|---|
| `users/{userId}` update | Owner (limited fields only) | PASS | `hasOnly([...])` whitelist; `isPlusSubscriber`, `loyaltyTier`, etc. excluded |
| `reviews/{reviewId}` create | Author only | PASS | `isOwner(request.resource.data.authorUid)` + fraud field guards |
| `reviews/{reviewId}` update | Author only (pre-verification) | PASS | `verifiedAt == null` immutability gate |
| `follows/{followId}` | Follower only | PASS | `request.resource.data.followerId == request.auth.uid` + composite ID check |
| `reviews/.../votes/{voterUid}` | Voter only | PASS | `isOwner(voterUid)` + `voterUid == request.auth.uid` on data |
| `pointsLedger` | Server only | PASS | `allow write: if false` |
| `reservations` | Server only | PASS | All write rules `if false`; callable enforces validation |
| `userBalances` | Server only | PASS | `allow write: if false` |
| `conversations` update | Participant; metadata fields only | PASS | `hasOnly([lastMessageText, lastMessageAt, ...])` |

### 1.3 IDOR Finding

No IDOR vulnerabilities found in Firestore rules. Ownership checks use `request.auth.uid` comparisons at both the document-path level (isOwner helper) and field-value level (`resource.data.userId == request.auth.uid`).

---

## 2. App Check Enforcement

App Check (`firebase_app_check: ^0.3.1+4`) is declared in `pubspec.yaml`.

### 2.1 Cloud Functions — enforceAppCheck Coverage

**Correctly enforced (enforceAppCheck: true present):**

| Function / Module | File |
|---|---|
| `updateProfile` | `http/updateProfile.ts` |
| `checkUsernameAvailable` | `http/checkUsernameAvailable.ts` |
| `completeOnboarding` | `http/completeOnboarding.ts` |
| `getMyReferralCode` | `http/getMyReferralCode.ts` |
| `validateReferralCodePublic` | `http/validateReferralCodePublic.ts` |
| `adminGetReferralStats` | `http/adminGetReferralStats.ts` |
| `applyReferralCode` | `http/applyReferralCode.ts` |
| `submitReview` (domain) | `reviews/submit.ts` |
| `verifyReceipt` | `integrations/ocr/verifyReceipt.ts` |
| `geo` callables | `establishments/geo.ts` |
| `claiming` callables | `establishments/claiming.ts` |
| `profile` callables | `users/profile.ts` |
| `redemption` callables | `deals/redemption.ts` |
| `redeemGiftCard` | `integrations/giftcards/redeem.ts` |
| `fingerprint` callables | `integrations/antiFraud/fingerprint.ts` |
| `referral stats` (domain) | `domains/referrals/stats.ts` |
| `referral codes` (domain) | `domains/referrals/codes.ts` |
| auth helpers | `lib/auth.ts` |

**MISSING enforceAppCheck — 28 functions use `onCall(async` without an options object:**

All 28 functions in `functions/src/http/` that match `onCall(async` without a preceding `{enforceAppCheck: true}` options block are unprotected. Confirmed examples:

- `createReservation.ts` — uses `onCall(async (request) => {` with no options object
- `cancelReservation.ts`, `verifyCheckIn.ts`, `getReservations.ts`
- `getDeals.ts`, `redeemDeal.ts`, `createConversation.ts`, `sendMessage.ts`
- `getMessages.ts`, `getConversations.ts`, `getHomeFeed.ts`, `getDiscoverFeed.ts`
- `searchVenues.ts`, `searchUsers.ts`, `searchContent.ts`
- `registerFCMToken.ts`, `unregisterFCMToken.ts`
- `markConversationRead.ts`, `deleteMessage.ts`, `deleteNotification.ts`
- `getNotifications.ts`, `markNotificationsRead.ts`, `updateNotificationPreferences.ts`
- `getAvailableSlots.ts`, `createDeal.ts`, `deactivateDeal.ts`
- `getRedemptionHistory.ts`, `getLedgerHistory.ts` (and more)

**Severity: P1.** These functions are callable from any client without a valid App Check token. They all check `request.auth` so unauthenticated calls are blocked, but non-App-Check-attested clients (emulators, modified APKs) can invoke them freely.

---

## 3. File Upload Validation — Storage Rules

**File:** `storage.rules`

| Check | Status | Detail |
|---|---|---|
| Max file size enforced | PASS | `request.resource.size <= 10 * 1024 * 1024` (10 MB) on all write paths |
| MIME type whitelist | PASS | `['image/jpeg', 'image/png', 'image/webp']` — no other types accepted |
| Owner-scoped profile writes | PASS | `users/{uid}/profile.jpg` — `isOwner(uid)` required |
| Review photo ownership | PASS | `reviews/{reviewId}/{uid}/{filename}` — `isOwner(uid)` on write |
| Establishment photo auth | PASS | Any authenticated user can write (crowd-sourced); `canWriteImage()` enforced |
| Path traversal prevention | PASS | Catch-all `users/{uid}/{allPaths=**}` → `allow read, write: if false` |
| Default deny catch-all | PASS | `/{allPaths=**}` → `allow read, write: if false` |
| MIME type can be spoofed by client | NOTE | Firebase Storage accepts the `Content-Type` header from the uploader. Server-side MIME validation (e.g. magic-byte check via Cloud Storage trigger) is not implemented. This is low-risk for images but worth noting for v2. |
| Video upload not permitted | PASS | No `video/*` MIME in allowlist; video uploads to Storage are blocked by rule |

---

## 4. Sensitive Data in Logs

### 4.1 Structured Logger (`lib/logging.ts`)

The custom `log` module explicitly prohibits PII in its header comment:
> "PII (email, phone, UAR, fingerprint vector) must NEVER be logged."

`log.info`, `log.warn`, `log.error` all pass through `makeEntry()` which does not auto-serialize request bodies. Log context is typed as `LogContext` which only accepts `string | number | boolean | null | undefined` values.

Reviewed log call sites across domain functions: log calls pass `traceId`, `userId` (UID only, not email), `domain`, and `eventId`. No email, phone number, UAR score, or fingerprint vector was found in any structured log call. PASS.

### 4.2 console.* Usage in Integration Modules

Several integration files use raw `console.log/error/warn` instead of the structured logger:

| File | Calls | PII Risk |
|---|---|---|
| `integrations/algolia/indexing.ts` | 10 calls | Low — logs UID and duration only; `indexUser` comment notes "Private fields (UAR, email, phone, fingerprint) are excluded" |
| `integrations/algolia/client.ts` | 2 calls | Low — config warnings only |
| `integrations/antiFraud/fingerprint.ts` | 4 calls | Medium — fingerprint module; review logs to confirm no vector values emitted |
| `integrations/antiFraud/recaptcha.ts` | 2 calls | Low — error codes only |
| `integrations/rekognition/client.ts` | 1 call | Low — moderation label results |
| `media/photoTrigger.ts` | 8 calls | Low — file paths and moderation flags |
| `integrations/ocr/harness.ts` | 1 call | Low — test case IDs |

**Recommendation (P2):** Migrate all `console.*` calls in integration modules to the structured `log` utility for consistent PII governance and structured search in Cloud Logging.

### 4.3 Flutter Client — debugPrint

`DeepLinkService` uses `debugPrint` which is stripped in release builds (`kDebugMode` conditional compilation applies). No PII observed in debugPrint calls — only Branch link URLs and routing type names.

`FirestoreService` and other service classes use `debugPrint` for error reporting; no PII values observed. PASS for release builds.

---

## 5. Certificate Pinning

**Status: NOT IMPLEMENTED — Recommended for v2**

Firebase SDK for Flutter uses TLS with system trust store. Certificate pinning is not configured. This is acceptable for v1 given:
- Firebase endpoints are served over Google's infrastructure
- App Check provides an additional attestation layer

**Recommendation (v2):** Implement certificate pinning via the `ssl_pinning_plugin` or custom `HttpClient` override for any non-Firebase HTTP endpoints (Algolia, Tremendous, Mindee OCR). Evaluate whether Branch.io SDK supports pinning configuration.

---

## 6. Hardcoded Secrets Scan

### 6.1 Dart / Flutter (`zupurb_app/lib/`)

| Finding | File | Type | Severity |
|---|---|---|---|
| Firebase Web API key (Android dev) `AIzaSyBUrv8pDykIFORoqpm9DdYzb_t3fcdAl_c` | `lib/firebase_options.dart` | Firebase Web API Key | P2 — See note |
| Firebase Web API key (iOS dev) `AIzaSyCGDy_sKAsaDffZt37psBbRfV9CcJ_zw8E` | `lib/firebase_options.dart` | Firebase Web API Key | P2 — See note |
| All other keys (`MAPS_API_KEY`, `ALGOLIA_APP_ID`, `ALGOLIA_SEARCH_KEY`, `POSTHOG_API_KEY`, `REVENUECAT_API_KEY_IOS`, `REVENUECAT_API_KEY_ANDROID`, `FPJS_API_KEY`) | Various service files | Build-time `--dart-define` | PASS — not hardcoded |

**Note on firebase_options.dart:** Firebase Web API keys in `firebase_options.dart` are generated by the FlutterFire CLI and are NOT equivalent to backend secrets. They identify the Firebase project to the SDK and are protected by Firebase Security Rules and App Check. They are intentionally committed per Firebase's own guidance. However, the file currently contains only the `zupurb-dev` project keys. Production keys (`zupurb-prod`) must be generated separately and supplied via flavors/build-time substitution — they must NOT be committed to source control. This is a P2 reminder, not a current vulnerability.

### 6.2 TypeScript / Cloud Functions (`functions/src/`)

| Finding | File | Type | Severity |
|---|---|---|---|
| Fallback secret literal `"zupurb_dev_qr_secret_replace_in_prod"` | `deals/jwtUtil.ts` | HMAC signing secret fallback | P1 — See note |
| All other secrets (TREMENDOUS, ALGOLIA, MINDEE, etc.) | Various | `process.env.*` | PASS — read from environment |

**Note on jwtUtil.ts P1:** The fallback string `"zupurb_dev_qr_secret_replace_in_prod"` is returned when `DEAL_QR_SECRET` is not set. The comment acknowledges this is for the local emulator only. However, if the production deployment ever launches without setting this secret in GCP Secret Manager, deal QR tokens will be signed with the known fallback key, making them forgeable. A pre-deploy check or startup assertion must verify `DEAL_QR_SECRET` is set before the function starts in non-emulator environments.

### 6.3 Test Files

`__tests__/ocr/accuracyHarness.test.ts` sets `process.env.MINDEE_API_KEY = "test-key-harness"` for test isolation. This is a placeholder test value, not a real key. PASS.

---

## 7. Deep Link Validation — Branch.io

**File:** `lib/core/services/deep_link_service.dart`

| Check | Status | Notes |
|---|---|---|
| Branch SDK initialized with `useTestKey: kDebugMode` | PASS | Test key used in debug builds automatically |
| `+clicked_branch_link` guard before routing | PASS | Organic app opens do not trigger routing |
| Route type validated before navigation | PASS | `switch (type)` with explicit cases; unknown types ignored |
| `id` / `uid` / `code` parameters validated non-empty | PASS | `if (id == null || id.isEmpty) return` on all routes |
| Referral code persisted to SharedPreferences | PASS | Survives cold start; picked up by SignUpScreen |
| No URL injection risk in router calls | PASS | GoRouter paths use string interpolation with validated IDs; no dynamic scheme injection |
| Branch keys are placeholders (not real keys) in code | PASS | `key_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` placeholders in comments; real keys go in AndroidManifest/Info.plist |
| `assetlinks.json` / AASA hosting noted but not verified | NOTE | These files must be hosted at `https://zupurb.app/.well-known/` before store submission; not verifiable from codebase alone |
| Universal Link / App Link host restricted to `zupurb.app` | PASS | Setup instructions restrict `android:host="zupurb.app"`; no wildcard hosts |

---

## 8. Authentication Token Handling

| Check | Status | Notes |
|---|---|---|
| Firebase ID token used for all authenticated calls | PASS | `FirebaseAuth` tokens automatically attached by Firebase SDK to callable function calls |
| Tokens never stored to disk | PASS | Firebase SDK manages token lifecycle in secure storage; no manual persistence in codebase |
| Token refresh handled by SDK | PASS | Firebase SDK auto-refreshes tokens before expiry |
| `request.auth` checked at top of every Cloud Function | PASS (for reviewed functions) | All reviewed callables throw `unauthenticated` if `!request.auth` |
| Social login tokens (Google, Apple, Facebook) not stored | PASS | `AuthService` completes the Firebase sign-in credential exchange and does not retain provider tokens |
| OTP plaintext never stored | PASS | `createReservation.ts` returns OTP once then only stores `otpCodeHash` (SHA-256 hex) |
| QR payload contains no sensitive data beyond reservation ID | PASS | `buildQrPayload` encodes `reservationId`, `estId`, `guestUid`, `scheduledAt` — no financial or auth data |
| Stub HMAC on QR (base64 only, no signature) | NOTE | Comment in `createReservation.ts` says "replace with HMAC-SHA256 in B9". Until B9 ships, QR payloads can be constructed by any party who knows the reservation ID format. Track as P1. |
| ATT prompt before analytics SDK fires | PASS | `att_prompt_screen.dart` + `app_tracking_transparency: ^2.0.6` declared in pubspec |

---

## 9. MobSF Static Analysis

Run the following before store submission:

```
mobsf analyze --source release/app-release.apk --report mobsf_report_vX.Y.Z.html
mobsf analyze --source Runner.ipa --report mobsf_report_ios_vX.Y.Z.html
```

Key checks MobSF will surface:
- Exported Activities / Services / Receivers without permission guards
- Hardcoded strings matching secret patterns (cross-check §6 above)
- Insecure SharedPreferences usage
- Insecure random number generators
- Backup flag (`android:allowBackup`) — should be `false` or use `fullBackupContent` exclusions
- Network Security Config — verify `cleartextTrafficPermitted=false` for release
- WebView JavaScript enabled / file access flags

MobSF must pass with zero High findings before store submission is approved.

---

## 10. Summary Status Table

| Category | Status | Highest Severity Finding |
|---|---|---|
| IDOR — Firestore read rules | PASS | — |
| IDOR — Firestore write rules | PASS | — |
| App Check enforcement | PARTIAL FAIL | P1 — 28 functions missing `enforceAppCheck: true` |
| Storage rules — size limit | PASS | — |
| Storage rules — MIME type | PASS | — |
| PII in structured logs | PASS | — |
| PII in console.* calls | WARNING | P2 — migrate to structured logger |
| Certificate pinning | NOT IMPLEMENTED | P2 — recommended for v2 |
| Hardcoded secrets — Dart | PASS (with P2 note) | P2 — prod Firebase keys must not be committed |
| Hardcoded secrets — TypeScript | WARNING | P1 — jwtUtil.ts fallback secret |
| Deep link validation | PASS | — |
| Authentication token handling | PASS (with P1 note) | P1 — QR HMAC stub (tracked in B9) |
| MobSF static scan | NOT RUN | Run on release APK/IPA before submission |
