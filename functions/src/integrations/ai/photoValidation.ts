/**
 * integrations/ai/photoValidation.ts — Claude Vision wrapper for review photo context check.
 *
 * Reads ANTHROPIC_API_KEY from the environment.
 * Model: claude-haiku-4-5 (vision)
 *
 * Purpose:
 *   Determine whether a photo uploaded with a review shows food, a
 *   restaurant/bar/venue interior, or a receipt — i.e., is relevant to
 *   the review context. Photos of unrelated subjects (selfies, street
 *   scenes, etc.) should be flagged.
 *
 * Graceful degradation:
 *   - Missing API key → returns valid:true with reason "skipped:no_key" so
 *     the review flow is never blocked by a missing credential.
 *   - Any API error → returns valid:true with reason "skipped:api_error".
 *   The caller in photoTrigger.ts sets photoContextInvalid only when valid=false.
 *
 * Telemetry:
 *   - Logs costBand: "claude:haiku:vision" on every call.
 *   - Logs durationMs on every completion.
 *
 * Milestone: I5
 */

import Anthropic from "@anthropic-ai/sdk";
import { log } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PhotoValidationResult {
  /** true when the photo is contextually appropriate for a review */
  valid: boolean;
  /**
   * Confidence in the classification in [0, 1].
   * Heuristic: 1.0 for definitive yes/no answers; 0.5 for ambiguous.
   */
  confidence: number;
  /** Human-readable reason — used for logging and admin queue */
  reason: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 20; // We only need "yes" or "no" + brief reason

// ---------------------------------------------------------------------------
// validateReviewPhoto
// ---------------------------------------------------------------------------

/**
 * Sends an image to Claude Haiku vision and checks whether it is contextually
 * appropriate for a restaurant/venue review.
 *
 * @param imageUrl  Publicly accessible URL of the image to validate.
 * @param traceId   Correlation ID for logging.
 * @param eventId   Entity ID for log attribution (e.g., reviewId).
 * @returns         PhotoValidationResult — never throws.
 */
export async function validateReviewPhoto(
  imageUrl: string,
  traceId: string,
  eventId: string
): Promise<PhotoValidationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    log.warn("photoValidation: ANTHROPIC_API_KEY not set — skipping validation", {
      traceId,
      eventId,
      domain: "ai",
      costBand: "claude:haiku:vision",
    });
    return { valid: true, confidence: 1.0, reason: "skipped:no_key" };
  }

  const client = new Anthropic({ apiKey });
  const startMs = Date.now();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            {
              type: "text",
              text: 'Is this a photo of food, a restaurant/bar/venue interior, or a receipt? Answer "yes" or "no" only.',
            },
          ],
        },
      ],
    });

    const durationMs = Date.now() - startMs;

    const block = response.content[0];
    if (!block || block.type !== "text") {
      log.error("photoValidation: unexpected response shape", {
        traceId,
        eventId,
        domain: "ai",
        costBand: "claude:haiku:vision",
      }, { durationMs });
      return { valid: true, confidence: 0.5, reason: "skipped:unexpected_response" };
    }

    const answer = block.text.trim().toLowerCase();
    const isYes = answer.startsWith("yes");
    const isNo  = answer.startsWith("no");
    const definitive = isYes || isNo;

    log.info("photoValidation: complete", {
      traceId,
      eventId,
      domain: "ai",
      costBand: "claude:haiku:vision",
    }, {
      durationMs,
      answer,
      valid: isYes || !definitive,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    if (!definitive) {
      // Ambiguous answer — fail-open
      return { valid: true, confidence: 0.5, reason: `ambiguous:${answer}` };
    }

    return {
      valid: isYes,
      confidence: 1.0,
      reason: isYes ? "context:valid" : "context:invalid",
    };
  } catch (err) {
    const durationMs = Date.now() - startMs;
    log.error("photoValidation: API call failed", {
      traceId,
      eventId,
      domain: "ai",
      costBand: "claude:haiku:vision",
    }, { error: String(err), durationMs });
    // Fail-open: do not invalidate photos on API errors
    return { valid: true, confidence: 0.5, reason: "skipped:api_error" };
  }
}
