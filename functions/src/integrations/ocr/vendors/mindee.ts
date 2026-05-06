/**
 * mindee.ts — Mindee vendor adapter.
 *
 * Uses Mindee Node SDK with the ReceiptV5 product for structured receipt parsing.
 *
 * SDK: mindee (npm)
 * Product: mindee.product.ReceiptV5
 *
 * Credentials (from environment — never hardcoded):
 *   MINDEE_API_KEY — Mindee API key from mindee.com console
 *
 * Estimated cost: ~$0.10/page
 *
 * I4 — OCR vendor evaluation harness.
 */

import * as mindee from "mindee";
import { OCRInput, OCRResult, OCRVendorAdapter } from "../types";

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const mindeeAdapter: OCRVendorAdapter = {
  name: "mindee",
  estimatedCostPerCall: 0.10,

  async extract(input: OCRInput): Promise<OCRResult> {
    const start = Date.now();

    const apiKey = process.env.MINDEE_API_KEY;

    if (!apiKey) {
      return {
        vendor: "mindee",
        success: false,
        latencyMs: Date.now() - start,
        costUsd: 0,
        extracted: {},
        confidence: 0,
        error: "credentials not configured (MINDEE_API_KEY)",
      };
    }

    try {
      const client = new mindee.Client({ apiKey });

      // Build an InMemoryInput from the base64 bytes
      const imageBuffer  = Buffer.from(input.imageBase64, "base64");
      const inputSource  = client.docFromBuffer(
        imageBuffer,
        `receipt.${input.mimeType === "image/png" ? "png" : "jpg"}`
      );

      const response = await client.parse(mindee.product.ReceiptV5, inputSource);
      const latencyMs = Date.now() - start;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prediction = (response.document as any)?.inference?.prediction;
      if (!prediction) {
        return {
          vendor: "mindee",
          success: false,
          latencyMs,
          costUsd: 0,
          extracted: {},
          confidence: 0,
          error: "No prediction in Mindee response",
        };
      }

      // --- Extract structured fields ---
      const establishmentName: string | undefined =
        prediction.supplierName?.value ?? undefined;

      let date: string | undefined;
      if (prediction.date?.value) {
        const parsed = new Date(prediction.date.value as string);
        date = isNaN(parsed.getTime())
          ? String(prediction.date.value)
          : parsed.toISOString().slice(0, 10);
      }

      let totalAmount: number | undefined;
      if (prediction.totalAmount?.value != null) {
        totalAmount = Math.round(Number(prediction.totalAmount.value) * 100);
      }

      // Line items
      const lineItems: Array<{ description: string; amount: number }> = [];
      for (const item of prediction.lineItems ?? []) {
        const description = String(item.description ?? "").trim();
        const totalPrice  = item.totalAmount ?? item.unitPrice ?? 0;
        const amount      = Math.round(Number(totalPrice) * 100);
        if (description) lineItems.push({ description, amount });
      }

      // Confidence — Mindee provides per-field confidence; take average of key fields
      const confidences: number[] = [];
      if (prediction.supplierName?.confidence != null) confidences.push(prediction.supplierName.confidence as number);
      if (prediction.date?.confidence != null) confidences.push(prediction.date.confidence as number);
      if (prediction.totalAmount?.confidence != null) confidences.push(prediction.totalAmount.confidence as number);
      const avgConfidence =
        confidences.length > 0
          ? confidences.reduce((a, b) => a + b, 0) / confidences.length
          : 0;

      return {
        vendor: "mindee",
        success: true,
        latencyMs,
        costUsd: 0.10,
        extracted: {
          establishmentName,
          date,
          totalAmount,
          lineItems: lineItems.length ? lineItems : undefined,
        },
        confidence: Math.min(1, avgConfidence),
      };
    } catch (err: unknown) {
      return {
        vendor: "mindee",
        success: false,
        latencyMs: Date.now() - start,
        costUsd: 0,
        extracted: {},
        confidence: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
