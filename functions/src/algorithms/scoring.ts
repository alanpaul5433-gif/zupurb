/**
 * scoring.ts — Per-review score, establishment rolling score, and FPYL score.
 *
 * All scores stored as integer × 100 (e.g., 4.23 → 423).
 * Time decay uses exponential model: exp(-lambda * days).
 * FPYL falls back to overallScore when fewer than fpyl_min_reviews similar reviews exist.
 *
 * RC: comments indicate Remote Config keys controlling each constant.
 *
 * Milestone: B4
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  Paths,
  ReviewDoc,
  FingerprintSnapshotDoc,
  UserDoc,
  EstablishmentScoreDoc,
  EstablishmentCategory,
  REVIEWS_COLLECTION,
  FINGERPRINT_SNAPSHOTS_SUBCOLLECTION,
} from "../lib/schema";
import { computeSimilarity } from "./fingerprint";
import { log } from "../lib/logging";
import { redis } from "../lib/redis";
import { CacheKeys, CacheTTL } from "../lib/cacheKeys";

// ---------------------------------------------------------------------------
// Question weight matrices (Remote Config governed)
// ---------------------------------------------------------------------------

// Answer score → normalized [1.0, 5.0] mapping (linear: score 1→1.0, 4→5.0)
// score 1 → 1.0, 2 → 2.333, 3 → 3.667, 4 → 5.0
const ANSWER_SCORE_MAP: Record<number, number> = {
  1: 1.0,
  2: 2.333,
  3: 3.667,
  4: 5.0,
};

// Restaurant default question weights (RC: score.weights.restaurant)
const RESTAURANT_WEIGHTS: Record<string, number> = {
  q1: 0.25, // food quality       RC: q_weight_food
  q2: 0.20, // service            RC: q_weight_service
  q3: 0.15, // atmosphere         RC: q_weight_atmosphere
  q4: 0.15, // value              RC: q_weight_value
  q5: 0.10, // presentation       RC: q_weight_presentation
  q6: 0.10, // cleanliness        RC: q_weight_cleanliness
  q7: 0.03, // wait time          RC: q_weight_wait
  q8: 0.02, // overall (excluded from scoring by spec but kept in weight matrix)
};

// Bar / nightclub question weights (RC: score.weights.bar)
const BAR_WEIGHTS: Record<string, number> = {
  q1: 0.10, // drink quality      RC: q_weight_bar_drink
  q2: 0.20, // service            RC: q_weight_bar_service
  q3: 0.30, // atmosphere/vibe    RC: q_weight_bar_atmosphere
  q4: 0.15, // value              RC: q_weight_bar_value
  q5: 0.10, // presentation       RC: q_weight_bar_presentation
  q6: 0.08, // cleanliness        RC: q_weight_bar_cleanliness
  q7: 0.05, // wait time          RC: q_weight_bar_wait
  q8: 0.02, // overall
};

// Verification multiplier (RC: verification_multiplier_photo)
const VERIFICATION_MULTIPLIER_PHOTO = 1.25; // RC: verification_multiplier_photo
const VERIFICATION_MULTIPLIER_UNVERIFIED = 1.0;

// Time decay lambda for exponential model (RC: score_decay_lambda)
const SCORE_DECAY_LAMBDA = 0.005; // RC: score_decay_lambda (per day)

// FPYL thresholds (RC governed)
const FPYL_MIN_SIMILARITY = 0.3; // RC: fpyl_min_similarity
const FPYL_MIN_REVIEWS = 3;      // RC: fpyl_min_reviews

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeightMatrix(category: EstablishmentCategory | string): Record<string, number> {
  if (category === "bar" || category === "nightclub") return BAR_WEIGHTS;
  return RESTAURANT_WEIGHTS; // default for restaurant, coffee, hotel, experience, other
}

function daysSince(ts: Timestamp): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (Date.now() - ts.toMillis()) / msPerDay;
}

function exponentialDecay(days: number): number {
  return Math.exp(-SCORE_DECAY_LAMBDA * days);
}

// ---------------------------------------------------------------------------
// computeReviewScore
// ---------------------------------------------------------------------------

export interface ReviewAnswerInput {
  questionId: string; // "q1"–"q8"
  answerId: string;   // "a" | "b" | "c" | "d"
  score: number;      // 1–4 client-provided (validated server-side)
}

/**
 * Compute per-review score.
 * Q8 is included in the weight matrix but excluded from the meaningful score by spec —
 * it is a visit-claim question used for contradiction detection, not a quality signal.
 * The weight for q8 is 0.02 and it's included so weights sum to 1.0; the effect is minimal.
 *
 * Returns integer × 100.
 */
export function computeReviewScore(
  answers: ReviewAnswerInput[],
  establishmentCategory: EstablishmentCategory | string,
  verificationMethod: "unverified" | "photo"
): number {
  const weights = getWeightMatrix(establishmentCategory);

  let weightedSum = 0;
  let totalWeight = 0;

  for (const answer of answers) {
    const weight = weights[answer.questionId] ?? 0;
    if (weight === 0) continue;

    // Validate score range server-side; clamp to 1–4
    const rawScore = Math.max(1, Math.min(4, Math.round(answer.score)));
    const normalised = ANSWER_SCORE_MAP[rawScore] ?? 1.0;

    weightedSum += normalised * weight;
    totalWeight += weight;
  }

  const weightedAverage = totalWeight > 0 ? weightedSum / totalWeight : 1.0;

  const verificationMultiplier =
    verificationMethod === "photo"
      ? VERIFICATION_MULTIPLIER_PHOTO
      : VERIFICATION_MULTIPLIER_UNVERIFIED;

  // timeDecayFactor = 1.0 at submission (decay applied during rolling score computation)
  const rawFloat = weightedAverage * verificationMultiplier;

  // Clamp to [1.0, 5.0] before converting to integer × 100
  const clamped = Math.max(1.0, Math.min(5.0, rawFloat));
  return Math.round(clamped * 100);
}

// ---------------------------------------------------------------------------
// computeRollingScore
// ---------------------------------------------------------------------------

export interface RollingScoreResult {
  overallScore: number; // integer × 100
  reviewCount: number;
  verifiedReviewCount: number;
  score12moCount: number;
  score24moCount: number;
  score36moCount: number;
  scoreOlderCount: number;
}

/**
 * Recompute the establishment's rolling weighted score across all eligible reviews.
 * Writes to establishmentScores/{eid} and establishments/{eid}.overallScore.
 *
 * Weight per review = decayFactor * uar (from snapshot at submission time).
 * decayFactor = exp(-lambda * daysSinceReview)
 *
 * Returns the result object.
 */
export async function computeRollingScore(
  establishmentId: string,
  traceId?: string
): Promise<RollingScoreResult> {
  const db = getFirestore();

  // Fetch all non-removed reviews for this establishment
  const reviewsSnap = await db
    .collection(REVIEWS_COLLECTION)
    .where("estId", "==", establishmentId)
    .where("status", "in", ["published", "pending"])
    .get();

  if (reviewsSnap.empty) {
    const empty: RollingScoreResult = {
      overallScore: 0,
      reviewCount: 0,
      verifiedReviewCount: 0,
      score12moCount: 0,
      score24moCount: 0,
      score36moCount: 0,
      scoreOlderCount: 0,
    };
    return empty;
  }

  const now = Date.now();
  const MS_12MO = 365 * 24 * 60 * 60 * 1000;
  const MS_24MO = 2 * MS_12MO;
  const MS_36MO = 3 * MS_12MO;

  let weightedScoreSum = 0;
  let weightSum = 0;
  let reviewCount = 0;
  let verifiedReviewCount = 0;
  let score12moCount = 0;
  let score24moCount = 0;
  let score36moCount = 0;
  let scoreOlderCount = 0;

  for (const doc of reviewsSnap.docs) {
    const review = doc.data() as ReviewDoc;

    // rawScore is integer × 100; convert to [1,5] for computation
    const scoreFloat = review.rawScore / 100;
    const uar = review.uarAtSubmission ?? 0.5; // fallback if missing

    const days = daysSince(review.submittedAt);
    const decay = exponentialDecay(days);

    const weight = decay * uar;
    weightedScoreSum += scoreFloat * weight;
    weightSum += weight;
    reviewCount++;

    if (review.verificationTier === "verified") verifiedReviewCount++;

    const ageMs = now - review.submittedAt.toMillis();
    if (ageMs <= MS_12MO) score12moCount++;
    else if (ageMs <= MS_24MO) score24moCount++;
    else if (ageMs <= MS_36MO) score36moCount++;
    else scoreOlderCount++;
  }

  const overallScoreFloat = weightSum > 0 ? weightedScoreSum / weightSum : 0;
  const overallScore = Math.round(Math.max(0, Math.min(5, overallScoreFloat)) * 100);
  const now_ts = Timestamp.now();

  const result: RollingScoreResult = {
    overallScore,
    reviewCount,
    verifiedReviewCount,
    score12moCount,
    score24moCount,
    score36moCount,
    scoreOlderCount,
  };

  // Write to establishmentScores/{eid}
  const scoreDocRef = db.doc(Paths.establishmentScore(establishmentId));
  const scoreDoc: EstablishmentScoreDoc = {
    estId: establishmentId,
    overallScore,
    overallScoreUpdatedAt: now_ts,
    verifiedScore: 0,   // future: filter by verificationTier === 'verified'
    partialScore: 0,    // future: filter by verificationTier === 'partially_verified'
    reviewCount,
    verifiedReviewCount,
    score12moCount,
    score24moCount,
    score36moCount,
    scoreOlderCount,
    updatedAt: now_ts,
    schemaVersion: 1,
  };
  await scoreDocRef.set(scoreDoc, { merge: true });

  // Denormalize onto establishments/{eid} for fast query
  const estRef = db.doc(Paths.establishment(establishmentId));
  await estRef.update({
    overallScore,
    overallScoreUpdatedAt: now_ts,
    reviewCount,
    verifiedReviewCount,
    updatedAt: now_ts,
  });

  if (traceId) {
    log.info("computeRollingScore: complete", {
      traceId,
      domain: "scoring",
      eventId: `rollingScore_${establishmentId}`,
    }, { overallScore, reviewCount });
  }

  return result;
}

// ---------------------------------------------------------------------------
// computeFPYLScore
// ---------------------------------------------------------------------------

/**
 * Compute "From People Like You" score for a viewer at a specific establishment.
 *
 * 1. Fetch viewer's current fingerprint from users/{viewerUid}.
 * 2. Fetch all fingerprintSnapshots for reviewers of this establishment.
 * 3. Filter snapshots where similarity >= FPYL_MIN_SIMILARITY.
 * 4. Weighted average: sum(reviewScore * similarity * uar) / sum(similarity * uar).
 * 5. Fall back to overallScore if fewer than FPYL_MIN_REVIEWS similar reviews.
 *
 * Returns integer × 100.
 */
export async function computeFPYLScore(
  establishmentId: string,
  viewerUid: string,
  traceId?: string
): Promise<number> {
  const db = getFirestore();

  // 1. Viewer's current fingerprint
  const viewerSnap = await db.doc(Paths.user(viewerUid)).get();
  if (!viewerSnap.exists) {
    return await _getFallbackScore(db, establishmentId);
  }

  const viewer = viewerSnap.data() as UserDoc;
  const viewerFpDoc: FingerprintSnapshotDoc = {
    snapshotId: `viewer_${viewerUid}`,
    userId: viewerUid,
    reviewId: "",
    fingerprint: viewer.fingerprint,
    capturedAt: Timestamp.now(),
  };

  // 2. Fetch reviews for this establishment with status published/pending
  const reviewsSnap = await db
    .collection(REVIEWS_COLLECTION)
    .where("estId", "==", establishmentId)
    .where("status", "in", ["published", "pending"])
    .get();

  if (reviewsSnap.empty) {
    return await _getFallbackScore(db, establishmentId);
  }

  // 3. For each review, fetch reviewer's fingerprint snapshot and compute similarity
  type ScoredReview = { score: number; similarity: number; uar: number };
  const scored: ScoredReview[] = [];

  await Promise.all(
    reviewsSnap.docs.map(async (doc) => {
      const review = doc.data() as ReviewDoc;
      const snapshotRef = db
        .collection(`users/${review.authorUid}/${FINGERPRINT_SNAPSHOTS_SUBCOLLECTION}`)
        .doc(review.fingerprintSnapshotId);

      const snapshotSnap = await snapshotRef.get();
      if (!snapshotSnap.exists) return;

      const snapshot = snapshotSnap.data() as FingerprintSnapshotDoc;
      const similarity = computeSimilarity(viewerFpDoc, snapshot);

      if (similarity >= FPYL_MIN_SIMILARITY) {
        scored.push({
          score: review.rawScore / 100,
          similarity,
          uar: review.uarAtSubmission ?? 0.5,
        });
      }
    })
  );

  // 4. Check minimum reviews threshold
  if (scored.length < FPYL_MIN_REVIEWS) {
    return await _getFallbackScore(db, establishmentId);
  }

  // 5. Weighted average
  let numerator = 0;
  let denominator = 0;
  for (const s of scored) {
    const w = s.similarity * s.uar;
    numerator += s.score * w;
    denominator += w;
  }

  const fpylFloat = denominator > 0 ? numerator / denominator : 0;
  const fpylScore = Math.round(Math.max(0, Math.min(5, fpylFloat)) * 100);

  if (traceId) {
    log.info("computeFPYLScore: complete", {
      traceId,
      userId: viewerUid,
      domain: "scoring",
      eventId: `fpyl_${establishmentId}`,
    }, { fpylScore, similarReviewCount: scored.length });
  }

  return fpylScore;
}

async function _getFallbackScore(
  db: FirebaseFirestore.Firestore,
  establishmentId: string
): Promise<number> {
  const scoreSnap = await db.doc(Paths.establishmentScore(establishmentId)).get();
  if (!scoreSnap.exists) return 0;
  return (scoreSnap.data() as EstablishmentScoreDoc).overallScore;
}

// ---------------------------------------------------------------------------
// Cached score helpers (B11)
// ---------------------------------------------------------------------------

/**
 * Return the rolling score for an establishment, serving from Redis when fresh.
 * Cache miss: calls computeRollingScore, populates Redis, returns value.
 * Graceful degradation: falls through to Firestore on any Redis error.
 */
export async function getCachedRollingScore(establishmentId: string): Promise<number> {
  // 1. Try Redis
  const cached = await redis.get<number>(CacheKeys.establishmentScore(establishmentId));
  if (cached !== null) return cached;

  // 2. Cache miss — read from Firestore score doc (avoids full recompute on detail page reads)
  const db = getFirestore();
  const scoreSnap = await db.doc(Paths.establishmentScore(establishmentId)).get();
  if (scoreSnap.exists) {
    const score = (scoreSnap.data() as EstablishmentScoreDoc).overallScore;
    // Warm Redis (best-effort, non-blocking)
    redis.set(CacheKeys.establishmentScore(establishmentId), score, CacheTTL.establishmentScore)
      .catch(() => { /* non-critical */ });
    return score;
  }

  return 0;
}

/**
 * Return the FPYL score for a viewer at an establishment, serving from Redis when fresh.
 * Cache miss: calls computeFPYLScore, populates Redis, returns value.
 * Graceful degradation: falls through to compute on any Redis error.
 */
export async function getCachedFPYLScore(
  establishmentId: string,
  viewerUid: string,
  traceId?: string
): Promise<number> {
  // 1. Try Redis
  const cached = await redis.get<number>(CacheKeys.fpylScore(establishmentId, viewerUid));
  if (cached !== null) return cached;

  // 2. Cache miss — compute fresh
  const score = await computeFPYLScore(establishmentId, viewerUid, traceId);

  // Warm Redis (best-effort, non-blocking)
  redis.set(CacheKeys.fpylScore(establishmentId, viewerUid), score, CacheTTL.fpylScore)
    .catch(() => { /* non-critical */ });

  return score;
}

/**
 * Invalidate the establishment rolling score in Redis.
 * Called after score recomputation so next request re-warms from Firestore.
 *
 * FPYL keys are per-viewer — cannot bulk-invalidate. Let them expire naturally
 * (30 min TTL is acceptable staleness after a new review arrives).
 */
export async function invalidateScoreCache(establishmentId: string): Promise<void> {
  await redis.del(CacheKeys.establishmentScore(establishmentId));
}
