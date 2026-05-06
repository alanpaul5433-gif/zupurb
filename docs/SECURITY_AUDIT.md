# Zupurb — Security Audit T8

**Date:** 2026-05-06
**Auditor:** QA / Testing Agent (qa-tester)
**Milestone:** T8 — Security
**Scope:** Firestore rules IDOR, Cloud Functions UID validation, client-side bypass, App Check enforcement.

---

## Summary Table

| ID | Area | Finding | Severity | Status |
|---|---|---|---|---|
| SEC-01 | Firestore / `users` | Public profile readable by all authenticated users — private sub-collections guarded correctly | INFO | Pass |
| SEC-02 | Firestore / `private_user_data` | Admin-only; no client read/write path | — | Pass |
| SEC-03 | Firestore / `pointsLedger` | Clients can create optimistic earn entries — see detail | P1 | Finding |
| SEC-04 | Firestore / `dealRedemptions` | Write: Cloud Function only; read scoped to owner | — | Pass |
| SEC-05 | Firestore / `reviews` | Horizontal IDOR blocked; score fields blocked client-side; `verifiedAt` immutability enforced | — | Pass |
| SEC-06 | Firestore / `reservations` | `guestUid` pinned to `request.auth.uid` on create; protected fields blocked | — | Pass |
| SEC-07 | Firestore / `conversations` + `messages` | Participant-only read; `senderUid` pinned to auth uid | — | Pass |
| SEC-08 | Firestore / `userBadges` | Duplicate `allow write` rules — first `if false` is shadowed by second `if isAdmin()` | INFO | Pass (harmless) |
| SEC-09 | Firestore / `establishmentScores` | Duplicate `allow write` rules — same shadowing pattern as SEC-08 | INFO | Pass (harmless) |
| SEC-10 | Cloud Function / `submitReview` | `authorUid` sourced from `request.auth.uid`; Zod schema strips any body-injected uid | — | Pass |
| SEC-11 | Cloud Function / `createReservation` | `guestUid` sourced from `request.auth.uid` | — | Pass |
| SEC-12 | Cloud Function / `redeemDeal` | `userId` sourced from `request.auth.uid`; eligibility checked against server-side Firestore data only | — | Pass |
| SEC-13 | Cloud Function / `verifyCheckIn` | `callerUid` from `request.auth.uid`; guest/staff check performed against stored `guestUid` | — | Pass |
| SEC-14 | Client-side bypass / Plus paywall | Plus gating is client-side optimistic; server-side `isPlusActive()` called inside `submitReview` for multiplier; `redeemDeal` does NOT gate on Plus — see detail | P1 | Finding |
| SEC-15 | App Check / Flutter init | Production attestation providers set via `TODO(D1)` — debug providers active in all current builds | P1 | Finding |
| SEC-16 | App Check / Cloud Functions | High-value callables (`submitReview`, `createReservation`, `redeemDeal`, `verifyCheckIn`, `sendMessage`, and ~40 others) do NOT set `enforceAppCheck: true` | P1 | Finding |
| SEC-17 | Cloud Function / `validateReferralCodePublic` | Explicitly sets `enforceAppCheck: false` — acceptable; runs in pre-auth context | INFO | Pass |

---

## Detailed Findings

---

### SEC-01 — `users/{userId}` public read by authenticated users

**Status: Pass**

`allow read: if isAuthenticated()` makes all user documents readable by any signed-in user. This is intentional (public profile). Sensitive data is in `private_user_data`, which has admin-only access. The client `update` rule uses `hasOnly([...])` to restrict writable fields to safe display fields only — score, UAR, tier, ban status, and verification fields are not included.

No horizontal privilege escalation exists for reads (any user can view any profile). This matches the product design (social app with public profiles) and is not a vulnerability.

---

### SEC-02 — `private_user_data/{userId}`

**Status: Pass**

`allow read, write: if isAdmin()` — no client path. Cloud Functions use the Admin SDK which bypasses these rules. Owner cannot read their own `private_user_data` document from the client SDK. Correct.

---

### SEC-03 — `pointsLedger/{entryId}` client-create allowed

**Status: P1 Finding**

The rule allows authenticated clients to create ledger entries for themselves with `type` values drawn from a hardcoded allowlist (all earn types plus spend types). The comment says these are "optimistic" entries that the Cloud Function reconciles. However:

- A client can create a `earn_review_verified` entry with any `delta` value, pointing to any `relatedEntityId`.
- The `userBalances/{userId}` collection is write-protected (Cloud Function only), so the balance projection will not reflect client-created entries immediately. However, if the Cloud Function reconciliation logic blindly trusts existing ledger entries rather than recomputing from source-of-truth events, a client could inflate their perceived balance.
- The `type` field is constrained to an allowlist, but `delta` is only validated to be `!= 0` — there is no upper-bound cap on delta from the client.

**Risk:** If the Cloud Function `getBalance` reads the `userBalances` projection (which is Admin SDK–written only), the fake client entry has no effect on balance. However if any code path sums raw ledger entries client-side or server-side without cross-checking `userBalances`, the fake entries are visible.

**Recommendation:** Remove client-create permission from `pointsLedger` entirely. All writes should go through Cloud Functions. If optimistic UI is needed, implement it using local state in the Flutter app without writing to Firestore.

---

### SEC-04 — `dealRedemptions/{redemptionId}`

**Status: Pass**

`allow write: if false` — all writes via Cloud Function Admin SDK only. Owner-scoped reads enforced with `resource.data.userId == request.auth.uid`. No horizontal read access.

---

### SEC-05 — `reviews/{reviewId}`

**Status: Pass**

- `allow create` pins `authorUid` to `request.auth.uid` via `isOwner(request.resource.data.authorUid)`.
- Score fields (`rawScore`, `weightFactor`, `uarAtSubmission`) are explicitly blocked on client create.
- `status` must start as `"pending"` or `"draft"`, never `"published"` from the client.
- `allow update` checks `resource.data.verifiedAt == null` — once verification is set by the Cloud Function, the document is client-immutable.
- `authorUid` and `estId` cannot be changed on update.

No IDOR or score-manipulation vectors found.

---

### SEC-06 — `reservations/{reservationId}`

**Status: Pass**

`allow create` enforces `request.resource.data.guestUid == request.auth.uid`. Protected fields (`checkInQrCode`, `checkInOtp`, `noShowRecordedAt`, `noShowPenaltyApplied`) are blocked on client create. `allow update: if false` — all transitions owned by Cloud Function.

---

### SEC-07 — `conversations` + `messages`

**Status: Pass**

- Conversation read: `isParticipant(resource.data)` — only the two parties can read.
- Message create: `request.resource.data.senderUid == request.auth.uid` — sender cannot spoof another uid.
- The `isParticipant` check for message create uses a `get()` call on the parent conversation document, making it a server-verified check.
- Client update of conversation is restricted to metadata fields only via `hasOnly([...])`.

---

### SEC-08 — `userBadges` duplicate write rules (INFO)

Two rules apply to `userBadges/{userId}/badges/{badgeId}`:
```
allow write: if false;
allow write: if isAdmin();
```
In Firestore rules, the second rule shadows the first. Effective behavior: admins can write, no one else can. This is the intended outcome, but the `if false` line is misleading dead code. No security impact.

---

### SEC-09 — `establishmentScores` duplicate write rules (INFO)

Same pattern as SEC-08. No security impact, but the `if false` line is dead code.

---

### SEC-10 — `submitReview` UID handling

**Status: Pass**

Line 97: `const uid = request.auth.uid;`

The `SubmitReviewSchema` (Zod) does not include `authorUid`, `uid`, or `userId` — any client-injected uid field is silently stripped. The ReviewDoc is constructed with `authorUid: uid` where `uid` is always from `request.auth`. The Firestore security rule provides a second enforcement layer.

---

### SEC-11 — `createReservation` UID handling

**Status: Pass**

Line 95: `const uid = request.auth.uid;`

`CreateReservationSchema` does not include a uid field. `guestUid` in the written `ReservationDoc` is set to `uid` from auth context. Idempotency check also scopes by `uid`: `.where("guestUid", "==", uid)`.

---

### SEC-12 — `redeemDeal` UID handling and eligibility

**Status: Pass**

Line 63: `const uid = request.auth.uid;`

`RedeemDealSchema` accepts only `{ dealId, idempotencyKey }` — no eligibility, pointCost, or userId fields. Eligibility is determined by:
1. `deal.pointCost` read from `deals/{dealId}` (Admin-written, read-only to clients).
2. `userBalances/{uid}.balance` read inside the Firestore transaction (Admin-written, not client-writable).
3. `deal.maxRedemptionsPerUser` and redemption count queried server-side.

No client-side bypass vector exists in the function itself.

---

### SEC-13 — `verifyCheckIn` UID handling

**Status: Pass**

Line 73: `const callerUid = request.auth.uid;`

The function loads the reservation from Firestore, then checks `callerUid === res.guestUid` (line 111). A caller cannot check in another user's reservation — they would need to present a token with the correct `guestUid`. OTP is stored as SHA-256 hash; plaintext is never persisted.

---

### SEC-14 — Plus paywall client-side bypass risk

**Status: P1 Finding**

`isPlusActiveProvider` in `iap_providers.dart` is documented as "CLIENT-SIDE ONLY — used for optimistic UI." The server-side `isPlusActive()` function (in `lib/plus.ts`) reads `plusActive` and `plusActiveUntil` from Firestore (`users/{uid}`) using the Admin SDK.

Current enforcement:
- `submitReview.ts` calls `isPlusActive(uid)` server-side to apply the 1.25× multiplier — **correctly enforced**.
- `redeemDeal.ts` does NOT call `isPlusActive(uid)` before checking Plus-gated deal access. The `deal.isPlusRequired` field (if present in `DealDoc`) is not validated in the current `redeemDeal` implementation.
- The Flutter paywall widget gates the UI but a user who modifies local Riverpod state (e.g., via a modified build or proxy) could bypass the UI gate and reach Plus-gated screens without a valid subscription.

**Risk:** If any deals are marked as Plus-only and that restriction is enforced only in the client UI, a jailbroken device user or network proxy user can call `redeemDeal` directly and redeem Plus-gated deals without a subscription.

**Recommendation:** Add a server-side Plus entitlement check in `redeemDeal.ts` when `deal.isPlusRequired === true`. Gate the check in the same transaction where eligibility is verified.

---

### SEC-15 — App Check: debug providers active in all builds

**Status: P1 Finding**

`firebase_init.dart` lines 29–33:
```dart
androidProvider: AndroidProvider.debug,
appleProvider: AppleProvider.debug,
```
Both are wrapped in `TODO(D1)` comments but there is no `kReleaseMode` conditional — the debug provider is used in **all** build configurations, including any builds distributed to testers or production. Debug providers accept any token, providing no protection against bot or reverse-engineered API abuse.

**Recommendation:** Wrap in a compile-time constant:
```dart
androidProvider: kReleaseMode ? AndroidProvider.playIntegrity : AndroidProvider.debug,
appleProvider:   kReleaseMode ? AppleProvider.deviceCheck     : AppleProvider.debug,
```
This must be done before any beta or production distribution.

---

### SEC-16 — App Check not enforced on high-value Cloud Functions

**Status: P1 Finding**

Only 7 of ~55 callable functions have `enforceAppCheck: true`:
- `adminGetReferralStats`, `applyReferralCode`, `completeOnboarding`, `checkUsernameAvailable`, `getMyReferralCode`, `updateProfile`

The following high-value functions are missing `enforceAppCheck: true`:
- `submitReview` — review creation and points award
- `createReservation` — reservation creation
- `redeemDeal` — points spend and gift card fulfillment
- `verifyCheckIn` — check-in points award
- `sendMessage` — chat
- All read-heavy functions (`getDeals`, `getHomeFeed`, `getDiscoverFeed`, etc.)

Without App Check enforcement on `submitReview` and `redeemDeal`, a bad actor with a reverse-engineered API key can submit fake reviews or drain points via direct HTTP calls from a non-app client (bot, Postman, scripted attack), bypassing all on-device rate limiting and UI gates.

**Recommendation:** Add `enforceAppCheck: true` to at minimum: `submitReview`, `createReservation`, `redeemDeal`, `verifyCheckIn`, `sendMessage`. This should be done in tandem with SEC-15 (fixing debug providers), otherwise enforcement will break legitimate clients.

---

### SEC-17 — `validateReferralCodePublic` App Check disabled

**Status: Pass (acceptable)**

`enforceAppCheck: false` is intentional — this callable is invoked during sign-up before the user has an authenticated App Check token. The comment in source explicitly notes "no enforceAppCheck — pre-auth context." Acceptable. Rate-limit this endpoint separately once the function is in production.

---

## Bugs Filed to FIX_LIST.md

The following items are filed as security findings in `docs/FIX_LIST.md` under a new Security section.

| ID | Severity | Title |
|---|---|---|
| BUG-SEC-01 | P1 | `pointsLedger` allows client-create with uncapped delta — remove client write permission |
| BUG-SEC-02 | P1 | `redeemDeal` does not enforce Plus entitlement server-side for Plus-gated deals |
| BUG-SEC-03 | P1 | App Check debug providers not conditioned on build mode — active in all builds |
| BUG-SEC-04 | P1 | `submitReview`, `createReservation`, `redeemDeal`, `verifyCheckIn` missing `enforceAppCheck: true` |

---

## Files Produced

- `C:\Projects\Zupurb\functions\src\__tests__\security.test.ts` — security unit tests
- `C:\Projects\Zupurb\docs\SECURITY_AUDIT.md` — this document

## TypeScript Check Result

`npx tsc --noEmit` from `C:\Projects\Zupurb\functions\`:

- **security.test.ts**: zero errors.
- 4 pre-existing errors in `ledger.test.ts`, `scoring.test.ts`, `tiers.test.ts`, `uar.test.ts` (unused imports/variables) — pre-dated this audit, out of T8 scope.
