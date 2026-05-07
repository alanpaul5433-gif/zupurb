/**
 * caps.ts — Review rate-limit enforcement.
 *
 * checkWeeklyReviewCap(uid, establishmentId, db)
 *   Enforces two caps:
 *     1. Max reviews per user per rolling 7-day window
 *        RC: review_weekly_cap (default 7)
 *     2. Max reviews per user per establishment per rolling 30-day window
 *        RC: fraud_max_reviews_per_est_30days (default 1)
 *
 * Called before any review write. Returns { allowed: boolean, reason?: string }.
 *
 * Idempotency: Read-only; safe to call multiple times.
 * The private_user_data doc stores (reviewsThisWeek, weeklyCapWindowStart) which
 * is updated by the review submission callable (B4) after a successful write.
 * This function only reads — the submission callable owns the increment.
 *
 * Milestone: B3
 */

import { Timestamp } from "firebase-admin/firestore";
import {
  Paths,
  PrivateUserDataDoc,
  REVIEWS_COLLECTION,
} from "../lib/schema";

// ---------------------------------------------------------------------------
// Thresholds (Remote Config governed)
// ---------------------------------------------------------------------------

const WEEKLY_CAP       = 7;  // RC: review_weekly_cap
const ROLLING_30_CAP   = 1;  // RC: fraud_max_reviews_per_est_30days
const WINDOW_7_DAYS_MS = 7  * 24 * 60 * 60 * 1000;
const WINDOW_30_DAYS_MS= 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface CapCheckResult {
  allowed: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// checkWeeklyReviewCap
// ---------------------------------------------------------------------------

/**
 * Returns { allowed: true } when the user is within all review caps.
 * Returns { allowed: false, reason } when any cap is exceeded.
 *
 * @param uid             Reviewer's uid.
 * @param establishmentId Establishment being reviewed.
 * @param db              Firestore instance (dependency-injected).
 */
export async function checkWeeklyReviewCap(
  uid: string,
  establishmentId: string,
  db: FirebaseFirestore.Firestore
): Promise<CapCheckResult> {
  const now = Date.now();

  // ---- Cap 1: rolling 7-day global review count ----
  // Prefer private_user_data cached counter for cheapness.
  // Falls back to live query if private_user_data is missing.
  const privSnap = await db.doc(Paths.privateUserData(uid)).get();

  if (privSnap.exists) {
    const priv         = privSnap.data() as PrivateUserDataDoc;
    const windowStart  = priv.weeklyCapWindowStart?.toMillis() ?? 0;
    const windowAgeMs  = now - windowStart;
    const reviewsInWindow = windowAgeMs < WINDOW_7_DAYS_MS ? priv.reviewsThisWeek : 0;

    if (reviewsInWindow >= WEEKLY_CAP) {
      return {
        allowed: false,
        reason: `Weekly review cap reached (${reviewsInWindow}/${WEEKLY_CAP}). Try again next week.`,
      };
    }
  } else {
    // Fallback: live query the reviews collection
    const weekStart = Timestamp.fromMillis(now - WINDOW_7_DAYS_MS);
    const weekSnap = await db
      .collection(REVIEWS_COLLECTION)
      .where("authorUid", "==", uid)
      .where("submittedAt", ">=", weekStart)
      .limit(WEEKLY_CAP + 1) // +1 to detect exceeding without counting all
      .get();

    if (weekSnap.size >= WEEKLY_CAP) {
      return {
        allowed: false,
        reason: `Weekly review cap reached (${weekSnap.size}/${WEEKLY_CAP}). Try again next week.`,
      };
    }
  }

  // ---- Cap 2: rolling 30-day per-establishment cap ----
  const monthStart = Timestamp.fromMillis(now - WINDOW_30_DAYS_MS);
  const estSnap = await db
    .collection(REVIEWS_COLLECTION)
    .where("authorUid", "==", uid)
    .where("estId", "==", establishmentId)
    .where("submittedAt", ">=", monthStart)
    .limit(ROLLING_30_CAP + 1)
    .get();

  if (estSnap.size >= ROLLING_30_CAP) {
    return {
      allowed: false,
      reason: `You've already reviewed this place recently. You can review it again in 30 days.`,
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// incrementWeeklyReviewCount
// ---------------------------------------------------------------------------

/**
 * Increment the weekly review counter on private_user_data.
 * Resets the window if it has expired (>7 days since windowStart).
 *
 * Called by the review submission callable (B4) after a successful write.
 * Idempotent: re-calling increments again — caller must ensure single-call per review.
 *
 * @param uid   Reviewer's uid.
 * @param db    Firestore instance.
 */
export async function incrementWeeklyReviewCount(
  uid: string,
  db: FirebaseFirestore.Firestore
): Promise<void> {
  const privRef  = db.doc(Paths.privateUserData(uid));
  const privSnap = await privRef.get();
  if (!privSnap.exists) return;

  const priv        = privSnap.data() as PrivateUserDataDoc;
  const now         = Date.now();
  const windowStart = priv.weeklyCapWindowStart?.toMillis() ?? 0;
  const windowAgeMs = now - windowStart;

  if (windowAgeMs >= WINDOW_7_DAYS_MS) {
    // Reset window
    await privRef.update({
      reviewsThisWeek: 1,
      weeklyCapWindowStart: Timestamp.now(),
    });
  } else {
    await privRef.update({
      reviewsThisWeek: (priv.reviewsThisWeek ?? 0) + 1,
    });
  }
}
