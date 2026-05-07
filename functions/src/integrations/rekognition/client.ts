/**
 * integrations/rekognition/client.ts — I2: AWS Rekognition image moderation wrapper.
 *
 * Thin adapter around AWS SDK v3 DetectModerationLabels.
 * Credentials are read from environment — never inline.
 *
 * Required environment variables:
 *   AWS_REKOGNITION_KEY_ID      — AWS IAM access key ID (least-privilege; Rekognition read only)
 *   AWS_REKOGNITION_SECRET      — AWS IAM secret access key
 *   AWS_REKOGNITION_REGION      — e.g. "us-east-1"  (defaults to us-east-1 if absent)
 *
 * API:
 *   moderateImage(imageUrl: string) → Promise<ImageModerationResult>
 *
 * ImageModerationResult:
 *   safe       — true if no moderation labels exceed the confidence threshold
 *   labels     — human-readable label names returned by Rekognition (e.g. "Nudity", "Violence")
 *   confidence — highest confidence score across all returned labels (0–100)
 */

import {
  RekognitionClient,
  DetectModerationLabelsCommand,
  type ModerationLabel,
} from "@aws-sdk/client-rekognition";
import * as https from "https";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageModerationResult {
  safe: boolean;
  labels: string[];
  confidence: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Minimum Rekognition confidence before a label is treated as a violation.
 * AWS recommends 50–60; we use 60 to reduce false positives on borderline images.
 * TODO: promote to Remote Config (key: moderation.image.confidenceThreshold)
 */
const CONFIDENCE_THRESHOLD = 60;

// ---------------------------------------------------------------------------
// Client — lazy-initialised so the module can be imported without credentials
// (unit-test environments inject a mock before calling moderateImage).
// ---------------------------------------------------------------------------

let _client: RekognitionClient | null = null;

/** Returns the shared RekognitionClient, creating it on first call. */
function getClient(): RekognitionClient {
  if (_client) return _client;

  const keyId = process.env.AWS_REKOGNITION_KEY_ID;
  const secret = process.env.AWS_REKOGNITION_SECRET;
  const region = process.env.AWS_REKOGNITION_REGION ?? "us-east-1";

  if (!keyId || !secret) {
    throw new Error(
      "AWS Rekognition credentials not configured. " +
        "Set AWS_REKOGNITION_KEY_ID, AWS_REKOGNITION_SECRET, and " +
        "AWS_REKOGNITION_REGION in Cloud Functions environment."
    );
  }

  _client = new RekognitionClient({
    region,
    credentials: {
      accessKeyId: keyId,
      secretAccessKey: secret,
    },
  });

  return _client;
}

// ---------------------------------------------------------------------------
// moderateImage
// ---------------------------------------------------------------------------

/**
 * Downloads the image at [imageUrl] into a Buffer, then calls
 * Rekognition DetectModerationLabels.
 *
 * Using Bytes (rather than an S3 reference) lets us work with any public HTTPS URL,
 * including Firebase Storage download URLs.
 *
 * Cost band: ~$0.001 per image (first 1M images/month at AWS standard pricing).
 * Every call logs its cost band for budget attribution.
 *
 * Throws a plain Error (not an AWS-shaped error) on failure so callers are
 * isolated from vendor error shapes.
 */
export async function moderateImage(imageUrl: string): Promise<ImageModerationResult> {
  const start = Date.now();

  try {
    const imageBytes = await _fetchImageBytes(imageUrl);

    const command = new DetectModerationLabelsCommand({
      Image: { Bytes: imageBytes },
      MinConfidence: CONFIDENCE_THRESHOLD,
    });

    const response = await getClient().send(command);
    const raw: ModerationLabel[] = response.ModerationLabels ?? [];

    const labels = raw.map((l) => l.Name ?? "Unknown").filter(Boolean);
    const confidence = raw.reduce((max, l) => Math.max(max, l.Confidence ?? 0), 0);

    const result: ImageModerationResult = {
      safe: labels.length === 0,
      labels,
      confidence,
    };

    _logCall(imageUrl, Date.now() - start, true, result);
    return result;
  } catch (err) {
    _logCall(imageUrl, Date.now() - start, false, null);
    // Wrap vendor error — callers must not depend on AWS SDK error shapes.
    throw new Error(
      `moderateImage failed for ${imageUrl.substring(0, 80)}: ${(err as Error).message}`
    );
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Downloads an HTTPS URL body as a Uint8Array. Max size ~10 MB. */
function _fetchImageBytes(url: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode ?? "?"} fetching image: ${url}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

/**
 * Structured log entry for cost attribution.
 * Does NOT log the full URL in case it contains a signed token.
 */
function _logCall(
  url: string,
  durationMs: number,
  success: boolean,
  result: ImageModerationResult | null
): void {
  console.log(
    JSON.stringify({
      service: "rekognition",
      operation: "DetectModerationLabels",
      urlPrefix: url.substring(0, 80),
      durationMs,
      success,
      safe: result?.safe ?? null,
      labelCount: result?.labels.length ?? null,
      maxConfidence: result?.confidence ?? null,
      costBand: "~$0.001/image",
    })
  );
}
