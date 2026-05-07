/**
 * reviews/submit.ts — B5 Review Submission callable.
 *
 * This is the authoritative review submission entry point from B5 onward.
 * Replaces the B4 stub at http/submitReview.ts (kept for backward compatibility
 * during transition — see FIX_LIST.md P1).
 *
 * New in B5 vs B4:
 *   - detectQ8Contradiction() run and result stored on the review doc.
 *   - detectStructuralAnomaly() run and result stored on the review doc.
 *   - updateEstablishmentScore() called via reviews/aggregation.ts after write.
 *   - Sandboxed users get sandboxed=true written (not a silent no-op).
 *   - checkWeeklyReviewCap enforced with HttpsError on failure.
 *   - incrementWeeklyReviewCount called after successful write.
 *
 * Security:
 *   - All scoring, eligibility, and point calculations run server-side.
 *   - Client-provided score values are validated and clamped via Zod + scoring.ts.
 *
 * Idempotency:
 *   - Checks for an existing review from the same user at the same establishment
 *     within the 30-day cooldown window before writing.
 *   - Fingerprint snapshot write is idempotent (buildFingerprintSnapshot guards).
 *
 * Milestone: B5
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
  UserDoc,
  REFERRAL_CODES_COLLECTION,
} from "../lib/schema";
import { requireAuth } from "../lib/auth";
import { computeReviewScore, type ReviewAnswerInput } from "../algorithms/scoring";
import { detectQ8Contradiction, detectStructuralAnomaly } from "../algorithms/fraudDetection";
import { buildFingerprintSnapshot } from "../algorithms/fingerprint";
import { checkWeeklyReviewCap, incrementWeeklyReviewCount } from "../moderation/caps";
import { awardPoints } from "../lib/ledger";
import { unlockBadge, checkAndUnlockBadges } from "../lib/badges";
import { onReviewSubmittedChallenges } from "../lib/challenges";
import { getTierMultiplier } from "../lib/tiers";
import { isPlusActive } from "../lib/plus";
import { moderateContent } from "../lib/moderation";
import { sendNotification } from "../lib/notify";
import { updateEstablishmentScore } from "./aggregation";
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
  visitDate: z.string().optional(), // ISO date string; informational only
});

type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;

// ---------------------------------------------------------------------------
// Constants (Remote Config governed — hardcoded defaults)
// ---------------------------------------------------------------------------

const REVIEW_COOLDOWN_DAYS        = 30;  // RC: review_cooldown_days
const POINTS_UNVERIFIED_REVIEW    = 25;  // RC: points_unverified_review
const POINTS_VERIFIED_REVIEW      = 75;  // RC: points_verified_review
const POINTS_FIRST_REVIEW_BONUS   = 150; // RC: points_first_review_bonus
const Q8_CONTRADICTION_THRESHOLD  = 2.0; // RC: q8_contradiction_threshold

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
// submitReview — exported callable
// ---------------------------------------------------------------------------

export const submitReview = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    // enforceAppCheck: true,  // TODO BUG-SEC-04: enable before production
  },
  async (request) => {
    const traceId = newTraceId();

    // 1. Auth check
    const uid = requireAuth(request);

    // 2. Validate input shape
    const parsed = SubmitReviewSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid review payload: ${parsed.error.message}`
      );
    }
    const input: SubmitReviewInput = parsed.data;

    if (input.verificationMethod === "photo" && (!input.photoUrls || input.photoUrls.length === 0)) {
      throw new HttpsError(
        "invalid-argument",
        "Photo URLs are required when verificationMethod is 'photo'."
      );
    }

    const db = getFirestore();
    const estId = input.establishmentId;

    log.info("submitReview: start", {
      traceId,
      userId: uid,
      domain: "reviews",
      eventId: `submit_${uid}`,
    });

    // 3. Load private user data — ban / sandbox / UAR
    const privSnap = await db.doc(Paths.privateUserData(uid)).get();
    let uarSnapshot = 0.5; // RC: uar.default
    let userIsSandboxed = false;

    if (privSnap.exists) {
      const priv = privSnap.data() as PrivateUserDataDoc;

      if (priv.isBanned) {
        throw new HttpsError("permission-denied", "Your account has been suspended.");
      }

      uarSnapshot = priv.uar ?? 0.5;
      userIsSandboxed = priv.isSandboxed ?? false;
    }

    // 4. Weekly cap check — enforced with error for non-sandboxed users
    if (!userIsSandboxed) {
      const capResult = await checkWeeklyReviewCap(uid, estId, db);
      if (!capResult.allowed) {
        throw new HttpsError("resource-exhausted", capResult.reason ?? "Weekly review cap reached.");
      }
    }

    // 5. 30-day cooldown: one review per establishment per window
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

    // 6. Validate answers count (belt-and-suspenders; Zod already enforces length(8))
    if (input.answers.length !== 8) {
      throw new HttpsError("invalid-argument", "Exactly 8 answers are required.");
    }

    // 7. Fetch establishment to determine category
    const estSnap = await db.doc(Paths.establishment(estId)).get();
    if (!estSnap.exists) {
      throw new HttpsError("not-found", `Establishment ${estId} not found.`);
    }
    const est = estSnap.data() as EstablishmentDoc;
    const estCategory = est.categories?.[0] ?? "restaurant";

    // 8. Build answer array for algorithms
    const answers: ReviewAnswerInput[] = input.answers.map((a) => ({
      questionId: a.questionId,
      answerId: a.answerId,
      score: a.score,
    }));

    // 9. Content moderation on written review
    const bodyText = input.writtenReview ?? "";
    if (bodyText.length > 0) {
      const modResult = await moderateContent(bodyText, traceId);
      if (modResult.flagged) {
        log.warn("submitReview: content moderation flagged", {
          traceId,
          userId: uid,
          domain: "moderation",
          eventId: `submit_${uid}`,
        }, { reason: modResult.reason });
        throw new HttpsError("invalid-argument", "Content violates community guidelines.");
      }
    }
    const bodyHash = sha256(normaliseText(bodyText));

    // 10. Compute per-review score (server-side)
    const reviewScore = computeReviewScore(answers, estCategory, input.verificationMethod);

    // 11. Fraud detection: Q8 contradiction + structural anomaly
    const contradictionResult = detectQ8Contradiction(answers, Q8_CONTRADICTION_THRESHOLD);
    const anomalyResult = detectStructuralAnomaly(answers);

    log.info("submitReview: fraud signals computed", {
      traceId,
      userId: uid,
      domain: "fraud",
      eventId: `submit_${uid}`,
    }, {
      hasQ8Contradiction: contradictionResult.hasContradiction,
      q8Delta: contradictionResult.delta,
      isAnomalous: anomalyResult.isAnomalous,
      anomalyPattern: anomalyResult.pattern,
    });

    // 12. Generate review ID and timestamps
    const reviewId = crypto.randomUUID();
    const now = Timestamp.now();

    // 13. Build fingerprint snapshot (idempotent)
    await buildFingerprintSnapshot(uid, reviewId, traceId);

    // 14. Determine verification tier
    const verificationTier =
      input.verificationMethod === "photo" ? "partially_verified" : "unverified";

    // Weight factor: unverified=100 (1.0×), partially_verified=75 (0.75×)
    const weightFactor = verificationTier === "partially_verified" ? 75 : 100;

    // 15. Build review document
    const reviewDoc: ReviewDoc & { bodyHash: string; sandboxed?: boolean } = {
      reviewId,
      authorUid: uid,
      estId,
      answers: input.answers.map((a) => a.answerId.toUpperCase()),
      rawScore: reviewScore,
      weightFactor,
      uarAtSubmission: uarSnapshot,
      verificationTier,
      verifiedAt: input.verificationMethod === "photo" ? now : null,
      fingerprintSnapshotId: reviewId,
      disclosureCategory: "none",
      title: null,
      body: bodyText.length > 0 ? bodyText : null,
      aiSummary: null,
      aiSummaryGeneratedAt: null,
      mediaIds: [],
      upvoteCount: 0,
      downvoteCount: 0,
      helpfulScore: 0,
      // Sandboxed user writes get status "pending" but flagged sandboxed=true
      // so they are excluded from public feeds and score aggregation.
      status: userIsSandboxed ? "pending" : "pending",
      flagCount: 0,
      isFeatured: false,
      isModerated: false,
      moderationStatus: "pending" as const,
      removedAt: null,
      removedBy: null,
      removedReason: null,
      reportCount: 0,
      // B5: Q8 contradiction + structural anomaly results
      hasQ8Contradiction: contradictionResult.hasContradiction,
      isAnomalous: anomalyResult.isAnomalous,
      isCoordinatedAttack: false,
      createdAt: now,
      submittedAt: now,
      updatedAt: now,
      schemaVersion: 1,
      bodyHash,
      // Sandboxed flag: true = excluded from scoring and public feeds.
      ...(userIsSandboxed ? { sandboxed: true } : {}),
    };

    // 16. Batch write: flat reviews collection + denormalized subcollection
    const batch = db.batch();
    batch.set(db.doc(Paths.review(reviewId)), reviewDoc);
    batch.set(db.doc(Paths.estReview(estId, reviewId)), reviewDoc);
    await batch.commit();

    // 17. Increment weekly review counter (only for non-sandboxed users)
    if (!userIsSandboxed) {
      try {
        await incrementWeeklyReviewCount(uid, db);
      } catch (err) {
        // Non-fatal — counter used for soft cap; review already committed.
        log.error("submitReview: weeklyCount increment failed (non-fatal)", {
          traceId,
          userId: uid,
          domain: "moderation",
          eventId: reviewId,
        }, { error: String(err) });
      }
    }

    // 18. Update user review counts
    await db.doc(Paths.user(uid)).update({
      reviewCount: FieldValue.increment(1),
      ...(verificationTier !== "unverified" ? { verifiedReviewCount: FieldValue.increment(1) } : {}),
      updatedAt: now,
    });

    // If user is sandboxed, skip points, badges, and aggregation.
    if (userIsSandboxed) {
      log.info("submitReview: sandboxed user — skipping points, badges, aggregation", {
        traceId,
        userId: uid,
        domain: "reviews",
        eventId: reviewId,
      });
      return { reviewId, pointsAwarded: 0, badgesUnlocked: [], sandboxed: true };
    }

    // 19. Award points with tier + Plus multipliers
    const basePoints =
      input.verificationMethod === "photo" ? POINTS_VERIFIED_REVIEW : POINTS_UNVERIFIED_REVIEW;

    const userSnap = await db.doc(Paths.user(uid)).get();
    const userData = userSnap.exists ? (userSnap.data() as UserDoc) : null;
    const currentTier = userData?.loyaltyTier ?? "bronze";
    const tierMultiplier = getTierMultiplier(currentTier);

    const PLUS_MULTIPLIER = 125; // RC: plus_points_multiplier (1.25 × 100)
    const userPlusActive = await isPlusActive(uid);
    const plusMultiplierInt = userPlusActive ? PLUS_MULTIPLIER : 100;

    const multipliedPoints = Math.floor(
      basePoints * (tierMultiplier / 100) * (plusMultiplierInt / 100)
    );
    const effectiveMultiplier = Math.round((tierMultiplier / 100) * (plusMultiplierInt / 100) * 100);

    let totalPointsAwarded = multipliedPoints;

    await awardPoints(uid, {
      amount: multipliedPoints,
      type: input.verificationMethod === "photo"
        ? "earn_review_partial"
        : "earn_review_unverified",
      multiplierApplied: effectiveMultiplier,
      description:
        input.verificationMethod === "photo"
          ? "Points for photo-verified review"
          : "Points for unverified review",
      relatedEntityId: reviewId,
      relatedEntityType: "review",
    });

    // 20. Badge unlocks
    const badgesUnlocked: string[] = [];
    const isFirstReview = (userData?.reviewCount ?? 1) <= 1; // reviewCount was just incremented above

    if (isFirstReview) {
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

    // 21. Additional badge progression check
    try {
      const additionalBadges = await checkAndUnlockBadges(uid, traceId);
      for (const badgeId of additionalBadges) {
        if (!badgesUnlocked.includes(badgeId)) badgesUnlocked.push(badgeId);
      }
    } catch (err) {
      log.error("submitReview: badge check failed (non-fatal)", {
        traceId,
        userId: uid,
        domain: "badges",
        eventId: reviewId,
      }, { error: String(err) });
    }

    // 22. Challenge progression
    try {
      await onReviewSubmittedChallenges(uid, reviewDoc, traceId);
    } catch (err) {
      log.error("submitReview: challenge check failed (non-fatal)", {
        traceId,
        userId: uid,
        domain: "challenges",
        eventId: reviewId,
      }, { error: String(err) });
    }

    // 23. Referral reward check (first verified review only)
    try {
      if (verificationTier !== "unverified") {
        const referredBy: string | null = userData?.referredBy ?? null;
        const rewardClaimed: boolean = userData?.referralRewardClaimed ?? false;

        if (referredBy && !rewardClaimed) {
          const verifiedReviewsSnap = await db
            .collection(REVIEWS_COLLECTION)
            .where("authorUid", "==", uid)
            .where("verificationTier", "!=", "unverified")
            .get();

          if (verifiedReviewsSnap.size === 1) {
            const referralCode: string | null = userData?.referralCode ?? null;

            await awardPoints(uid, {
              amount: 250,
              type: "earn_referral_bonus",
              description: "Referral reward — first verified review",
              relatedEntityType: "referral",
            });
            totalPointsAwarded += 250;

            await awardPoints(referredBy, {
              amount: 500,
              type: "earn_referral_bonus",
              description: "Referral reward — your friend posted their first verified review",
              relatedEntityType: "referral",
            });

            await db.doc(Paths.user(uid)).update({
              referralRewardClaimed: true,
              updatedAt: now,
            } as Record<string, unknown>);

            if (referralCode) {
              const referralCodeRef = db.collection(REFERRAL_CODES_COLLECTION).doc(referralCode);
              const referralCodeSnap = await referralCodeRef.get();
              if (referralCodeSnap.exists) {
                type RefereeEntry = { uid: string; rewardStatus: string; appliedAt: unknown; rewardedAt?: unknown };
                const referralDocData = referralCodeSnap.data() as { referees?: RefereeEntry[] };
                const updatedReferees = (referralDocData.referees ?? []).map((entry) =>
                  entry.uid === uid ? { ...entry, rewardStatus: "awarded", rewardedAt: now } : entry
                );
                await referralCodeRef.update({
                  successfulReferrals: FieldValue.increment(1),
                  referees: updatedReferees,
                });
              }
            }

            await sendNotification(uid, {
              type: "points_earned",
              title: "Referral reward!",
              body: "You earned 250 pts — your referral is complete!",
              relatedEntityType: "referral",
            });

            await sendNotification(referredBy, {
              type: "points_earned",
              title: "Referral reward!",
              body: `${userData?.displayName ?? "Your friend"} just posted their first review — you earned 500 pts!`,
              relatedEntityType: "referral",
            });
          }
        }
      }
    } catch (err) {
      log.error("submitReview: referral reward check failed (non-fatal)", {
        traceId,
        userId: uid,
        domain: "referrals",
        eventId: reviewId,
      }, { error: String(err) });
    }

    // 24. Trigger establishment rolling score recompute (synchronous for now; B7 moves to Cloud Tasks)
    try {
      await updateEstablishmentScore(estId, db, traceId);
    } catch (err) {
      log.error("submitReview: score aggregation failed (non-fatal)", {
        traceId,
        userId: uid,
        domain: "reviews",
        eventId: reviewId,
      }, { error: String(err) });
    }

    log.info("submitReview: complete", {
      traceId,
      userId: uid,
      domain: "reviews",
      eventId: reviewId,
    }, {
      reviewScore,
      totalPointsAwarded,
      badgesUnlocked,
      hasQ8Contradiction: contradictionResult.hasContradiction,
      isAnomalous: anomalyResult.isAnomalous,
    });

    return {
      reviewId,
      pointsAwarded: totalPointsAwarded,
      badgesUnlocked,
      hasQ8Contradiction: contradictionResult.hasContradiction,
      isAnomalous: anomalyResult.isAnomalous,
    };
  }
);
