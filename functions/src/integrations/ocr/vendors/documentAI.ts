/**
 * documentAI.ts — Google Document AI vendor adapter.
 *
 * Uses the REST API directly (node-fetch) to avoid the heavy @google-cloud/documentai SDK.
 * Auth: Google Application Default Credentials (ADC) via googleapis token exchange.
 *
 * Endpoint:
 *   POST https://documentai.googleapis.com/v1/projects/{projectId}/locations/us/processors/{processorId}:process
 *
 * Credentials (from environment — never hardcoded):
 *   DOCUMENT_AI_PROJECT_ID   — GCP project ID
 *   DOCUMENT_AI_PROCESSOR_ID — Processor ID from Document AI console
 *
 * Estimated cost: ~$0.10/page
 *
 * I4 — OCR vendor evaluation harness.
 */

import { OCRInput, OCRResult, OCRVendorAdapter } from "../types";

// ---------------------------------------------------------------------------
// Helper: obtain a Google OAuth2 access token via ADC metadata server
// (works in Cloud Functions without any extra SDK)
// ---------------------------------------------------------------------------
async function getGoogleAccessToken(): Promise<string> {
  // In Cloud Functions, the metadata server is always available.
  const metaUrl =
    "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
  const res = await fetch(metaUrl, {
    headers: { "Metadata-Flavor": "Google" },
  });
  if (!res.ok) {
    throw new Error(`Metadata server error: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const documentAIAdapter: OCRVendorAdapter = {
  name: "document_ai",
  estimatedCostPerCall: 0.10,

  async extract(input: OCRInput): Promise<OCRResult> {
    const start = Date.now();

    const projectId  = process.env.DOCUMENT_AI_PROJECT_ID;
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

    if (!projectId || !processorId) {
      return {
        vendor: "document_ai",
        success: false,
        latencyMs: Date.now() - start,
        costUsd: 0,
        extracted: {},
        confidence: 0,
        error: "credentials not configured (DOCUMENT_AI_PROJECT_ID / DOCUMENT_AI_PROCESSOR_ID)",
      };
    }

    try {
      const token = await getGoogleAccessToken();
      const url = `https://documentai.googleapis.com/v1/projects/${projectId}/locations/us/processors/${processorId}:process`;

      const body = {
        rawDocument: {
          content: input.imageBase64,
          mimeType: input.mimeType,
        },
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const latencyMs = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text();
        return {
          vendor: "document_ai",
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
      const doc  = data?.document ?? {};

      // --- Extract fields from Document AI entity detections ---
      const entities: Array<{ type: string; mentionText: string; confidence?: number }> =
        doc.entities ?? [];

      let establishmentName: string | undefined;
      let date: string | undefined;
      let totalAmount: number | undefined;
      const lineItems: Array<{ description: string; amount: number }> = [];
      let maxConfidence = 0;

      for (const entity of entities) {
        const type  = (entity.type ?? "").toLowerCase();
        const value = (entity.mentionText ?? "").trim();
        const conf  = entity.confidence ?? 0;
        if (conf > maxConfidence) maxConfidence = conf;

        if (type.includes("merchant") || type.includes("supplier") || type.includes("restaurant")) {
          establishmentName = value;
        } else if (type.includes("receipt_date") || type.includes("date")) {
          // Attempt ISO normalisation
          const parsed = new Date(value);
          date = isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
        } else if (type.includes("total_amount") || type.includes("net_amount")) {
          // Strip currency symbols and parse to cents
          const numeric = parseFloat(value.replace(/[^0-9.]/g, ""));
          if (!isNaN(numeric)) totalAmount = Math.round(numeric * 100);
        } else if (type.includes("line_item")) {
          // Line items sometimes come as parent entities with properties
          const amountProp = (entity as unknown as { properties?: Array<{ type: string; mentionText: string }> })
            .properties?.find((p) => p.type.toLowerCase().includes("amount"));
          const amount = amountProp
            ? Math.round(parseFloat(amountProp.mentionText.replace(/[^0-9.]/g, "")) * 100)
            : 0;
          if (value) lineItems.push({ description: value, amount });
        }
      }

      const rawText: string = doc.text ?? "";

      return {
        vendor: "document_ai",
        success: true,
        latencyMs,
        costUsd: 0.10,
        extracted: {
          establishmentName,
          date,
          totalAmount,
          lineItems: lineItems.length ? lineItems : undefined,
          rawText: rawText.slice(0, 2000), // cap to avoid storing huge payloads
        },
        confidence: maxConfidence,
      };
    } catch (err: unknown) {
      return {
        vendor: "document_ai",
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
