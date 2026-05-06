/**
 * runOCRHarness.ts — Admin-only callable to trigger the OCR vendor evaluation harness.
 *
 * Runs all 4 OCR vendors (Document AI, Textract, Mindee, Veryfi) against the same
 * receipt image and returns a comparative accuracy/cost/latency report.
 *
 * Used exclusively for the $60 I4 evaluation batch. Not called in production flows.
 *
 * Input:
 *   {
 *     imageBase64: string;        // base64-encoded receipt image (no data-URI prefix)
 *     mimeType: "image/jpeg" | "image/png";
 *     testCaseId: string;         // unique identifier for this test case
 *     groundTruth?: {
 *       establishmentName: string;
 *       date: string;             // YYYY-MM-DD
 *       totalAmount: number;      // in cents
 *     };
 *   }
 *
 * Output: OCRHarnessResult
 *
 * Domain: integrations / OCR
 * Milestone: I4
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { runOCRHarness } from "../integrations/ocr";
import type { GroundTruth } from "../integrations/ocr";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema (Zod)
// ---------------------------------------------------------------------------

const GroundTruthSchema = z.object({
  establishmentName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  totalAmount: z.number().int().positive(),
});

const RunOCRHarnessInput = z.object({
  imageBase64: z.string().min(1, "imageBase64 required"),
  mimeType: z.enum(["image/jpeg", "image/png"]),
  testCaseId: z.string().min(1).max(128),
  groundTruth: GroundTruthSchema.optional(),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const runOCRHarnessCallable = onCall(
  { region: "us-central1", timeoutSeconds: 120 },
  async (request) => {
    const traceId = newTraceId();

    // ---- Auth: admin custom claim required ----
    if (!request.auth?.token?.admin) {
      log.warn("runOCRHarness: permission denied", {
        traceId,
        userId: request.auth?.uid ?? "unauthenticated",
        domain: "integrations",
      });
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    // ---- Input validation ----
    const parseResult = RunOCRHarnessInput.safeParse(request.data);
    if (!parseResult.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parseResult.error.message}`
      );
    }

    const { imageBase64, mimeType, testCaseId, groundTruth } = parseResult.data;

    log.info("runOCRHarness: start", {
      traceId,
      userId: request.auth.uid,
      eventId: `ocr_harness_${testCaseId}`,
      domain: "integrations",
    }, { testCaseId, hasGroundTruth: !!groundTruth });

    const harnessStart = Date.now();

    const result = await runOCRHarness(
      { imageBase64, mimeType, testCaseId },
      groundTruth as GroundTruth | undefined
    );

    const durationMs = Date.now() - harnessStart;

    log.info("runOCRHarness: complete", {
      traceId,
      userId: request.auth.uid,
      eventId: `ocr_harness_${testCaseId}`,
      domain: "integrations",
      durationMs,
    }, {
      winner: result.winner,
      totalCostUsd: result.totalCostUsd,
      vendorSuccessCount: result.results.filter((r) => r.success).length,
    });

    return result;
  }
);
