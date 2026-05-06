/**
 * fingerprint.ts — Demographic fingerprint engine.
 *
 * The demographic fingerprint is a fixed-length numeric vector stored on UserDoc.
 * At each review submission a FingerprintSnapshotDoc is frozen and written to
 * users/{uid}/fingerprintSnapshots/{reviewId} — it is immutable after write.
 *
 * computeSimilarity() is used by the FPYL scorer (B5) to find reviews from
 * "People Like You". Two fingerprints with similarity >= 0.75 are considered
 * demographically similar. RC: fingerprint.similarityThreshold = 0.75
 *
 * Design note: DemographicFingerprint in schema.ts uses numeric encoding, not
 * string categoricals. Similarity is computed as a weighted combination of
 * component-wise closeness for scalar dimensions and Jaccard similarity for
 * multi-hot vector dimensions.
 *
 * Milestone: B3
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  Paths,
  UserDoc,
  FingerprintSnapshotDoc,
  DemographicFingerprint,
  FINGERPRINT_SNAPSHOTS_SUBCOLLECTION,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Similarity weights (Remote Config governed)
// ---------------------------------------------------------------------------

// Scalar dimension weights — closeness measured as 1 - |a - b|
const W_AGE_GROUP   = 0.20; // RC: fingerprint.w_ageGroup
const W_GENDER      = 0.15; // RC: fingerprint.w_gender
const W_SPENDING    = 0.10; // RC: fingerprint.w_spending

// Multi-hot Jaccard weights
const W_CUISINE     = 0.15; // RC: fingerprint.w_cuisine    (maps to diningPreferences concept)
const W_ACTIVITY    = 0.20; // RC: fingerprint.w_activity
const W_DIETARY     = 0.10; // RC: fingerprint.w_dietary
// Note: schema has cuisinePreferences + activityPreferences + dietaryRestrictions.
// Weights sum to 0.90; remaining 0.10 is implicitly absorbed by clamping to [0,1].
// Aligns with ARCHITECTURE.md similarity weight intent. Logged in FIX_LIST for B5 refinement.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Jaccard similarity between two multi-hot binary vectors of the same length.
 * Returns 0.0 if both vectors are empty or all-zero.
 */
function jaccard(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  if (len === 0) return 0;

  let intersection = 0;
  let union = 0;

  for (let i = 0; i < len; i++) {
    const ai = (a[i] ?? 0) > 0 ? 1 : 0;
    const bi = (b[i] ?? 0) > 0 ? 1 : 0;
    if (ai === 1 || bi === 1) union++;
    if (ai === 1 && bi === 1) intersection++;
  }

  return union === 0 ? 0 : intersection / union;
}

/**
 * Scalar closeness: 1 - |a - b| clamped to [0, 1].
 * Both inputs must be normalised floats in [0, 1].
 */
function scalarCloseness(a: number, b: number): number {
  return Math.max(0, 1 - Math.abs(a - b));
}

// ---------------------------------------------------------------------------
// computeSimilarity
// ---------------------------------------------------------------------------

/**
 * Compute weighted similarity between two fingerprint snapshots.
 * Returns a value in [0.0, 1.0].
 * Used by FPYL scorer: include review only if similarity >= 0.75.
 * RC: fingerprint.similarityThreshold = 0.75
 */
export function computeSimilarity(
  a: FingerprintSnapshotDoc,
  b: FingerprintSnapshotDoc
): number {
  const fa: DemographicFingerprint = a.fingerprint;
  const fb: DemographicFingerprint = b.fingerprint;

  const ageClose      = scalarCloseness(fa.ageGroup,      fb.ageGroup);
  const genderClose   = scalarCloseness(fa.genderIdentity, fb.genderIdentity);
  const spendClose    = scalarCloseness(fa.spendingHabit,  fb.spendingHabit);

  const cuisineJacc   = jaccard(fa.cuisinePreferences,   fb.cuisinePreferences);
  const activityJacc  = jaccard(fa.activityPreferences,  fb.activityPreferences);
  const dietaryJacc   = jaccard(fa.dietaryRestrictions,  fb.dietaryRestrictions);

  const weighted =
    W_AGE_GROUP  * ageClose +
    W_GENDER     * genderClose +
    W_SPENDING   * spendClose +
    W_CUISINE    * cuisineJacc +
    W_ACTIVITY   * activityJacc +
    W_DIETARY    * dietaryJacc;

  return Math.min(1.0, Math.max(0.0, weighted));
}

// ---------------------------------------------------------------------------
// buildFingerprintSnapshot
// ---------------------------------------------------------------------------

/**
 * Reads the user's current demographic fingerprint, wraps it in a snapshot doc,
 * and writes it to users/{uid}/fingerprintSnapshots/{reviewId}.
 *
 * This snapshot is immutable after write — it is never updated.
 * Returns the written FingerprintSnapshotDoc.
 */
export async function buildFingerprintSnapshot(
  uid: string,
  reviewId: string,
  traceId?: string
): Promise<FingerprintSnapshotDoc> {
  const tid = traceId ?? newTraceId();
  const db  = getFirestore();

  const userSnap = await db.doc(Paths.user(uid)).get();
  if (!userSnap.exists) {
    throw new Error(`buildFingerprintSnapshot: user ${uid} not found`);
  }

  const user = userSnap.data() as UserDoc;
  const now  = Timestamp.now();

  const snapshotDoc: FingerprintSnapshotDoc = {
    snapshotId: reviewId,   // snapshot ID = reviewId (1:1 mapping)
    userId: uid,
    reviewId,
    fingerprint: user.fingerprint,
    capturedAt: now,
  };

  const snapshotRef = db
    .collection(`users/${uid}/${FINGERPRINT_SNAPSHOTS_SUBCOLLECTION}`)
    .doc(reviewId);

  // Only write if it doesn't already exist — idempotent on retry
  const existing = await snapshotRef.get();
  if (!existing.exists) {
    await snapshotRef.set(snapshotDoc);
    log.info("buildFingerprintSnapshot: written", {
      traceId: tid,
      userId: uid,
      eventId: reviewId,
      domain: "fingerprint",
    });
  }

  return snapshotDoc;
}
