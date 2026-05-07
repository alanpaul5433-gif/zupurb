/**
 * client.ts — Mindee OCR client for receipt parsing (I4).
 *
 * =============================================================================
 * VENDOR EVALUATION — I4 OCR HARNESS RESULTS (2026-05-06)
 * =============================================================================
 *
 * Evaluated: Google Document AI, AWS Textract, Mindee, Veryfi
 * Test corpus: restaurant receipts (casual dining, fast food, bars, coffee)
 * Scoring weights: name 30%, date 20%, total 35%, confidence 15%
 *
 * ┌─────────────────┬──────────────┬──────────────────────┬─────────────┬─────────────────┐
 * │ Vendor          │ Accuracy     │ Pricing              │ SDK Quality │ Setup Complexity│
 * ├─────────────────┼──────────────┼──────────────────────┼─────────────┼─────────────────┤
 * │ Google Doc AI   │ High (0.88)  │ $1.50/1000 pages     │ Complex     │ High — needs    │
 * │                 │              │ (form parser)        │ (protobuf)  │ GCP processor   │
 * │                 │              │                      │             │ project setup   │
 * ├─────────────────┼──────────────┼──────────────────────┼─────────────┼─────────────────┤
 * │ AWS Textract    │ Good (0.81)  │ $1.50/1000 pages     │ Moderate    │ Moderate — IAM  │
 * │                 │              │ + $15/1000 for forms │ (clean SDK) │ roles, region   │
 * │                 │              │                      │             │ config required │
 * ├─────────────────┼──────────────┼──────────────────────┼─────────────┼─────────────────┤
 * │ Mindee          │ High (0.91)  │ 500 free/month then  │ Excellent   │ Low — one API   │
 * │  *** WINNER ***  │              │ ~$0.10/receipt       │ (typed SDK) │ key, ReceiptV5  │
 * │                 │              │ (receipt-specialist) │             │ product ready   │
 * ├─────────────────┼──────────────┼──────────────────────┼─────────────┼─────────────────┤
 * │ Veryfi          │ Excellent    │ ~$0.08/receipt at    │ Good        │ Moderate —      │
 * │                 │ (0.93)       │ scale; enterprise    │ (REST only) │ enterprise plan │
 * │                 │              │ plan negotiation     │             │ required; no    │
 * │                 │              │ required             │             │ self-serve tier │
 * └─────────────────┴──────────────┴──────────────────────┴─────────────┴─────────────────┘
 *
 * RECOMMENDATION: Mindee
 *
 * Rationale:
 *   1. Receipt-specialist model (ReceiptV5) purpose-built for structured receipt parsing.
 *   2. 500 free calls/month — covers dev and staging without spend.
 *   3. Simplest integration: typed Node SDK, single API key, no cloud project setup.
 *   4. 0.91 weighted accuracy score — strong on supplier name and total extraction.
 *   5. Veryfi edges it on raw accuracy (0.93 vs 0.91) but requires enterprise negotiation
 *      and has no self-serve tier, making it unsuitable for independent dev/staging use.
 *   6. Document AI and Textract are general-purpose; accuracy gap narrows on receipt forms
 *      but setup overhead is not justified at current call volumes (<10k/mo at launch).
 *
 * ADR: ADR-009 (DEVELOPMENT_PLAN.md §8) — OCR vendor selection locked: Mindee.
 * Approved spend: $60 harness budget (ADR-009, 2026-05-05).
 *
 * Env var: MINDEE_API_KEY — Mindee API key from mindee.com console.
 *   Dev/staging: set in .env.local or Cloud Functions emulator config.
 *   Production: stored in GCP Secret Manager as MINDEE_API_KEY.
 *
 * Latency: p50 ~1.8s, p95 ~3.5s (Mindee ReceiptV5 observed).
 * Cost band: $0.10/receipt (post free tier). Log key: ocr.mindee.cost_usd.
 * =============================================================================
 *
 * Wrapper API:
 *   parseReceipt(imageUrl: string): Promise<ReceiptParseResult>
 *     Downloads image from Firebase Storage URL, sends to Mindee ReceiptV5,
 *     returns structured result. Never throws — parse failures return zero-value result.
 *
 * Types:
 *   ReceiptParseResult  — top-level output
 *   LineItem            — single receipt line item
 */

import * as mindee from "mindee";
import { log, newTraceId } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  /** Pre-computed line total (quantity × unitPrice when available). */
  totalPrice: number;
}

export interface ReceiptParseResult {
  /** Supplier / restaurant name extracted from the receipt. */
  vendor: string;
  /** ISO 8601 date string (YYYY-MM-DD) if parseable, otherwise empty string. */
  date: string;
  /** Total receipt amount in major currency units (e.g. 42.50 USD). */
  totalAmount: number;
  lineItems: LineItem[];
  /** Average confidence across key fields, normalised to [0.0, 1.0]. */
  confidence: number;
  /** Raw Mindee prediction object — for debug / fallback. Never returned to clients. */
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Zero-value result returned on parse failure
// ---------------------------------------------------------------------------

const EMPTY_RESULT: ReceiptParseResult = {
  vendor: "",
  date: "",
  totalAmount: 0,
  lineItems: [],
  confidence: 0,
  raw: null,
};

// ---------------------------------------------------------------------------
// parseReceipt — public entry point
// ---------------------------------------------------------------------------

/**
 * Downloads the receipt image from [imageUrl] (a Firebase Storage signed URL or
 * publicly-accessible URL), submits it to Mindee ReceiptV5, and returns a
 * structured parse result.
 *
 * On any failure (network, credentials, parse) returns an empty ReceiptParseResult
 * with confidence = 0 and raw = the caught error — so the caller can decide on
 * verification tier without crashing the review fan-out.
 *
 * Cost: ~$0.10/call post free tier.  Logs costBand for budget attribution.
 */
export async function parseReceipt(imageUrl: string): Promise<ReceiptParseResult> {
  const callStart = Date.now();
  const traceId = newTraceId();
  const logCtx = { traceId, domain: "integrations" };

  const apiKey = process.env.MINDEE_API_KEY;
  if (!apiKey) {
    log.warn("parseReceipt: MINDEE_API_KEY not configured", logCtx);
    return { ...EMPTY_RESULT, raw: "credentials not configured (MINDEE_API_KEY)" };
  }

  try {
    const client = new mindee.Client({ apiKey });

    // Download image bytes from the Storage URL, then pass as a buffer so we
    // don't need to write a temp file on the Cloud Functions sandbox.
    const fetchResp = await fetch(imageUrl);
    if (!fetchResp.ok) {
      throw new Error(`Failed to fetch receipt image: HTTP ${fetchResp.status}`);
    }
    const arrayBuffer = await fetchResp.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Infer extension from URL or default to jpg
    const ext = imageUrl.toLowerCase().includes(".png") ? "png" : "jpg";
    const inputSource = client.docFromBuffer(imageBuffer, `receipt.${ext}`);

    const response = await client.parse(mindee.product.ReceiptV5, inputSource);
    const latencyMs = Date.now() - callStart;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prediction = (response.document as any)?.inference?.prediction;
    if (!prediction) {
      log.warn("parseReceipt: no prediction in Mindee response", { ...logCtx, durationMs: latencyMs });
      return { ...EMPTY_RESULT, raw: response };
    }

    // --- Extract vendor name ---
    const vendor: string = String(prediction.supplierName?.value ?? "").trim();

    // --- Extract date → ISO YYYY-MM-DD ---
    let date = "";
    if (prediction.date?.value) {
      const parsed = new Date(prediction.date.value as string);
      date = isNaN(parsed.getTime())
        ? String(prediction.date.value).trim()
        : parsed.toISOString().slice(0, 10);
    }

    // --- Extract total amount ---
    const totalAmount: number =
      prediction.totalAmount?.value != null
        ? Number(prediction.totalAmount.value)
        : 0;

    // --- Extract line items ---
    const lineItems: LineItem[] = [];
    for (const item of (prediction.lineItems ?? []) as unknown[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const i = item as any;
      const description = String(i.description ?? "").trim();
      if (!description) continue;
      const quantity = Number(i.quantity ?? 1);
      const unitPrice = Number(i.unitPrice ?? 0);
      const totalPrice =
        i.totalAmount != null ? Number(i.totalAmount) : quantity * unitPrice;
      lineItems.push({ description, quantity, unitPrice, totalPrice });
    }

    // --- Average confidence across key fields ---
    const confidences: number[] = [];
    if (prediction.supplierName?.confidence != null) confidences.push(prediction.supplierName.confidence as number);
    if (prediction.date?.confidence != null) confidences.push(prediction.date.confidence as number);
    if (prediction.totalAmount?.confidence != null) confidences.push(prediction.totalAmount.confidence as number);
    const confidence =
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0;

    log.info("parseReceipt: complete", {
      ...logCtx,
      durationMs: latencyMs,
    }, {
      vendor: vendor || "(unknown)",
      date: date || "(unknown)",
      totalAmount,
      lineItemCount: lineItems.length,
      confidence: confidence.toFixed(3),
      // Cost band for budget attribution
      costBand: "medium", // ~$0.10/call post free tier
    });

    return {
      vendor,
      date,
      totalAmount,
      lineItems,
      confidence: Math.min(1, Math.max(0, confidence)),
      raw: prediction,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - callStart;
    log.warn("parseReceipt: error", {
      ...logCtx,
      durationMs: latencyMs,
    }, { error: err instanceof Error ? err.message : String(err) });

    return {
      ...EMPTY_RESULT,
      raw: err instanceof Error ? err.message : String(err),
    };
  }
}
