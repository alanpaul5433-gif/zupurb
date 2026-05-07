/**
 * fraudDetection.ts — Pure fraud-detection algorithms.
 *
 * All functions are pure (no Firestore I/O).
 *
 * Exports:
 *   detectQ8Contradiction  — detects when Q8 sentiment contradicts the Q1–Q7 average.
 *   detectStructuralAnomaly — detects all-A or all-D answer patterns.
 *
 * Milestone: B5
 */

import type { ReviewAnswerInput } from "./scoring";

// ---------------------------------------------------------------------------
// Shared answer-score mapping (mirrors scoring.ts; both driven by same scale)
// ---------------------------------------------------------------------------

// A/a=1 → 1.0, B/b=2 → 2.333, C/c=3 → 3.667, D/d=4 → 5.0
const ANSWER_SCORE_MAP: Record<string, number> = {
  a: 1.0,
  b: 2.333,
  c: 3.667,
  d: 5.0,
  // Accept numeric scores as well (client provides score=1..4)
  "1": 1.0,
  "2": 2.333,
  "3": 3.667,
  "4": 5.0,
};

// ---------------------------------------------------------------------------
// Q8 Contradiction Detector
// ---------------------------------------------------------------------------

/**
 * Result returned by detectQ8Contradiction.
 */
export interface Q8ContradictionResult {
  /** True when Q8 sentiment is inconsistent with the Q1–Q7 average. */
  hasContradiction: boolean;
  /**
   * Absolute difference between Q8 score and the unweighted Q1–Q7 average.
   * 0 when there are not enough answers to compute.
   * RC: q8_contradiction_threshold (default 2.0)
   */
  delta: number;
  /** Q8 normalised score [1.0, 5.0], or null if Q8 is absent. */
  q8Score: number | null;
  /** Unweighted average of Q1–Q7 normalised scores. */
  q1to7Average: number;
}

/**
 * Detects when the overall sentiment answer (Q8) contradicts the unweighted
 * average of Q1–Q7.
 *
 * Example contradiction: Q1–Q7 average = 4.5 (mostly "D"), but Q8 = "A" (1.0).
 *
 * Threshold: RC key `q8_contradiction_threshold` (default 2.0).
 * If |q8Score − q1to7Average| > threshold → hasContradiction = true.
 *
 * @param answers   Array of ReviewAnswerInput for Q1–Q8 (must include q8).
 * @param threshold Contradiction threshold; default 2.0.  Pass from Remote Config.
 */
export function detectQ8Contradiction(
  answers: ReviewAnswerInput[],
  threshold = 2.0   // RC: q8_contradiction_threshold
): Q8ContradictionResult {
  // Separate Q1–Q7 from Q8
  const q1to7 = answers.filter((a) => a.questionId !== "q8");
  const q8Entry = answers.find((a) => a.questionId === "q8");

  // Map answers to normalised [1.0, 5.0] scores
  function toNorm(a: ReviewAnswerInput): number {
    // Prefer answerId letter (authoritative); fall back to ordinal score
    const key = a.answerId?.toLowerCase();
    if (key && ANSWER_SCORE_MAP[key] !== undefined) {
      return ANSWER_SCORE_MAP[key];
    }
    // Numeric score fallback
    const numKey = String(a.score);
    return ANSWER_SCORE_MAP[numKey] ?? 1.0;
  }

  if (q1to7.length === 0) {
    return { hasContradiction: false, delta: 0, q8Score: null, q1to7Average: 0 };
  }

  const q1to7Sum = q1to7.reduce((acc, a) => acc + toNorm(a), 0);
  const q1to7Average = q1to7Sum / q1to7.length;

  if (!q8Entry) {
    return { hasContradiction: false, delta: 0, q8Score: null, q1to7Average };
  }

  const q8Score = toNorm(q8Entry);
  const delta = Math.abs(q8Score - q1to7Average);
  const hasContradiction = delta > threshold;

  return { hasContradiction, delta, q8Score, q1to7Average };
}

// ---------------------------------------------------------------------------
// Structural Anomaly Detector
// ---------------------------------------------------------------------------

/**
 * Result returned by detectStructuralAnomaly.
 */
export interface StructuralAnomalyResult {
  /** True when all Q1–Q7 answers are the same letter (all-A or all-D pattern). */
  isAnomalous: boolean;
  /**
   * Which pattern triggered the anomaly flag, or null if no anomaly.
   * "all_a" = all minimum answers; "all_d" = all maximum answers;
   * "all_same" = all answers identical (any letter).
   */
  pattern: "all_a" | "all_d" | "all_same" | null;
}

/**
 * Detects structurally anomalous answer patterns in Q1–Q7:
 *   - all-A (all minimum) → obviously negative fake
 *   - all-D (all maximum) → obviously positive fake
 *   - all-same (any letter) → considered suspicious
 *
 * Q8 is excluded from this check (it is a visit-claim question, not a quality signal).
 *
 * @param answers  Array of ReviewAnswerInput for Q1–Q8.
 */
export function detectStructuralAnomaly(answers: ReviewAnswerInput[]): StructuralAnomalyResult {
  const q1to7 = answers.filter((a) => a.questionId !== "q8");

  if (q1to7.length < 2) {
    return { isAnomalous: false, pattern: null };
  }

  const normalised = q1to7.map((a) => a.answerId?.toLowerCase() ?? String(a.score));
  const first = normalised[0];
  const allSame = normalised.every((v) => v === first);

  if (!allSame) {
    return { isAnomalous: false, pattern: null };
  }

  // All answers are identical
  if (first === "a" || first === "1") {
    return { isAnomalous: true, pattern: "all_a" };
  }
  if (first === "d" || first === "4") {
    return { isAnomalous: true, pattern: "all_d" };
  }
  return { isAnomalous: true, pattern: "all_same" };
}
