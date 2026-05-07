/**
 * integrations/antiFraud/fingerprint.ts — I11 Anti-Fraud (FingerprintJS Pro).
 *
 * Thin wrapper around Firestore storage for device fingerprints received from
 * the client via the fpjs_pro_plugin SDK. The vendor call (FingerprintJS Pro
 * server-side API) is intentionally not included here — the client SDK handles
 * the fingerprint collection; this module owns the storage and lookup layer.
 *
 * Exported callable (registered in index.ts):
 *   storeDeviceFingerprint — callable; stores fingerprint data to
 *     private_user_data/{uid} (merge). Called once after successful sign-up.
 *
 * Exported helper (used by other domains):
 *   checkFingerprintConflict — checks if a visitorId is already associated
 *     with a different uid. Used by referral self-referral detection and
 *     fraud layer 2.
 *
 * Firestore target (per ARCHITECTURE.md §2 Sensitive Data Handling):
 *   private_user_data/{userId}  — admin-only reads
 *     deviceFingerprints: FingerprintEntry[]  (append-only array)
 *
 * Cost tagging: This function performs Firestore reads/writes only.
 * No paid external API calls at runtime — cost is standard Firestore ops.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FingerprintEntry {
  /** FingerprintJS Pro visitorId — stable per device + browser. */
  visitorId: string;
  /** Confidence score from FingerprintJS Pro (0.0 – 1.0). */
  confidence: number;
  /** FingerprintJS Pro requestId — used for server-side verification. */
  requestId: string;
  /** ISO timestamp when this fingerprint was recorded. */
  recordedAt: string;
  /** Context in which the fingerprint was captured. */
  context: "signup" | "review_submit" | "referral_redeem";
}

interface StoreFingerprintPayload {
  visitorId: string;
  confidence: number;
  requestId: string;
  context?: FingerprintEntry["context"];
}

interface ConflictResult {
  conflict: boolean;
  conflictUid?: string;
}

// ---------------------------------------------------------------------------
// Callable: storeDeviceFingerprint
// ---------------------------------------------------------------------------

/**
 * Stores a device fingerprint entry to `private_user_data/{uid}`.
 *
 * Called from the Flutter app immediately after sign-up completes:
 *   await FirebaseFunctions.instance
 *       .httpsCallable('storeDeviceFingerprint')
 *       .call({ visitorId, confidence, requestId, context: 'signup' });
 *
 * Idempotent: repeated calls for the same requestId append another entry
 * (FingerprintJS Pro requestIds are unique per call, so duplicates are rare).
 * If strict deduplication is needed, callers should check before calling.
 */
export const storeDeviceFingerprint = onCall(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "auth/required");
    }

    const uid = request.auth.uid;
    const payload = request.data as StoreFingerprintPayload;

    // Input validation
    if (typeof payload.visitorId !== "string" || !payload.visitorId.trim()) {
      throw new HttpsError("invalid-argument", "validation/visitorId-required");
    }
    if (
      typeof payload.confidence !== "number" ||
      payload.confidence < 0 ||
      payload.confidence > 1
    ) {
      throw new HttpsError(
        "invalid-argument",
        "validation/confidence-out-of-range"
      );
    }
    if (typeof payload.requestId !== "string" || !payload.requestId.trim()) {
      throw new HttpsError("invalid-argument", "validation/requestId-required");
    }

    const entry: FingerprintEntry = {
      visitorId: payload.visitorId.trim(),
      confidence: payload.confidence,
      requestId: payload.requestId.trim(),
      recordedAt: new Date().toISOString(),
      context: payload.context ?? "signup",
    };

    const db = getFirestore();
    const startMs = Date.now();

    try {
      await db.doc(`private_user_data/${uid}`).set(
        {
          deviceFingerprints: FieldValue.arrayUnion(entry),
          latestVisitorId: entry.visitorId,
          latestFingerprintAt: entry.recordedAt,
        },
        { merge: true }
      );

      console.info(
        JSON.stringify({
          domain: "antiFraud",
          eventType: "storeDeviceFingerprint",
          uid,
          visitorId: entry.visitorId,
          confidence: entry.confidence,
          context: entry.context,
          durationMs: Date.now() - startMs,
          success: true,
        })
      );

      return { stored: true };
    } catch (err) {
      console.error(
        JSON.stringify({
          domain: "antiFraud",
          eventType: "storeDeviceFingerprint",
          uid,
          error: String(err),
          durationMs: Date.now() - startMs,
          success: false,
        })
      );
      throw new HttpsError("internal", "vendor/down");
    }
  }
);

// ---------------------------------------------------------------------------
// Helper: checkFingerprintConflict
// ---------------------------------------------------------------------------

/**
 * Checks whether [visitorId] is already associated with a uid other than
 * [excludeUid]. Used by:
 *   - `referrals/applyReferralCode` — self-referral detection.
 *   - Fraud Layer 2 — coordinated account detection.
 *
 * Implementation: queries `private_user_data` where `latestVisitorId` matches.
 * This is an O(1) indexed read when the field is indexed; add a composite
 * index on `latestVisitorId` in firestore.indexes.json if query fan-out grows.
 *
 * @param visitorId  The device fingerprint to look up.
 * @param excludeUid The uid to exclude from the conflict check (the caller's own uid).
 * @param db         Firestore instance (injected for testability).
 * @returns          { conflict: true, conflictUid: '<uid>' } or { conflict: false }
 */
export async function checkFingerprintConflict(
  visitorId: string,
  excludeUid: string,
  db: FirebaseFirestore.Firestore
): Promise<ConflictResult> {
  if (!visitorId || visitorId === "fpjs-not-configured") {
    // Stub fingerprint from dev/unconfigured builds — never conflicts.
    return { conflict: false };
  }

  const startMs = Date.now();
  try {
    const snapshot = await db
      .collection("private_user_data")
      .where("latestVisitorId", "==", visitorId)
      .limit(5)
      .get();

    const conflictDoc = snapshot.docs.find((doc) => doc.id !== excludeUid);

    console.info(
      JSON.stringify({
        domain: "antiFraud",
        eventType: "checkFingerprintConflict",
        visitorId,
        excludeUid,
        conflict: !!conflictDoc,
        conflictUid: conflictDoc?.id ?? null,
        durationMs: Date.now() - startMs,
        success: true,
      })
    );

    if (conflictDoc) {
      return { conflict: true, conflictUid: conflictDoc.id };
    }
    return { conflict: false };
  } catch (err) {
    console.error(
      JSON.stringify({
        domain: "antiFraud",
        eventType: "checkFingerprintConflict",
        visitorId,
        excludeUid,
        error: String(err),
        durationMs: Date.now() - startMs,
        success: false,
      })
    );
    // Fail-open: if the conflict check fails, don't block the user action.
    // Fraud Layer 2 will catch it asynchronously.
    return { conflict: false };
  }
}

// Re-export Auth for use in other anti-fraud modules without importing Admin directly.
export { getAuth };
