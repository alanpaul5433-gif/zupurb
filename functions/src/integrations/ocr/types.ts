/**
 * types.ts — Shared types for the OCR vendor harness (I4).
 *
 * Used by all vendor adapters, the harness orchestrator, and the Cloud Function callables.
 * Consumers (verify-visit flow) import only OCRResult and OCRHarnessResult — never vendor shapes.
 *
 * Cost model per call (estimated at harness time, 2026-05-05):
 *   Document AI: ~$0.10/page
 *   Textract:    ~$0.01/page   (cheapest)
 *   Mindee:      ~$0.10/page
 *   Veryfi:      ~$0.08/page
 */

export interface OCRInput {
  /** Base64-encoded receipt image (no data-URI prefix). */
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png";
  /** Unique identifier used for Firestore harness result storage and cost attribution. */
  testCaseId: string;
}

export interface OCRResult {
  vendor: "document_ai" | "textract" | "mindee" | "veryfi";
  success: boolean;
  /** Wall-clock time from call start to response, in milliseconds. */
  latencyMs: number;
  /** Estimated USD cost for this single call. */
  costUsd: number;
  extracted: {
    establishmentName?: string;
    /** ISO 8601 date string (YYYY-MM-DD) if parseable, otherwise raw string. */
    date?: string;
    /** Total receipt amount in cents (integer). */
    totalAmount?: number;
    lineItems?: Array<{ description: string; amount: number }>;
    /** Full raw text extracted by the vendor — useful for debugging/fallback. */
    rawText?: string;
  };
  /** Vendor-reported overall confidence score, normalised to [0.0, 1.0]. */
  confidence: number;
  /** Populated when success === false. Maps vendor-specific errors to a human-readable string. */
  error?: string;
}

export interface OCRHarnessResult {
  testCaseId: string;
  /** One OCRResult per vendor attempted (including failed ones). */
  results: OCRResult[];
  /** Vendor identifier for the best-scoring result. */
  winner: string;
  /** vendor → accuracy score map (0.0–1.0). */
  scores: Record<string, number>;
  /** Sum of costUsd across all vendor results. */
  totalCostUsd: number;
  /** Recommended vendor to use in production (same as winner unless overridden by tie-break). */
  recommendedVendor: string;
  /** Human-readable explanation of the recommendation. */
  recommendation: string;
}

/**
 * Contract every vendor adapter must satisfy.
 * Adapters must NOT throw — they catch internally and return success: false.
 */
export interface OCRVendorAdapter {
  readonly name: OCRResult["vendor"];
  /** Expected USD cost per page call — used for budget attribution in logs. */
  readonly estimatedCostPerCall: number;
  extract(input: OCRInput): Promise<OCRResult>;
}
