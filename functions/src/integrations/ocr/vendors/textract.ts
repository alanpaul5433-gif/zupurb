/**
 * textract.ts — AWS Textract vendor adapter.
 *
 * Uses AnalyzeExpense API — purpose-built for receipt/expense parsing.
 * SDK: @aws-sdk/client-textract (v3)
 *
 * Credentials (from environment — never hardcoded):
 *   AWS_ACCESS_KEY_ID     — AWS IAM key
 *   AWS_SECRET_ACCESS_KEY — AWS IAM secret
 *   AWS_REGION            — defaults to us-east-1
 *
 * Estimated cost: ~$0.01/page (cheapest of the four candidates)
 *
 * I4 — OCR vendor evaluation harness.
 */

import {
  TextractClient,
  AnalyzeExpenseCommand,
  type ExpenseField,
  type LineItemFields,
} from "@aws-sdk/client-textract";
import { OCRInput, OCRResult, OCRVendorAdapter } from "../types";

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const textractAdapter: OCRVendorAdapter = {
  name: "textract",
  estimatedCostPerCall: 0.01,

  async extract(input: OCRInput): Promise<OCRResult> {
    const start = Date.now();

    const accessKeyId     = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region          = process.env.AWS_REGION ?? "us-east-1";

    if (!accessKeyId || !secretAccessKey) {
      return {
        vendor: "textract",
        success: false,
        latencyMs: Date.now() - start,
        costUsd: 0,
        extracted: {},
        confidence: 0,
        error: "credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)",
      };
    }

    try {
      const client = new TextractClient({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });

      // Convert base64 to Uint8Array for AWS SDK
      const imageBytes = Buffer.from(input.imageBase64, "base64");

      const command = new AnalyzeExpenseCommand({
        Document: { Bytes: imageBytes },
      });

      const response = await client.send(command);
      const latencyMs = Date.now() - start;

      const expenseDoc = response.ExpenseDocuments?.[0];
      if (!expenseDoc) {
        return {
          vendor: "textract",
          success: false,
          latencyMs,
          costUsd: 0,
          extracted: {},
          confidence: 0,
          error: "No expense document in Textract response",
        };
      }

      // --- Parse summary fields ---
      let establishmentName: string | undefined;
      let date: string | undefined;
      let totalAmount: number | undefined;
      let totalConfidence = 0;
      let fieldCount = 0;

      const summaryFields: ExpenseField[] = expenseDoc.SummaryFields ?? [];
      for (const field of summaryFields) {
        const type  = (field.Type?.Text ?? "").toUpperCase();
        const value = (field.ValueDetection?.Text ?? "").trim();
        const conf  = field.ValueDetection?.Confidence ?? 0;

        totalConfidence += conf;
        fieldCount++;

        if (type === "NAME" || type === "VENDOR_NAME" || type === "MERCHANT_NAME") {
          establishmentName = value || undefined;
        } else if (type === "INVOICE_RECEIPT_DATE" || type === "DATE") {
          const parsed = new Date(value);
          date = isNaN(parsed.getTime()) ? value : parsed.toISOString().slice(0, 10);
        } else if (type === "TOTAL" || type === "AMOUNT_PAID") {
          const numeric = parseFloat(value.replace(/[^0-9.]/g, ""));
          if (!isNaN(numeric)) totalAmount = Math.round(numeric * 100);
        }
      }

      // --- Parse line items ---
      const lineItems: Array<{ description: string; amount: number }> = [];
      const lineItemGroups: LineItemFields[][] = expenseDoc.LineItemGroups?.map((g) => g.LineItems ?? []) ?? [];
      for (const group of lineItemGroups) {
        for (const lineItem of group) {
          let description = "";
          let amount = 0;
          for (const field of lineItem.LineItemExpenseFields ?? []) {
            const t = (field.Type?.Text ?? "").toUpperCase();
            const v = (field.ValueDetection?.Text ?? "").trim();
            if (t === "ITEM" || t === "PRODUCT_CODE") description = v;
            else if (t === "PRICE" || t === "UNIT_PRICE") {
              const n = parseFloat(v.replace(/[^0-9.]/g, ""));
              if (!isNaN(n)) amount = Math.round(n * 100);
            }
          }
          if (description) lineItems.push({ description, amount });
        }
      }

      // Confidence normalised to [0, 1] (Textract reports 0–100)
      const avgConfidence = fieldCount > 0 ? (totalConfidence / fieldCount) / 100 : 0;

      return {
        vendor: "textract",
        success: true,
        latencyMs,
        costUsd: 0.01,
        extracted: {
          establishmentName,
          date,
          totalAmount,
          lineItems: lineItems.length ? lineItems : undefined,
        },
        confidence: avgConfidence,
      };
    } catch (err: unknown) {
      return {
        vendor: "textract",
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
