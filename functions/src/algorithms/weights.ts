/**
 * weights.ts — Question weight matrices per establishment category.
 *
 * All weights are Remote Config governed.  The RC keys are documented inline.
 * Weights within each matrix must sum to 1.0 (Q8's 0.02 is included to maintain
 * the invariant; Q8 is excluded from the meaningful score in the scorer).
 *
 * Used by: algorithms/scoring.ts, algorithms/fraudDetection.ts
 *
 * Milestone: B5
 */

import type { EstablishmentCategory } from "../lib/schema";

// ---------------------------------------------------------------------------
// Restaurant weight matrix  (RC: score.weights.restaurant)
// ---------------------------------------------------------------------------

export const RESTAURANT_WEIGHTS: Record<string, number> = {
  q1: 0.25, // food quality       RC: score.weights.restaurant.q1
  q2: 0.20, // service            RC: score.weights.restaurant.q2
  q3: 0.15, // atmosphere         RC: score.weights.restaurant.q3
  q4: 0.15, // value for money    RC: score.weights.restaurant.q4
  q5: 0.10, // presentation       RC: score.weights.restaurant.q5
  q6: 0.10, // cleanliness        RC: score.weights.restaurant.q6
  q7: 0.03, // wait time          RC: score.weights.restaurant.q7
  q8: 0.02, // overall (excluded from score; included to keep weights summing to 1.0)
};

// ---------------------------------------------------------------------------
// Bar / nightclub weight matrix  (RC: score.weights.bar)
// ---------------------------------------------------------------------------

export const BAR_WEIGHTS: Record<string, number> = {
  q1: 0.10, // drink quality      RC: score.weights.bar.q1
  q2: 0.20, // service            RC: score.weights.bar.q2
  q3: 0.30, // atmosphere / vibe  RC: score.weights.bar.q3
  q4: 0.15, // value for money    RC: score.weights.bar.q4
  q5: 0.10, // presentation       RC: score.weights.bar.q5
  q6: 0.08, // cleanliness        RC: score.weights.bar.q6
  q7: 0.05, // wait time          RC: score.weights.bar.q7
  q8: 0.02, // overall
};

// ---------------------------------------------------------------------------
// Accessor
// ---------------------------------------------------------------------------

/**
 * Returns the weight matrix for the given establishment category.
 * Defaults to RESTAURANT_WEIGHTS for any unrecognised category.
 */
export function getWeightMatrix(
  category: EstablishmentCategory | string
): Record<string, number> {
  if (category === "bar" || category === "nightclub") return BAR_WEIGHTS;
  return RESTAURANT_WEIGHTS;
}
