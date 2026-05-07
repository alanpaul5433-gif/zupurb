# Zupurb — T8 Security Audit Report

**Date:** 2026-05-07
**Milestone:** T8 Security Audit
**Auditor:** QA Agent (Sonnet 4.6)
**Scope:** `firestore.rules`, `storage.rules`, `functions/src/` (TypeScript Cloud Functions), `zupurb_app/lib/` (Flutter/Dart)
**Full checklist:** `zupurb_app/test/security/security_checklist.md`
**IDOR tests:** `zupurb_app/test/security/idor_test.dart`

---

## Findings Summary

| ID | Category | Result | Severity |
|---|---|---|---|
| SEC-01 | IDOR — Firestore ownership rules | PASS | — |
| SEC-02 | App Check enforcement on Cloud Functions | FAIL | P1 |
| SEC-03 | Storage rules — size + MIME validation | PASS | — |
| SEC-04 | Hardcoded secrets — jwtUtil.ts fallback secret | FAIL | P1 |
| SEC-05 | App Check — debug providers active in all builds | FAIL | P1 |
| SEC-06 | Plus paywall server-side enforcement gap | FAIL | P1 |
| SEC-07 | pointsLedger client-create uncapped | FAIL | P1 |
| SEC-08 | Hardcoded secrets — firebase_options.dart | PASS with note | P2 |
| SEC-09 | PII in structured logs (lib/logging.ts) | PASS | — |
| SEC-10 | PII in console.* calls (integration modules) | WARNING | P2 |
| SEC-11 | Deep link validation (Branch.io) | PASS | — |
| SEC-12 | Authentication token handling | PASS | — |
| SEC-13 | QR payload unsigned (tracked in B9) | WARNING | P1 |
| SEC-14 | Certificate pinning | NOT IMPLEMENTED | P2 (v2 rec.) |
| SEC-15 | MobSF static scan | NOT RUN | Required pre-submission |

---

## P0 Issues — Block Ship

None identified.

---

## P1 Issues — Must Fix Before Release

### P1-SEC-001: App Check not enforced on 28 Cloud Functions

**Files:** All files in `functions/src/http/` using `onCall(async (request) =>` without an options object.

**Confirmed examples:** `createReservation.ts`, `cancelReservation.ts`, `verifyCheckIn.ts`, `getHomeFeed.ts`, `sendMessage.ts`, `redeemDeal.ts` (plus 22 more — full list in `security_checklist.md` §2.1).

**Detail:** These functions use the two-argument `onCall(async ...)` form with no options object and therefore do not set `enforceAppCheck: true`. The correct pattern used by 18 other functions in the codebase:

```typescript
export const myFunction = onCall(
  { region: 'us-central1', enforceAppCheck: true },
  async (request) => { ... }
);
```

Without enforcement, App Check attestation is not verified — the functions are callable from emulators, modified APKs, and scripted bots. All calls are still blocked if unauthenticated (Firebase Auth check present), but device-level integrity attestation is bypassed.

**Fix:** Add `{ region: 'us-central1', enforceAppCheck: true }` as the first argument. Must be done after SEC-003 (debug providers fix) or legitimate clients will be rejected. Backend-dev agent owns.

---

### P1-SEC-002: Fallback HMAC secret hardcoded in jwtUtil.ts

**File:** `functions/src/deals/jwtUtil.ts` line 35.

**Detail:** `getSecret()` returns the literal `"zupurb_dev_qr_secret_replace_in_prod"` when `DEAL_QR_SECRET` is not set. If production launches without this env var set in GCP Secret Manager, deal QR tokens are signed with a publicly known key and can be forged by anyone who reads the source.

**Fix:**

```typescript
function getSecret(): string {
  const secret = process.env.DEAL_QR_SECRET;
  if (!secret) {
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      return 'zupurb_dev_qr_secret_replace_in_prod';
    }
    throw new Error(
      'DEAL_QR_SECRET must be set in production. Configure via GCP Secret Manager.'
    );
  }
  return secret;
}
```

Add `DEAL_QR_SECRET` to the deployment runbook pre-flight checklist. Backend-dev or release-engineer agent owns.

---

### P1-SEC-003: App Check debug providers active in all builds

**File:** `zupurb_app/lib/core/firebase/firebase_init.dart`.

**Detail:** `androidProvider: AndroidProvider.debug` and `appleProvider: AppleProvider.debug` are set unconditionally (both wrapped in `TODO(D1)` comments with no runtime condition). Debug providers accept any token, providing zero bot/abuse protection for any build including production.

**Fix:**

```dart
androidProvider: kReleaseMode ? AndroidProvider.playIntegrity : AndroidProvider.debug,
appleProvider:   kReleaseMode ? AppleProvider.deviceCheck     : AppleProvider.debug,
```

Must be done before P1-SEC-001 is applied, or `enforceAppCheck: true` will reject legitimate release builds. Frontend-dev agent owns.

---

### P1-SEC-004: Plus paywall not enforced server-side in redeemDeal

**File:** `functions/src/http/redeemDeal.ts` (and `deals/redemption.ts`).

**Detail:** `submitReview.ts` correctly calls `isPlusActive(uid)` server-side for the 1.25× multiplier. However `redeemDeal` does not check `deal.isPlusRequired` server-side. If a deal is marked Plus-only, the restriction lives only in the client UI. A user on a jailbroken device or via direct HTTP call can redeem Plus-gated deals without a subscription.

**Fix:** Before the eligibility transaction in `redeemDeal`, add:

```typescript
if (deal.isPlusRequired) {
  const isPlus = await isPlusActive(uid);
  if (!isPlus) throw new HttpsError('permission-denied', 'This deal requires Zupurb Plus.');
}
```

Backend-dev agent owns.

---

### P1-SEC-005: pointsLedger allows uncapped client-create

**Finding:** Pre-existing from prior audit pass (SEC-03 in previous report).

The Firestore rules currently (or previously) permitted client-create on `pointsLedger`. The current rules file shows `allow write: if false` — confirming this was either already fixed or the previous finding was based on an earlier rule version. **Verify** in the live project that `allow write: if false` is deployed. If the prior P1 finding was valid and the rules file here is already the fix, mark resolved. No change needed in current `firestore.rules` as read.

---

### P1-SEC-006: QR payload lacks signature (B9 tracked)

**File:** `functions/src/http/createReservation.ts`, `buildQrPayload()`.

**Detail:** QR payloads are plain base64 JSON with no HMAC. The code comment acknowledges: "TODO: replace with HMAC-SHA256 in B9." Until B9 ships, QR codes can be constructed for known reservation IDs. The `jwtUtil.ts` HMAC infrastructure (P1-SEC-002 fix) should be reused here.

**Status:** Accepted technical debt tracking to B9. Must not be deferred past beta.

---

## P2 Issues — Recommended Improvements

### P2-SEC-001: console.* in integration modules should use structured logger

**Files:** `functions/src/integrations/algolia/indexing.ts`, `antiFraud/fingerprint.ts`, `rekognition/client.ts`, `media/photoTrigger.ts`, and others (10 files, ~30 call sites).

Replace all `console.*` with `log.info / log.warn / log.error` from `lib/logging.ts` to enforce PII governance at the type level and produce structured Cloud Logging output.

---

### P2-SEC-002: Production Firebase options must not be committed

**File:** `zupurb_app/lib/firebase_options.dart`.

Currently contains only `zupurb-dev` keys — acceptable. When `zupurb-prod` keys are generated, they must be supplied via build flavors and excluded from source control via `.gitignore`. Do not commit production Firebase options.

---

### P2-SEC-003: Storage MIME validation is client-declared

**File:** `storage.rules`.

`request.resource.contentType` is declared by the uploader and is not independently verified against magic bytes. A Cloud Storage trigger that checks file magic bytes and deletes non-conforming files is recommended for v2.

---

### P2-SEC-004: Certificate pinning for non-Firebase endpoints (v2)

Non-Firebase HTTP endpoints (Algolia, Tremendous, Mindee, PostHog) are not certificate-pinned. Recommended after initial launch stabilises.

---

## MobSF Note

Run `mobsf analyze` on the release APK (Android) and IPA (iOS) before store submission:

```bash
# Android
mobsf analyze --source release/app-release.apk --report docs/mobsf_android_vX.Y.Z.html

# iOS
mobsf analyze --source Runner.ipa --report docs/mobsf_ios_vX.Y.Z.html
```

Key MobSF checks:
- Zero High-severity findings required before proceeding
- `android:allowBackup="false"` or explicit `fullBackupContent` exclusion rules
- `cleartextTrafficPermitted=false` in Network Security Config for release builds
- No exported components without explicit permission guards
- No insecure WebView configuration (JS enabled + file access enabled simultaneously)
- Backup flag and `FLAG_SECURE` on sensitive screens (e.g. reservation QR, OTP entry)

---

## Bugs Filed

The following items are filed (or confirmed) in `docs/FIX_LIST.md` under the Security section:

| Bug ID | Severity | Title | Owner |
|---|---|---|---|
| BUG-SEC-01 | P1 | App Check debug providers not conditioned on kReleaseMode | Frontend |
| BUG-SEC-02 | P1 | 28 Cloud Functions missing enforceAppCheck: true | Backend |
| BUG-SEC-03 | P1 | jwtUtil.ts fallback HMAC secret reachable in production | Backend |
| BUG-SEC-04 | P1 | redeemDeal does not enforce Plus entitlement server-side | Backend |
| BUG-SEC-05 | P1 | QR payload unsigned — complete HMAC in B9 | Backend/Integrations |
| BUG-SEC-06 | P2 | console.* in integration modules bypasses PII logging governance | Backend |

---

## Audit Artefacts

| Artefact | Path |
|---|---|
| Full security checklist | `zupurb_app/test/security/security_checklist.md` |
| IDOR integration tests | `zupurb_app/test/security/idor_test.dart` |
| This report | `docs/SECURITY_AUDIT.md` |
