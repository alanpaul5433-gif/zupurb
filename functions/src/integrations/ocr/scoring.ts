/**
 * scoring.ts — Accuracy scoring for the OCR vendor harness (I4).
 *
 * Weights:
 *   - Establishment name match (fuzzy, case-insensitive): 30%
 *   - Date match (exact ISO YYYY-MM-DD):                  20%
 *   - Total amount match (within 5%):                     35%
 *   - Vendor-reported confidence:                         15%
 *
 * Returns normalised scores in [0.0, 1.0].
 */

import { OCRResult } from "./types";

// ---------------------------------------------------------------------------
// Levenshtein distance — used for fuzzy name matching
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Normalise a string for fuzzy comparison: lowercase, remove punctuation, collapse whitespace. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein similarity ratio in [0.0, 1.0].
 * 1.0 = identical, 0.0 = completely different.
 */
function nameSimilarity(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  const dist = levenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

// ---------------------------------------------------------------------------
// Score a single OCRResult against ground truth
// ---------------------------------------------------------------------------

export interface GroundTruth {
  establishmentName: string;
  /** ISO YYYY-MM-DD */
  date: string;
  /** Total in cents (integer) */
  totalAmount: number;
}

/**
 * Score one OCR result against known ground truth.
 *
 * @returns Weighted accuracy score in [0.0, 1.0].
 */
export function scoreResult(result: OCRResult, groundTruth: GroundTruth): number {
  if (!result.success) return 0;

  const W_NAME  = 0.30;
  const W_DATE  = 0.20;
  const W_TOTAL = 0.35;
  const W_CONF  = 0.15;

  // Name score
  const nameScore =
    result.extracted.establishmentName
      ? nameSimilarity(result.extracted.establishmentName, groundTruth.establishmentName)
      : 0;

  // Date score — exact ISO match after normalisation
  const dateScore =
    result.extracted.date &&
    normalise(result.extracted.date) === normalise(groundTruth.date)
      ? 1
      : 0;

  // Total amount score — within 5% tolerance
  let totalScore = 0;
  if (result.extracted.totalAmount != null && groundTruth.totalAmount > 0) {
    const ratio = Math.abs(result.extracted.totalAmount - groundTruth.totalAmount) / groundTruth.totalAmount;
    totalScore = ratio <= 0.05 ? 1 : 0;
  }

  // Confidence — vendor-reported, already [0, 1]
  const confScore = Math.min(1, Math.max(0, result.confidence));

  return W_NAME * nameScore + W_DATE * dateScore + W_TOTAL * totalScore + W_CONF * confScore;
}

// ---------------------------------------------------------------------------
// Rank all vendor results and pick the winner
// ---------------------------------------------------------------------------

export interface RankingResult {
  ranked: Array<{ vendor: string; score: number }>;
  winner: string;
  recommendation: string;
}

/**
 * Rank all OCR results and return the best vendor with a recommendation string.
 * Tie-break: prefer lowest cost per call (Textract over others).
 */
export function rankResults(
  results: OCRResult[],
  groundTruth: GroundTruth
): RankingResult {
  // Cost tiebreak order (ascending) — matches estimatedCostPerCall values
  const costRank: Record<string, number> = {
    textract: 0,
    veryfi: 1,
    document_ai: 2,
    mindee: 3,
  };

  const scored = results.map((r) => ({
    vendor: r.vendor as string,
    score: scoreResult(r, groundTruth),
    costRank: costRank[r.vendor] ?? 99,
  }));

  scored.sort((a, b) => b.score - a.score || a.costRank - b.costRank);

  const ranked = scored.map(({ vendor, score }) => ({ vendor, score }));
  const winner = ranked[0]?.vendor ?? "none";

  // Build human-readable recommendation
  const top = ranked[0];
  const runnerUp = ranked[1];
  const lines: string[] = [];

  lines.push(`Winner: ${top.vendor} (score ${top.score.toFixed(3)})`);

  if (runnerUp) {
    const gap = top.score - runnerUp.score;
    lines.push(
      gap < 0.05
        ? `Runner-up: ${runnerUp.vendor} (score ${runnerUp.score.toFixed(3)}) — scores are close; consider cost.`
        : `Runner-up: ${runnerUp.vendor} (score ${runnerUp.score.toFixed(3)})`
    );
  }

  const failed = results.filter((r) => !r.success).map((r) => r.vendor);
  if (failed.length) lines.push(`Failed vendors: ${failed.join(", ")}`);

  return { ranked, winner, recommendation: lines.join(" | ") };
}
