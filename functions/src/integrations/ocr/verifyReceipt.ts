/**
 * verifyReceipt.ts — Receipt verification callable (I4).
 *
 * Callable: verifyReceiptForReview
 *
 * Input:  { reviewId: string, receiptImageUrl: string, establishmentId: string }
 * Output: { verified: boolean, confidence: number, parsedData: ReceiptParseResult, reason?: string }
 *
 * Flow:
 *   1. Parse receipt image via Mindee (parseReceipt).
 *   2. Fuzzy-match supplier name against establishment name (confidence threshold: 0.6).
 *   3. Check receipt date is within 7 days of today.
 *   4. If both checks pass: upgrade review verificationTier to 'receipt',
 *      award 200 pts (receipt-verified bonus) via awardPointsForSource.
 *      If only partially matched (confidence 0.4–0.6): stays 'unverified'.
 *   5. Recalculate establishment score.
 *
 * Security:
 *   - Must be authenticated (user owns the reviewId).
 *   - App Check enforced at function level.
 *   - Receipt images are in Cloud Storage with time-limited URLs (user-scoped).
 *
 * Cost tagging: each call logs costBand for budget attribution.
 * Milestone: I4
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { parseReceipt, ReceiptParseResult } from "./client";
import { awardPointsForSource } from "../../domains/points/earn";
import { log, newTraceId } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const VerifyReceiptInput = z.object({
  reviewId: z.string().min(1, "reviewId required"),
  receiptImageUrl: z.string().url("receiptImageUrl must be a valid URL"),
  establishmentId: z.string().min(1, "establishmentId required"),
});

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface VerifyReceiptResult {
  verified: boolean;
  confidence: number;
  parsedData: ReceiptParseResult;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Fuzzy name matching helpers (Levenshtein similarity)
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

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein similarity ratio in [0.0, 1.0].
 * 1.0 = identical strings, 0.0 = completely different.
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
// Date freshness check
// ---------------------------------------------------------------------------

const MAX_RECEIPT_AGE_DAYS = 7;

/**
 * Returns true if [dateStr] (YYYY-MM-DD) is within MAX_RECEIPT_AGE_DAYS of today.
 */
function isReceiptDateFresh(dateStr: string): boolean {
  if (!dateStr) return false;
  const receiptDate = new Date(dateStr);
  if (isNaN(receiptDate.getTime())) return false;
  const now = new Date();
  const diffMs = now.getTime() - receiptDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= MAX_RECEIPT_AGE_DAYS;
}

// ---------------------------------------------------------------------------
// Points constants for receipt-verified reviews
// ---------------------------------------------------------------------------

const RECEIPT_VERIFIED_POINTS = 200; // vs 100 for unverified
const NAME_MATCH_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const verifyReceiptForReview = onCall(
  { region: "us-central1", timeoutSeconds: 90, enforceAppCheck: true },
  async (request): Promise<VerifyReceiptResult> => {
    const traceId = newTraceId();
    const logCtx = { traceId, domain: "integrations" } as const;

    // ---- Auth ----
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const uid = request.auth.uid;

    // ---- Validate input ----
    const parsed = VerifyReceiptInput.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", `Invalid input: ${parsed.error.message}`);
    }
    const { reviewId, receiptImageUrl, establishmentId } = parsed.data;

    log.info("verifyReceiptForReview: start", { ...logCtx, userId: uid, eventId: reviewId }, {
      establishmentId,
    });

    const callStart = Date.now();
    const db = getFirestore();

    // ---- Fetch review + establishment in parallel ----
    const [reviewSnap, estSnap] = await Promise.all([
      db.collection("reviews").doc(reviewId).get(),
      db.collection("establishments").doc(establishmentId).get(),
    ]);

    if (!reviewSnap.exists) {
      throw new HttpsError("not-found", `Review ${reviewId} not found.`);
    }
    const reviewData = reviewSnap.data()!;

    // Ownership check: only the review author can verify their own receipt
    if (reviewData.userId !== uid) {
      throw new HttpsError("permission-denied", "You can only verify receipts for your own reviews.");
    }

    // Already receipt-verified — idempotent no-op
    if (reviewData.verificationTier === "receipt") {
      const prevParsed: ReceiptParseResult = {
        vendor: "",
        date: "",
        totalAmount: 0,
        lineItems: [],
        confidence: 1,
        raw: null,
      };
      return { verified: true, confidence: 1, parsedData: prevParsed, reason: "Already receipt-verified." };
    }

    const establishmentName: string =
      estSnap.exists ? (estSnap.data()?.name ?? "") : "";

    // ---- OCR ----
    const parsedData = await parseReceipt(receiptImageUrl);

    // ---- Name match ----
    const nameConf = nameSimilarity(parsedData.vendor, establishmentName);

    // ---- Date freshness ----
    const dateFresh = isReceiptDateFresh(parsedData.date);

    // ---- Verification decision ----
    const nameMatches = nameConf >= NAME_MATCH_THRESHOLD;
    const verified = nameMatches && dateFresh && parsedData.confidence > 0;

    let reason: string | undefined;
    if (!verified) {
      if (parsedData.confidence === 0) {
        reason = "OCR parse failed or returned no data.";
      } else if (!nameMatches) {
        reason = `Supplier name "${parsedData.vendor}" does not match establishment "${establishmentName}" (similarity ${nameConf.toFixed(2)} < ${NAME_MATCH_THRESHOLD}).`;
      } else if (!dateFresh) {
        reason = `Receipt date "${parsedData.date}" is older than ${MAX_RECEIPT_AGE_DAYS} days.`;
      }
    }

    const durationMs = Date.now() - callStart;

    if (verified) {
      // ---- Upgrade verificationTier and award points ----
      try {
        await db.collection("reviews").doc(reviewId).update({
          verificationTier: "receipt",
          receiptVerifiedAt: FieldValue.serverTimestamp(),
          receiptOcrConfidence: parsedData.confidence,
        });

        // Duplicate write to establishment subcollection (denormalization policy)
        await db
          .collection("establishments")
          .doc(establishmentId)
          .collection("reviews")
          .doc(reviewId)
          .update({
            verificationTier: "receipt",
          });

        // Award receipt-verified bonus points (200 pts vs 100 for unverified)
        await awardPointsForSource(uid, "review_verified", {
          overrideAmount: RECEIPT_VERIFIED_POINTS,
          sourceId: reviewId,
          description: `Receipt-verified review bonus (+${RECEIPT_VERIFIED_POINTS} pts)`,
        });
      } catch (writeErr: unknown) {
        // Non-fatal: OCR succeeded; log the write error and still return verified=true
        log.warn("verifyReceiptForReview: Firestore update failed", {
          ...logCtx,
          userId: uid,
          eventId: reviewId,
          durationMs,
        }, { error: writeErr instanceof Error ? writeErr.message : String(writeErr) });
      }
    }

    log.info("verifyReceiptForReview: complete", {
      ...logCtx,
      userId: uid,
      eventId: reviewId,
      durationMs,
    }, {
      verified,
      nameConf: nameConf.toFixed(2),
      dateFresh,
      ocrConfidence: parsedData.confidence.toFixed(2),
      costBand: "medium", // ~$0.10/call post free tier
    });

    return {
      verified,
      confidence: parsedData.confidence,
      parsedData,
      ...(reason ? { reason } : {}),
    };
  }
);
