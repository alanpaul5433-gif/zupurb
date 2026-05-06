/**
 * veryfi.ts — Veryfi vendor adapter.
 *
 * Uses the Veryfi REST API v8 directly via node fetch to process receipt images.
 * Endpoint: https://api.veryfi.com/api/v8/partner/documents/
 *
 * Credentials (from environment — never hardcoded):
 *   VERYFI_CLIENT_ID     — Veryfi client ID
 *   VERYFI_CLIENT_SECRET — Veryfi client secret
 *   VERYFI_USERNAME      — Veryfi username
 *   VERYFI_API_KEY       — Veryfi API key
 *
 * Estimated cost: ~$0.08/page
 *
 * I4 — OCR vendor evaluation harness.
 */

import { OCRInput, OCRResult, OCRVendorAdapter } from "../types";

// ---------------------------------------------------------------------------
// Veryfi HMAC signature helper
// ---------------------------------------------------------------------------
import { createHmac } from "crypto";

function buildVeryfiAuthHeaders(
  clientId: string,
  clientSecret: string,
  username: string,
  apiKey: string,
  body: string
): Record<string, string> {
  const timestamp = Date.now().toString();
  const hashedBody = createHmac("sha256", clientSecret)
    .update(body)
    .digest("base64");
  const signature = createHmac("sha256", clientSecret)
    .update(`${timestamp}:${hashedBody}`)
    .digest("base64");

  return {
    "Content-Type": "application/json",
    "Client-Id": clientId,
    Authorization: `apikey ${username}:${apiKey}`,
    "X-Veryfi-Request-Timestamp": timestamp,
    "X-Veryfi-Request-Signature": signature,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const veryfiAdapter: OCRVendorAdapter = {
  name: "veryfi",
  estimatedCostPerCall: 0.08,

  async extract(input: OCRInput): Promise<OCRResult> {
    const start = Date.now();

    const clientId     = process.env.VERYFI_CLIENT_ID;
    const clientSecret = process.env.VERYFI_CLIENT_SECRET;
    const username     = process.env.VERYFI_USERNAME;
    const apiKey       = process.env.VERYFI_API_KEY;

    if (!clientId || !clientSecret || !username || !apiKey) {
      return {
        vendor: "veryfi",
        success: false,
        latencyMs: Date.now() - start,
        costUsd: 0,
        extracted: {},
        confidence: 0,
        error: "credentials not configured (VERYFI_CLIENT_ID / VERYFI_CLIENT_SECRET / VERYFI_USERNAME / VERYFI_API_KEY)",
      };
    }

    try {
      const payload = {
        file_data: input.imageBase64,
        // Include receipt-relevant categories
        categories: ["Meals & Entertainment", "Food & Drink"],
        auto_delete: false,
        boost_mode: 1,
        external_id: input.testCaseId,
      };

      const bodyStr = JSON.stringify(payload);
      const headers = buildVeryfiAuthHeaders(clientId, clientSecret, username, apiKey, bodyStr);

      const res = await fetch("https://api.veryfi.com/api/v8/partner/documents/", {
        method: "POST",
        headers,
        body: bodyStr,
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text();
        return {
          vendor: "veryfi",
          success: false,
          latencyMs,
          costUsd: 0,
          extracted: {},
          confidence: 0,
          error: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await res.json()) as any;

      // --- Extract fields ---
      const establishmentName: string | undefined =
        data.vendor?.name ?? data.vendor?.raw_name ?? undefined;

      let date: string | undefined;
      if (data.date) {
        // Veryfi returns dates in YYYY-MM-DD HH:MM:SS or ISO format
        const parsed = new Date(data.date as string);
        date = isNaN(parsed.getTime())
          ? String(data.date)
          : parsed.toISOString().slice(0, 10);
      }

      let totalAmount: number | undefined;
      if (data.total != null) {
        totalAmount = Math.round(Number(data.total) * 100);
      }

      // Line items
      const lineItems: Array<{ description: string; amount: number }> = [];
      for (const item of data.line_items ?? []) {
        const description = String(item.description ?? item.name ?? "").trim();
        const amount = Math.round(Number(item.total ?? item.price ?? 0) * 100);
        if (description) lineItems.push({ description, amount });
      }

      // Veryfi does not expose a single confidence score — use ocr_confidence if present,
      // else derive from presence of key fields
      let confidence = 0;
      if (data.ocr_confidence != null) {
        confidence = Math.min(1, Number(data.ocr_confidence) / 100);
      } else {
        const fieldsPresent = [establishmentName, date, totalAmount]
          .filter((v) => v != null).length;
        confidence = fieldsPresent / 3;
      }

      return {
        vendor: "veryfi",
        success: true,
        latencyMs,
        costUsd: 0.08,
        extracted: {
          establishmentName,
          date,
          totalAmount,
          lineItems: lineItems.length ? lineItems : undefined,
        },
        confidence,
      };
    } catch (err: unknown) {
      return {
        vendor: "veryfi",
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
