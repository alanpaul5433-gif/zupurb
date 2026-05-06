/**
 * onReviewWrite.ts — Firestore onDocumentWritten trigger on reviews/{reviewId}.
 *
 * B3 scope: Anti-fraud checks only.
 * B4 will add the full review fan-out logic (score recalc, points, badges, etc.).
 *
 * Fraud checks run asynchronously after the review document write:
 *   1. Burst detection   — 3+ reviews within 2-hour window
 *   2. Self-review       — reviewer is listed as establishment owner
 *   3. Duplicate content — SHA-256 hash of normalized review body matches prior
 *
 * After any flag: updateUAR(uid) is called to persist the updated UAR.
 *
 * Idempotency: each check uses deterministic flagId patterns; duplicate triggers
 * are safe to retry — duplicate flags are deduplicated by flagId before appending.
 *
 * Domain: fraud / reviews
 * Milestone: B3
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";
import {
  Paths,
  ReviewDoc,
  EstablishmentDoc,
  PrivateUserDataDoc,
  FraudFlag,
  FraudFlagReason,
  REVIEWS_COLLECTION,
} from "../lib/schema";
import { updateUAR } from "../algorithms/uar";
import { computeRollingScore } from "../algorithms/scoring";
import { log, newTraceId } from "../lib/logging";

setGlobalOptions({ region: "us-central1" });

// ---------------------------------------------------------------------------
// Thresholds (Remote Config governed)
// ---------------------------------------------------------------------------

const BURST_WINDOW_HOURS = 2;   // RC: uar_burst_window_hours
const BURST_COUNT        = 3;   // RC: uar_burst_count

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise text for deduplication: lowercase, collapse whitespace. */
function normaliseText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** SHA-256 hash of normalised review body. */
function hashReviewBody(body: string): string {
  return crypto.createHash("sha256").update(normaliseText(body)).digest("hex");
}

/**
 * Append a fraud flag to private_user_data/{uid}.fraudFlags if not already present.
 * Uses flagId to detect duplicates (idempotent).
 */
async function appendFraudFlag(
  uid: string,
  flag: FraudFlag,
  db: FirebaseFirestore.Firestore
): Promise<void> {
  const privRef  = db.doc(Paths.privateUserData(uid));
  const privSnap = await privRef.get();
  if (!privSnap.exists) return;

  const priv = privSnap.data() as PrivateUserDataDoc;
  const existing = priv.fraudFlags ?? [];

  // Idempotency: skip if flagId already present
  if (existing.some((f) => f.flagId === flag.flagId)) return;

  await privRef.update({
    fraudFlags: FieldValue.arrayUnion(flag),
  });
}

// ---------------------------------------------------------------------------
// Check 1: Burst detection
// ---------------------------------------------------------------------------

async function checkBurst(
  uid: string,
  reviewId: string,
  db: FirebaseFirestore.Firestore,
  traceId: string
): Promise<boolean> {
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - BURST_WINDOW_HOURS);
  const windowTs = Timestamp.fromDate(windowStart);

  const snap = await db
    .collection(REVIEWS_COLLECTION)
    .where("authorUid", "==", uid)
    .where("submittedAt", ">=", windowTs)
    .get();

  if (snap.size >= BURST_COUNT) {
    log.warn("onReviewWriteFraudCheck: burst detected", {
      traceId,
      userId: uid,
      eventId: reviewId,
      domain: "fraud",
    }, { reviewCountInWindow: snap.size });

    const flag: FraudFlag = {
      flagId: `burst_${uid}_${windowTs.seconds}`,
      reason: "review_burst" as FraudFlagReason,
      reviewId,
      detectedAt: Timestamp.now(),
      resolvedAt: null,
      resolvedBy: null,
    };

    await appendFraudFlag(uid, flag, db);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Check 2: Self-review detection
// ---------------------------------------------------------------------------

async function checkSelfReview(
  uid: string,
  reviewId: string,
  estId: string,
  db: FirebaseFirestore.Firestore,
  traceId: string
): Promise<boolean> {
  const estSnap = await db.doc(Paths.establishment(estId)).get();
  if (!estSnap.exists) return false;

  const est = estSnap.data() as EstablishmentDoc;

  // Check if reviewer is the claimed owner
  if (est.claimedByUid && est.claimedByUid === uid) {
    log.warn("onReviewWriteFraudCheck: self-review detected", {
      traceId,
      userId: uid,
      eventId: reviewId,
      domain: "fraud",
    }, { estId });

    // Flag the review itself
    const reviewRef = db.doc(Paths.review(reviewId));
    await reviewRef.update({
      isFraudFlagged: true,
      updatedAt: Timestamp.now(),
    });

    const flag: FraudFlag = {
      flagId: `self_review_${uid}_${reviewId}`,
      reason: "self_review" as FraudFlagReason,
      reviewId,
      detectedAt: Timestamp.now(),
      resolvedAt: null,
      resolvedBy: null,
    };

    await appendFraudFlag(uid, flag, db);
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Check 3: Duplicate content detection
// ---------------------------------------------------------------------------

async function checkDuplicate(
  uid: string,
  reviewId: string,
  body: string | null,
  db: FirebaseFirestore.Firestore,
  traceId: string
): Promise<boolean> {
  if (!body || body.trim().length === 0) return false;

  const bodyHash = hashReviewBody(body);

  // Query reviews by same user with the same content hash
  // Note: bodyHash field is set on the review document by the submit callable (B4).
  // For now we compute and compare here; B4 will write bodyHash at submission time.
  const snap = await db
    .collection(REVIEWS_COLLECTION)
    .where("authorUid", "==", uid)
    .where("bodyHash", "==", bodyHash)
    .where("reviewId", "!=", reviewId) // exclude current review
    .limit(1)
    .get();

  if (!snap.empty) {
    log.warn("onReviewWriteFraudCheck: duplicate content detected", {
      traceId,
      userId: uid,
      eventId: reviewId,
      domain: "fraud",
    }, { bodyHash });

    const flag: FraudFlag = {
      flagId: `dup_${uid}_${bodyHash.slice(0, 16)}`,
      reason: "duplicate_review" as FraudFlagReason,
      reviewId,
      detectedAt: Timestamp.now(),
      resolvedAt: null,
      resolvedBy: null,
    };

    await appendFraudFlag(uid, flag, db);
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Exported trigger
// ---------------------------------------------------------------------------

/**
 * onReviewWriteFraudCheck — Runs anti-fraud checks on every review write.
 * Combined with B4's fan-out trigger in index.ts via separate exports.
 */
export const onReviewWriteFraudCheck = onDocumentWritten(
  "reviews/{reviewId}",
  async (event) => {
    const traceId  = newTraceId();
    const reviewId = event.params.reviewId;

    // Only process creates and updates; skip deletes
    const afterSnap = event.data?.after;
    if (!afterSnap?.exists) return;

    const review = afterSnap.data() as ReviewDoc;
    const uid    = review.authorUid;
    const estId  = review.estId;

    // Skip already-flagged reviews (avoid re-processing quarantined docs)
    if (review.status === "removed") return;

    log.info("onReviewWriteFraudCheck: start", {
      traceId,
      userId: uid,
      eventId: reviewId,
      domain: "fraud",
    });

    const db = getFirestore();
    let anyFlagged = false;

    try {
      const [burst, selfReview, duplicate] = await Promise.all([
        checkBurst(uid, reviewId, db, traceId),
        checkSelfReview(uid, reviewId, estId, db, traceId),
        checkDuplicate(uid, reviewId, review.body, db, traceId),
      ]);

      anyFlagged = burst || selfReview || duplicate;
    } catch (err) {
      log.error("onReviewWriteFraudCheck: check error", {
        traceId,
        userId: uid,
        eventId: reviewId,
        domain: "fraud",
      }, { error: String(err) });
    }

    if (anyFlagged) {
      try {
        await updateUAR(uid, traceId);
      } catch (err) {
        log.error("onReviewWriteFraudCheck: updateUAR error", {
          traceId,
          userId: uid,
          eventId: reviewId,
          domain: "fraud",
        }, { error: String(err) });
      }
    }

    // B4 extension: trigger rolling score recompute after fraud checks complete.
    // This runs regardless of fraud flag status — score must reflect new review.
    // Cloud Tasks will replace this direct call in B7.
    try {
      await computeRollingScore(estId, traceId);
    } catch (err) {
      log.error("onReviewWriteFraudCheck: rolling score recompute failed", {
        traceId,
        userId: uid,
        eventId: reviewId,
        domain: "fraud",
      }, { error: String(err) });
    }

    log.info("onReviewWriteFraudCheck: complete", {
      traceId,
      userId: uid,
      eventId: reviewId,
      domain: "fraud",
    }, { anyFlagged });
  }
);
