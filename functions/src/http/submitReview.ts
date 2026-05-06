/**
 * submitReview.ts — Primary review submission callable.
 *
 * Called after user completes the 8-question flow + optional written review.
 * Validates input, computes score, writes review doc, awards points, unlocks badges,
 * and enqueues async score recompute.
 *
 * Idempotency: Checks for existing review with same (uid, estId) within 30-day window
 * before writing. Uses server-generated reviewId (UUID) on each new submission.
 * Duplicate bodyHash detection is handled by the B3 fraud trigger.
 *
 * Security: All scoring, eligibility, and point calculations run server-side.
 *           Client-provided score values are validated and clamped.
 *
 * Milestone: B4
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import * as crypto from "crypto";
import { z } from "zod";

import {
  Paths,
  ReviewDoc,
  PrivateUserDataDoc,
  EstablishmentDoc,
  REVIEWS_COLLECTION,
} from "../lib/schema";
import { computeReviewScore, ReviewAnswerInput, computeRollingScore } from "../algorithms/scoring";
import { buildFingerprintSnapshot } from "../algorithms/fingerprint";
import { awardPoints } from "../lib/ledger";
import { unlockBadge, checkAndUnlockBadges } from "../lib/badges";
import { onReviewSubmittedChallenges } from "../lib/challenges";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Zod input schema
// ---------------------------------------------------------------------------

const AnswerSchema = z.object({
  questionId: z.string().regex(/^q[1-8]$/),
  answerId: z.enum(["a", "b", "c", "d"]),
  score: z.number().int().min(1).max(4),
});

const SubmitReviewSchema = z.object({
  establishmentId: z.string().min(1),
  answers: z.array(AnswerSchema).length(8),
  writtenReview: z.string().max(5000).optional(),
  verificationMethod: z.enum(["unverified", "photo"]),
  photoUrls: z.array(z.string().url()).optional(),
  visitDate: z.string().optional(), // ISO date string
});

type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;

// ---------------------------------------------------------------------------
// Constants (Remote Config governed)
// ---------------------------------------------------------------------------

const REVIEW_COOLDOWN_DAYS = 30;           // RC: review_cooldown_days
const POINTS_UNVERIFIED_REVIEW = 25;       // RC: points_unverified_review
const POINTS_VERIFIED_REVIEW = 75;         // RC: points_verified_review
const POINTS_FIRST_REVIEW_BONUS = 150;     // RC: points_first_review_bonus

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const submitReview = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    // 1. Auth check
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to submit a review.");
    }
    const uid = request.auth.uid;

    // 2. Validate input shape
    const parsed = SubmitReviewSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid review payload: ${parsed.error.message}`
      );
    }
    const input: SubmitReviewInput = parsed.data;

    // Photo verification requires photo URLs
    if (input.verificationMethod === "photo" && (!input.photoUrls || input.photoUrls.length === 0)) {
      throw new HttpsError(
        "invalid-argument",
        "Photo URLs required when verificationMethod is 'photo'."
      );
    }

    const db = getFirestore();
    const estId = input.establishmentId;

    log.info("submitReview: start", { traceId, userId: uid, domain: "reviews", eventId: `submit_${uid}` });

    // 3. Check sandbox status — sandboxed users cannot submit
    const privSnap = await db.doc(Paths.privateUserData(uid)).get();
    if (privSnap.exists) {
      const priv = privSnap.data() as PrivateUserDataDoc;
      if (priv.isSandboxed) {
        // Silent no-op: return success-looking response but write nothing
        log.warn("submitReview: user is sandboxed, silent reject", {
          traceId, userId: uid, domain: "reviews", eventId: `submit_${uid}`
        });
        // Return plausible response without writing
        return { reviewId: crypto.randomUUID(), pointsAwarded: 0, badgesUnlocked: [] };
      }
    }

    // 4. Rate limit — max 1 review per establishment per 30 days
    const cooldownStart = Timestamp.fromMillis(
      Date.now() - REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );
    const existingSnap = await db
      .collection(REVIEWS_COLLECTION)
      .where("authorUid", "==", uid)
      .where("estId", "==", estId)
      .where("createdAt", ">", cooldownStart)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      throw new HttpsError(
        "already-exists",
        "You have already reviewed this establishment in the past 30 days."
      );
    }

    // 5. Validate answers count (already enforced by Zod length(8), belt-and-suspenders)
    if (input.answers.length !== 8) {
      throw new HttpsError("invalid-argument", "Exactly 8 answers required.");
    }

    // 6. Fetch establishment to determine category
    const estSnap = await db.doc(Paths.establishment(estId)).get();
    if (!estSnap.exists) {
      throw new HttpsError("not-found", `Establishment ${estId} not found.`);
    }
    const est = estSnap.data() as EstablishmentDoc;
    const estCategory = est.categories?.[0] ?? "restaurant";

    // 7. Compute bodyHash
    const bodyText = input.writtenReview ?? "";
    const bodyHash = sha256(normaliseText(bodyText));

    // 8. Compute per-review score (server-side; client scores are validated but not trusted directly)
    const answers: ReviewAnswerInput[] = input.answers.map((a) => ({
      questionId: a.questionId,
      answerId: a.answerId,
      score: a.score,
    }));
    const reviewScore = computeReviewScore(answers, estCategory, input.verificationMethod);

    // 9. Fetch current UAR snapshot
    let uarSnapshot = 0.5; // RC: uar.default
    if (privSnap.exists) {
      const priv = privSnap.data() as PrivateUserDataDoc;
      uarSnapshot = priv.uar ?? 0.5;
    }

    // 10. Generate review ID
    const reviewId = crypto.randomUUID();
    const now = Timestamp.now();

    // 11. Build fingerprint snapshot (idempotent — B3 algorithm)
    await buildFingerprintSnapshot(uid, reviewId, traceId);

    // 12. Determine verification tier
    const verificationTier = input.verificationMethod === "photo"
      ? "partially_verified"  // photo-based only; "verified" requires OCR receipt (future)
      : "unverified";

    // 13. Write review document
    const reviewDoc: ReviewDoc & { bodyHash: string } = {
      reviewId,
      authorUid: uid,
      estId,
      answers: input.answers.map((a) => a.answerId.toUpperCase()),
      rawScore: reviewScore,
      weightFactor: verificationTier === "partially_verified" ? 75 : 100,
      uarAtSubmission: uarSnapshot,
      verificationTier,
      verifiedAt: input.verificationMethod === "photo" ? now : null,
      fingerprintSnapshotId: reviewId, // 1:1 mapping per buildFingerprintSnapshot
      disclosureCategory: "none",
      title: null,
      body: bodyText.length > 0 ? bodyText : null,
      aiSummary: null,
      aiSummaryGeneratedAt: null,
      mediaIds: [],
      upvoteCount: 0,
      downvoteCount: 0,
      helpfulScore: 0,
      status: "pending",
      flagCount: 0,
      isFeatured: false,
      isAnomalous: false,
      hasQ8Contradiction: false,
      isCoordinatedAttack: false,
      createdAt: now,
      submittedAt: now,
      updatedAt: now,
      schemaVersion: 1,
      bodyHash,
    };

    const batch = db.batch();

    // Write to flat reviews collection
    batch.set(db.doc(Paths.review(reviewId)), reviewDoc);

    // Denormalize into establishments/{estId}/reviews/{reviewId}
    batch.set(db.doc(Paths.estReview(estId, reviewId)), reviewDoc);

    await batch.commit();

    // 14. Fetch user to determine if this is their first review
    const userSnap = await db.doc(Paths.user(uid)).get();
    const currentReviewCount = userSnap.exists
      ? (userSnap.data() as { reviewCount?: number }).reviewCount ?? 0
      : 0;
    const isFirstReview = currentReviewCount === 0;

    // 15. Increment user review count
    await db.doc(Paths.user(uid)).update({
      reviewCount: FieldValue.increment(1),
      ...(verificationTier !== "unverified" ? { verifiedReviewCount: FieldValue.increment(1) } : {}),
      updatedAt: now,
    });

    // 16. Award points
    const basePoints =
      input.verificationMethod === "photo"
        ? POINTS_VERIFIED_REVIEW
        : POINTS_UNVERIFIED_REVIEW;

    let totalPointsAwarded = basePoints;

    await awardPoints(uid, {
      amount: basePoints,
      type: input.verificationMethod === "photo"
        ? "earn_review_partial"
        : "earn_review_unverified",
      description:
        input.verificationMethod === "photo"
          ? "Points for photo-verified review"
          : "Points for unverified review",
      relatedEntityId: reviewId,
      relatedEntityType: "review",
    });

    // 17. Badge unlocks
    const badgesUnlocked: string[] = [];

    if (isFirstReview) {
      // Unlock Taster badge + first-review bonus points
      const tasterResult = await unlockBadge(uid, "taster", traceId);
      if (tasterResult.newlyUnlocked) {
        badgesUnlocked.push("taster");
        await awardPoints(uid, {
          amount: POINTS_FIRST_REVIEW_BONUS,
          type: "earn_badge_unlock",
          description: "First review bonus — Taster badge",
          relatedEntityId: reviewId,
          relatedEntityType: "review",
        });
        totalPointsAwarded += POINTS_FIRST_REVIEW_BONUS;
      }
    }

    if (input.verificationMethod === "photo") {
      const firstBiteResult = await unlockBadge(uid, "first_bite", traceId);
      if (firstBiteResult.newlyUnlocked) {
        badgesUnlocked.push("first_bite");
        if (firstBiteResult.bonusPoints > 0) {
          await awardPoints(uid, {
            amount: firstBiteResult.bonusPoints,
            type: "earn_badge_unlock",
            description: "First verified review — First Bite badge",
            relatedEntityId: reviewId,
            relatedEntityType: "review",
          });
          totalPointsAwarded += firstBiteResult.bonusPoints;
        }
      }
    }

    // 18. Badge progression check — covers critic (10 reviews) + explorer (5 distinct establishments)
    try {
      const additionalBadges = await checkAndUnlockBadges(uid, traceId);
      for (const badgeId of additionalBadges) {
        if (!badgesUnlocked.includes(badgeId)) {
          badgesUnlocked.push(badgeId);
        }
      }
    } catch (err) {
      log.error("submitReview: badge check failed", {
        traceId, userId: uid, domain: "badges", eventId: reviewId,
      }, { error: String(err) });
    }

    // 19. Challenge progression check
    try {
      await onReviewSubmittedChallenges(uid, reviewDoc, traceId);
    } catch (err) {
      log.error("submitReview: challenge check failed", {
        traceId, userId: uid, domain: "challenges", eventId: reviewId,
      }, { error: String(err) });
    }

    // 21. Async rolling score recompute (Cloud Tasks placeholder — direct call for now; B7 moves this to queue)
    try {
      await computeRollingScore(estId, traceId);
    } catch (err) {
      // Non-fatal — score will be recomputed on next review write or by cron
      log.error("submitReview: rolling score recompute failed", {
        traceId, userId: uid, domain: "reviews", eventId: reviewId,
      }, { error: String(err) });
    }

    log.info("submitReview: complete", {
      traceId, userId: uid, domain: "reviews", eventId: reviewId,
    }, { reviewScore, totalPointsAwarded, badgesUnlocked });

    return {
      reviewId,
      pointsAwarded: totalPointsAwarded,
      badgesUnlocked,
    };
  }
);
