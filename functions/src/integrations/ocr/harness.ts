/**
 * harness.ts — OCR vendor harness orchestrator (I4).
 *
 * Runs all 4 vendor adapters in parallel on the same input and returns
 * comparative results with optional ground-truth scoring.
 *
 * Results are written to Firestore: ocrHarnessResults/{testCaseId}
 *
 * Budget context: the $60 harness approval covers ~10 images × 4 vendors.
 *   Document AI: 10 × $0.10 = $1.00
 *   Textract:    10 × $0.01 = $0.10
 *   Mindee:      10 × $0.10 = $1.00
 *   Veryfi:      10 × $0.08 = $0.80
 *   Total (10 runs): ~$2.90 — well within budget.
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { OCRInput, OCRHarnessResult, OCRResult } from "./types";
import { rankResults, GroundTruth } from "./scoring";
import { documentAIAdapter } from "./vendors/documentAI";
import { textractAdapter } from "./vendors/textract";
import { mindeeAdapter } from "./vendors/mindee";
import { veryfiAdapter } from "./vendors/veryfi";

const HARNESS_RESULTS_COLLECTION = "ocrHarnessResults";

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run all 4 OCR vendors on the same input in parallel.
 *
 * @param input        - Base64 image + test case metadata.
 * @param groundTruth  - Optional. When provided, accuracy scores are computed and a winner is picked.
 *                       Without ground truth, winner is set to the highest-confidence successful result.
 */
export async function runOCRHarness(
  input: OCRInput,
  groundTruth?: GroundTruth
): Promise<OCRHarnessResult> {
  const adapters = [documentAIAdapter, textractAdapter, mindeeAdapter, veryfiAdapter];

  // --- Run all vendors in parallel; never let one failure block others ---
  const settled = await Promise.allSettled(
    adapters.map((adapter) => adapter.extract(input))
  );

  const results: OCRResult[] = settled.map((outcome, idx) => {
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    // Adapter threw unexpectedly — shouldn't happen since adapters catch internally,
    // but guard here as a safety net.
    return {
      vendor: adapters[idx].name,
      success: false,
      latencyMs: 0,
      costUsd: 0,
      extracted: {},
      confidence: 0,
      error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
    } satisfies OCRResult;
  });

  // --- Scoring ---
  const scores: Record<string, number> = {};

  let winner: string;
  let recommendation: string;

  if (groundTruth) {
    const ranking = rankResults(results, groundTruth);
    for (const { vendor, score } of ranking.ranked) {
      scores[vendor] = score;
    }
    winner = ranking.winner;
    recommendation = ranking.recommendation;
  } else {
    // No ground truth: winner = highest confidence among successful results
    const successfulResults = results.filter((r) => r.success);
    if (successfulResults.length === 0) {
      winner = "none";
      recommendation = "All vendors failed — check credentials and retry.";
    } else {
      successfulResults.sort((a, b) => b.confidence - a.confidence);
      winner = successfulResults[0].vendor;
      for (const r of results) {
        scores[r.vendor] = r.success ? r.confidence : 0;
      }
      recommendation =
        `No ground truth provided. Winner by confidence: ${winner} (${successfulResults[0].confidence.toFixed(3)}).`;
    }
  }

  const totalCostUsd = results.reduce((sum, r) => sum + r.costUsd, 0);

  const harnessResult: OCRHarnessResult = {
    testCaseId: input.testCaseId,
    results,
    winner,
    scores,
    totalCostUsd,
    recommendedVendor: winner,
    recommendation,
  };

  // --- Persist to Firestore for review ---
  try {
    const db = getFirestore();
    await db
      .collection(HARNESS_RESULTS_COLLECTION)
      .doc(input.testCaseId)
      .set({
        ...harnessResult,
        // Strip imageBase64 from stored results (too large; not needed for review)
        results: results.map((r) => ({
          ...r,
          extracted: {
            ...r.extracted,
            rawText: r.extracted.rawText ? r.extracted.rawText.slice(0, 500) : undefined,
          },
        })),
        createdAt: Timestamp.now(),
      });
  } catch (writeErr) {
    // Non-fatal — harness result is still returned to caller
    console.error(`[ocr/harness] Failed to persist harness result for ${input.testCaseId}:`, writeErr);
  }

  return harnessResult;
}

// ---------------------------------------------------------------------------
// Single-vendor extraction helper (used by production extractReceiptData callable)
// ---------------------------------------------------------------------------

export async function extractWithVendor(
  vendor: OCRResult["vendor"],
  input: OCRInput
): Promise<OCRResult> {
  const map: Record<OCRResult["vendor"], typeof documentAIAdapter> = {
    document_ai: documentAIAdapter,
    textract: textractAdapter,
    mindee: mindeeAdapter,
    veryfi: veryfiAdapter,
  };
  const adapter = map[vendor];
  if (!adapter) {
    return {
      vendor,
      success: false,
      latencyMs: 0,
      costUsd: 0,
      extracted: {},
      confidence: 0,
      error: `Unknown vendor: ${vendor}`,
    };
  }
  return adapter.extract(input);
}
