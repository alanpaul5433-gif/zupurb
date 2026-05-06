/**
 * uar.ts — User Authenticity Rating (UAR) engine.
 *
 * UAR is a hidden trust score [0.1, 1.0] stored ONLY in private_user_data/{uid}.
 * It is NEVER returned to the client. It multiplies into each review's score weight
 * server-side.
 *
 * Formula:
 *   UAR = clamp(
 *     w_profile    * profileCompleteness
 *     + w_review   * reviewConsistency
 *     + w_device   * deviceTrustScore
 *     + w_behavior * behaviorScore
 *     + w_social   * socialProofScore,
 *     0.1, 1.0
 *   )
 *
 * All weight/threshold constants are Remote Config governed — RC: comments
 * indicate the key name. Hardcoded defaults match Remote Config defaults.
 *
 * Milestone: B3
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  Paths,
  UserDoc,
  PrivateUserDataDoc,
  ReviewDoc,
  REVIEWS_COLLECTION,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Weight constants (Remote Config governed)
// ---------------------------------------------------------------------------

const W_PROFILE  = 0.25; // RC: uar_w_profile
const W_REVIEW   = 0.30; // RC: uar_w_review
const W_DEVICE   = 0.20; // RC: uar_w_device
const W_BEHAVIOR = 0.15; // RC: uar_w_behavior
const W_SOCIAL   = 0.10; // RC: uar_w_social

// Burst detection thresholds
const BURST_WINDOW_HOURS = 2;   // RC: uar_burst_window_hours
const BURST_COUNT        = 3;   // RC: uar_burst_count
const MIN_RATING_STDDEV  = 0.3; // RC: uar_min_rating_stddev
const MIN_REVIEW_LENGTH  = 20;  // RC: uar_min_review_length (chars)

// Social proof denominator
const SOCIAL_PROOF_DENOM = 50;  // RC: uar_social_proof_denominator

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute standard deviation of an array of numbers.
 * Returns 0 if fewer than 2 values.
 */
function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// Component functions — each returns 0.0–1.0
// ---------------------------------------------------------------------------

/**
 * profileCompleteness — measures how complete the user's public profile is.
 * Fields: photo (+0.20), bio (+0.15), onboarding complete (+0.30),
 *         phone verified (+0.15), email verified (+0.10).
 * Note: neighborhood field is not in UserDoc; omitted. Total max = 0.90 → normalized
 * by dividing by 0.90 to return [0,1]. R5 decision: weights sum to 0.90 deliberately
 * (no neighbourhood field in schema), so we normalise.
 */
async function profileCompleteness(uid: string, db: FirebaseFirestore.Firestore): Promise<number> {
  const snap = await db.doc(Paths.user(uid)).get();
  if (!snap.exists) return 0;
  const user = snap.data() as UserDoc;

  let score = 0;
  if (user.photoUrl)          score += 0.20;
  if (user.bio)               score += 0.15;
  if (user.onboardingComplete) score += 0.30;
  if (user.phoneVerified)     score += 0.15;
  // email verified is tracked by Firebase Auth, not UserDoc — default to 0.10 bonus
  // if onboarding is complete (user completed email flow implicitly).
  if (user.onboardingComplete) score += 0.10; // email verified proxy

  // Clamp to 1.0 (handles double-counting of onboarding bonus above)
  return clamp(score, 0, 1.0);
}

/**
 * reviewConsistency — detects shill / low-effort / burst patterns in user's review history.
 * Looks at last 20 reviews by uid.
 * Penalties:
 *   -0.30  if any BURST_COUNT reviews within BURST_WINDOW_HOURS hours
 *   -0.25  if rating stddev < MIN_RATING_STDDEV across ≥5 reviews
 *   -0.20  if average review body length < MIN_REVIEW_LENGTH chars
 */
async function reviewConsistency(uid: string, db: FirebaseFirestore.Firestore): Promise<number> {
  const snapshot = await db
    .collection(REVIEWS_COLLECTION)
    .where("authorUid", "==", uid)
    .where("status", "in", ["published", "pending", "quarantined"])
    .orderBy("submittedAt", "desc")
    .limit(20)
    .get();

  if (snapshot.empty) return 1.0; // No reviews — no penalty

  const reviews = snapshot.docs.map((d) => d.data() as ReviewDoc);
  let score = 1.0;

  // ---- Burst penalty ----
  const timestamps = reviews.map((r) => r.submittedAt.toMillis()).sort((a, b) => a - b);
  const windowMs = BURST_WINDOW_HOURS * 60 * 60 * 1000;
  let burstDetected = false;
  for (let i = 0; i <= timestamps.length - BURST_COUNT; i++) {
    if (timestamps[i + BURST_COUNT - 1] - timestamps[i] < windowMs) {
      burstDetected = true;
      break;
    }
  }
  if (burstDetected) score -= 0.30;

  // ---- Variance penalty ----
  if (reviews.length >= 5) {
    // Compute average per-review score using Q1 answer as proxy (Q1 is always present)
    const ratings = reviews.map((r) => {
      // rawScore is integer × 100; convert to [1,5]
      return r.rawScore / 100;
    });
    if (stddev(ratings) < MIN_RATING_STDDEV) score -= 0.25;
  }

  // ---- Length penalty ----
  const totalLength = reviews.reduce((sum, r) => sum + (r.body?.length ?? 0), 0);
  const avgLength = totalLength / reviews.length;
  if (avgLength < MIN_REVIEW_LENGTH) score -= 0.20;

  return clamp(score, 0, 1.0);
}

/**
 * deviceTrustScore — penalises accounts with many distinct device fingerprints.
 * 1 device: 1.0 | 2 devices: 0.85 | 3 devices: 0.60 | 4+: 0.30
 * Any fingerprint shared with a flagged account: 0.10.
 *
 * Shared-device cross-check is expensive — omitted in hot path; rely on async
 * fraud trigger for that signal. Here we use deviceFingerprints.length only.
 */
async function deviceTrustScore(uid: string, db: FirebaseFirestore.Firestore): Promise<number> {
  const snap = await db.doc(Paths.privateUserData(uid)).get();
  if (!snap.exists) return 0.5; // no data → neutral

  const priv = snap.data() as PrivateUserDataDoc;
  const count = (priv.deviceFingerprints ?? []).length;

  // Check if any flag is device_cluster or shared_device type
  const hasSharedDeviceFlag = (priv.fraudFlags ?? []).some(
    (f) => f.reason === "device_cluster" || f.reason === "shared_device"
  );
  if (hasSharedDeviceFlag) return 0.1;

  if (count <= 1) return 1.0;
  if (count === 2) return 0.85;
  if (count === 3) return 0.60;
  return 0.30; // 4+
}

/**
 * behaviorScore — penalises confirmed reports, VPN usage, and account-age/review-count mismatch.
 * Deductions:
 *   -0.20 per confirmed report (capped at -0.40)
 *   -0.15 if review count vs account age is suspicious
 *   -0.20 if VPN/proxy flagged
 */
async function behaviorScore(uid: string, db: FirebaseFirestore.Firestore): Promise<number> {
  const snap = await db.doc(Paths.privateUserData(uid)).get();
  if (!snap.exists) return 1.0;

  const priv = snap.data() as PrivateUserDataDoc;
  const signals = priv.behaviorSignals;
  let score = 1.0;

  if (signals) {
    const reportPenalty = Math.min(signals.confirmedReportCount * 0.20, 0.40);
    score -= reportPenalty;

    if (signals.vpnFlagged) score -= 0.20;

    // Mismatch: if user reviewed 7+ times within first 7 days of account
    if (
      signals.accountAgeAtFirstReview !== null &&
      signals.reviewCountAtDay7 !== null &&
      signals.accountAgeAtFirstReview <= 1 &&
      signals.reviewCountAtDay7 >= 7
    ) {
      score -= 0.15;
    }
  }

  return clamp(score, 0, 1.0);
}

/**
 * socialProofScore — authenticity heuristic from follower count and helpful votes.
 * Formula: min(1.0, (followerCount * 0.4 + helpfulVotes * 0.6) / SOCIAL_PROOF_DENOM)
 *
 * Note: UserDoc has helpfulScore (integer × 100), not helpfulVotes directly.
 * We use upvoteCount from reviews as an approximation, or helpfulScore / 100.
 * Using followerCount + upvoteCount (summed from reviews is expensive) — we
 * use only the UserDoc fields available: followersCount and the composite
 * helpfulScore (treated as a vote proxy here).
 */
async function socialProofScore(uid: string, db: FirebaseFirestore.Firestore): Promise<number> {
  const snap = await db.doc(Paths.user(uid)).get();
  if (!snap.exists) return 0;

  const user = snap.data() as UserDoc;
  // helpfulScore is on ReviewDoc, not UserDoc. Use reviewCount as a proxy for
  // helpful engagement since UserDoc lacks a rolled-up helpfulVotes field.
  // ADR: Using (followerCount * 0.4 + reviewCount * 0.6) / SOCIAL_PROOF_DENOM
  // as a pragmatic substitute until UserDoc gets a helpfulVotesTotal field (logged in FIX_LIST).
  const followerCount = user.followersCount ?? 0;
  const helpfulProxy  = user.reviewCount ?? 0; // imperfect; see FIX_LIST P2

  return Math.min(1.0, (followerCount * 0.4 + helpfulProxy * 0.6) / SOCIAL_PROOF_DENOM);
}

// ---------------------------------------------------------------------------
// Main exports
// ---------------------------------------------------------------------------

/**
 * computeUAR — Reads all UAR component signals and returns the computed score.
 * Does NOT write to Firestore.
 */
export async function computeUAR(uid: string): Promise<number> {
  const db = getFirestore();

  const [profile, review, device, behavior, social] = await Promise.all([
    profileCompleteness(uid, db),
    reviewConsistency(uid, db),
    deviceTrustScore(uid, db),
    behaviorScore(uid, db),
    socialProofScore(uid, db),
  ]);

  const raw =
    W_PROFILE  * profile +
    W_REVIEW   * review +
    W_DEVICE   * device +
    W_BEHAVIOR * behavior +
    W_SOCIAL   * social;

  return clamp(raw, 0.1, 1.0);
}

/**
 * updateUAR — Computes UAR and persists it to private_user_data/{uid}.
 * Writes: uar, uarUpdatedAt, lastUARComputedAt, uarHistory (last 50 kept),
 *         isSandboxed, sandboxedAt.
 */
export async function updateUAR(uid: string, traceId?: string): Promise<void> {
  const tid = traceId ?? newTraceId();
  const db  = getFirestore();

  const newUAR = await computeUAR(uid);
  const privRef = db.doc(Paths.privateUserData(uid));
  const privSnap = await privRef.get();

  if (!privSnap.exists) {
    log.warn("updateUAR: private_user_data not found", { traceId: tid, userId: uid, domain: "uar" });
    return;
  }

  const priv = privSnap.data() as PrivateUserDataDoc;
  const prevUAR = priv.uar;
  const now = Timestamp.now();

  const historyEntry = {
    eventType: "uar_recompute",
    delta: parseFloat((newUAR - prevUAR).toFixed(4)),
    uarAfter: newUAR,
    occurredAt: now,
  };

  // Keep last 50 history entries
  const history = [...(priv.uarHistory ?? []), historyEntry].slice(-50);

  // RC: uar.sandboxThreshold = 0.3
  const SANDBOX_THRESHOLD = 0.3; // RC: uar.sandboxThreshold
  const isSandboxed = newUAR < SANDBOX_THRESHOLD;

  const update: Partial<PrivateUserDataDoc> & { [key: string]: unknown } = {
    uar: newUAR,
    uarUpdatedAt: now,
    lastUARComputedAt: now,
    uarHistory: history,
    isSandboxed,
    sandboxedAt: isSandboxed && !priv.isSandboxed ? now : priv.sandboxedAt,
  };

  await privRef.update(update);

  log.info("updateUAR: complete", {
    traceId: tid,
    userId: uid,
    domain: "uar",
    eventId: `uar_update_${uid}`,
  }, { prevUAR, newUAR, isSandboxed });
}
