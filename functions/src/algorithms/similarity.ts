/**
 * similarity.ts — Text similarity scoring for anti-fraud detection.
 *
 * Two functions:
 *   computeTextSimilarity(a, b)  — Jaccard similarity on word bigrams, returns [0, 1]
 *   computeReviewSimilarityBatch(uid, db) — avg pairwise similarity over last N reviews
 *
 * No external ML dependency — pure TypeScript n-gram approach.
 * A high average pairwise similarity signals templated / copy-paste review fraud.
 *
 * RC: fraud.similarity.recentReviewsN  (default 10) — window size for batch scorer
 * RC: fraud.similarity.sandboxThreshold (default 0.7) — high similarity → sandbox signal
 *
 * Milestone: B3
 */

import { ReviewDoc, REVIEWS_COLLECTION } from "../lib/schema";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SimilarityBatchResult {
  /** Average pairwise Jaccard similarity over the user's last N reviews. [0, 1] */
  averageSimilarity: number;
  /** Number of review pairs evaluated. */
  pairCount: number;
  /** Number of reviews included in the batch. */
  reviewCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalise text: lowercase, remove non-alpha, collapse whitespace.
 */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate word bigrams (n=2) from a whitespace-tokenised string.
 * Falls back to unigrams if the text has fewer than 2 tokens.
 * Returns a Set<string> of "token1 token2" pairs.
 */
function wordBigrams(text: string): Set<string> {
  const tokens = normalise(text).split(" ").filter((t) => t.length > 0);
  if (tokens.length === 0) return new Set();
  if (tokens.length === 1) return new Set([tokens[0]]);

  const bigrams = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

/**
 * Jaccard similarity between two Sets: |A ∩ B| / |A ∪ B|.
 * Returns 0 if both sets are empty.
 */
function jaccardSets(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------------------
// computeTextSimilarity
// ---------------------------------------------------------------------------

/**
 * Compute Jaccard similarity on word bigrams between two review text strings.
 * Returns a value in [0.0, 1.0].
 *
 * 0.0 = completely different   1.0 = identical
 *
 * An empty string on either side returns 0.0 (no signal).
 */
export function computeTextSimilarity(reviewA: string, reviewB: string): number {
  if (!reviewA || !reviewB) return 0;
  const bigramsA = wordBigrams(reviewA);
  const bigramsB = wordBigrams(reviewB);
  return jaccardSets(bigramsA, bigramsB);
}

// ---------------------------------------------------------------------------
// computeReviewSimilarityBatch
// ---------------------------------------------------------------------------

/**
 * Fetch the user's last N review bodies (published, pending, or quarantined)
 * and return the average pairwise Jaccard similarity.
 *
 * A value > fraud.similarity.sandboxThreshold is a strong shill signal.
 * RC: fraud.similarity.recentReviewsN (default 10)
 *
 * @param uid  User whose reviews to evaluate.
 * @param db   Firestore instance (dependency-injected for testability).
 */
export async function computeReviewSimilarityBatch(
  uid: string,
  db: FirebaseFirestore.Firestore
): Promise<SimilarityBatchResult> {
  // RC: fraud.similarity.recentReviewsN = 10
  const RECENT_N = 10;

  const snap = await db
    .collection(REVIEWS_COLLECTION)
    .where("authorUid", "==", uid)
    .where("status", "in", ["published", "pending", "quarantined"])
    .orderBy("submittedAt", "desc")
    .limit(RECENT_N)
    .get();

  if (snap.empty) {
    return { averageSimilarity: 0, pairCount: 0, reviewCount: 0 };
  }

  const bodies: string[] = snap.docs
    .map((d) => (d.data() as ReviewDoc).body ?? "")
    .filter((b) => b.trim().length > 0);

  if (bodies.length < 2) {
    return { averageSimilarity: 0, pairCount: 0, reviewCount: snap.size };
  }

  // Compute all pairs (i, j) where i < j
  let totalSimilarity = 0;
  let pairCount = 0;

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      totalSimilarity += computeTextSimilarity(bodies[i], bodies[j]);
      pairCount++;
    }
  }

  const averageSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;

  return {
    averageSimilarity: parseFloat(averageSimilarity.toFixed(4)),
    pairCount,
    reviewCount: snap.size,
  };
}
