/**
 * extractReceiptData.ts — Production callable for receipt OCR in the verify-visit flow.
 *
 * Runs only the winning vendor (selected post-harness via Remote Config).
 * Called by the verify-visit flow when a guest submits a receipt photo.
 *
 * RC: ocr_selected_vendor — controls which vendor runs. Default: 'textract'.
 *     Change this value in Firebase Remote Config after I4 harness results are reviewed.
 *
 * Input:
 *   {
 *     imageBase64: string;         // base64-encoded receipt image (no data-URI prefix)
 *     mimeType: "image/jpeg" | "image/png";
 *     reservationId?: string;      // optional, used for audit logging
 *   }
 *
 * Output:
 *   {
 *     success: boolean;
 *     extracted: OCRResult["extracted"];
 *     vendor: string;
 *     confidence: number;
 *   }
 *
 * Domain: integrations / OCR
 * Milestone: I4
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { extractWithVendor } from "../integrations/ocr";
import type { OCRResult } from "../integrations/ocr";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema (Zod)
// ---------------------------------------------------------------------------

const ExtractReceiptDataInput = z.object({
  imageBase64: z.string().min(1, "imageBase64 required"),
  mimeType: z.enum(["image/jpeg", "image/png"]),
  reservationId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const extractReceiptData = onCall(
  { region: "us-central1", timeoutSeconds: 60 },
  async (request) => {
    const traceId = newTraceId();

    // ---- Auth: must be authenticated (any user in verify-visit flow) ----
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const userId = request.auth.uid;

    // ---- Input validation ----
    const parseResult = ExtractReceiptDataInput.safeParse(request.data);
    if (!parseResult.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parseResult.error.message}`
      );
    }

    const { imageBase64, mimeType, reservationId } = parseResult.data;

    // RC: ocr_selected_vendor — read from env (set by Cloud Functions config / Secret Manager in prod)
    // Default: 'textract' — cheapest and fast; re-evaluate post-harness.
    // To change the active vendor: update FUNCTIONS_CONFIG_OCR_SELECTED_VENDOR in GCP Secret Manager
    // and redeploy, OR update the Remote Config key ocr_selected_vendor and read it dynamically.
    const selectedVendor = (
      process.env.OCR_SELECTED_VENDOR ?? "textract"
    ) as OCRResult["vendor"];

    const testCaseId = reservationId
      ? `receipt_${userId}_${reservationId}`
      : `receipt_${userId}_${Date.now()}`;

    log.info("extractReceiptData: start", {
      traceId,
      userId,
      eventId: testCaseId,
      domain: "integrations",
    }, { vendor: selectedVendor, reservationId });

    const callStart = Date.now();

    const result = await extractWithVendor(selectedVendor, {
      imageBase64,
      mimeType,
      testCaseId,
    });

    const durationMs = Date.now() - callStart;

    if (!result.success) {
      log.warn("extractReceiptData: vendor failed", {
        traceId,
        userId,
        eventId: testCaseId,
        domain: "integrations",
        durationMs,
      }, { vendor: selectedVendor, error: result.error });

      // Return a structured failure — backend verify-visit handler decides on
      // verification tier (falls back to "partially_verified" if OCR fails).
      return {
        success: false,
        extracted: {},
        vendor: selectedVendor,
        confidence: 0,
        error: result.error,
      };
    }

    log.info("extractReceiptData: complete", {
      traceId,
      userId,
      eventId: testCaseId,
      domain: "integrations",
      durationMs,
    }, {
      vendor: selectedVendor,
      confidence: result.confidence,
      hasTotal: result.extracted.totalAmount != null,
      // Cost band attribution for budget monitoring
      costBand: result.costUsd <= 0.01 ? "low" : result.costUsd <= 0.05 ? "medium" : "high",
    });

    return {
      success: true,
      extracted: result.extracted,
      vendor: result.vendor,
      confidence: result.confidence,
    };
  }
);
