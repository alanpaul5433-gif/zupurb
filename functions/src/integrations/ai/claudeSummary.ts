/**
 * integrations/ai/claudeSummary.ts — Claude Haiku wrapper for review summarisation.
 *
 * Reads ANTHROPIC_API_KEY from the environment.
 * Model: claude-haiku-4-5
 * Max output tokens: 150
 *
 * Prompt contract:
 *   Given up to 20 written review texts for an establishment, produce a 2–3
 *   sentence neutral summary highlighting common themes across food quality,
 *   service, and atmosphere.
 *
 * Graceful degradation:
 *   - Missing API key → throws IntegrationError so callers can fail-soft.
 *   - Non-2xx / network error → throws IntegrationError.
 *   - Empty text array → throws IntegrationError.
 *
 * Telemetry:
 *   - Logs costBand: "claude:haiku:summary" on every call for budget attribution.
 *   - Logs durationMs on every completion.
 *
 * Milestone: I5
 */

import Anthropic from "@anthropic-ai/sdk";
import { log } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class IntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationError";
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 150;
const REVIEWS_TO_USE = 20;

// ---------------------------------------------------------------------------
// summariseReviews
// ---------------------------------------------------------------------------

/**
 * Calls Claude Haiku to produce a 2–3 sentence neutral summary of the
 * provided review texts.
 *
 * @param reviewTexts  Array of written review bodies (up to 20). Non-empty.
 * @param traceId      Correlation ID for logging.
 * @returns            Summary string (≤ 500 characters expected; model output ≤ 150 tokens).
 * @throws             IntegrationError on missing key, empty input, or API failure.
 */
export async function summariseReviews(
  reviewTexts: string[],
  traceId: string
): Promise<string> {
  if (reviewTexts.length === 0) {
    throw new IntegrationError("claudeSummary: reviewTexts array is empty");
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new IntegrationError(
      "claudeSummary: ANTHROPIC_API_KEY is not set"
    );
  }

  const client = new Anthropic({ apiKey });
  const startMs = Date.now();

  // Use up to REVIEWS_TO_USE reviews; each prefixed with a bullet for clarity.
  const reviewsSlice = reviewTexts.slice(0, REVIEWS_TO_USE);
  const reviewBlock = reviewsSlice
    .map((t, i) => `${i + 1}. ${t.replace(/\n+/g, " ").trim()}`)
    .join("\n");

  const userPrompt = `Here are up to ${reviewsSlice.length} customer reviews for a venue:\n\n${reviewBlock}\n\nWrite a 2–3 sentence neutral summary that highlights the most common themes across food quality, service, and atmosphere. Do not mention individual reviewers. Be objective and factual.`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: userPrompt }],
    });

    const durationMs = Date.now() - startMs;

    const block = response.content[0];
    if (!block || block.type !== "text") {
      log.error("claudeSummary: unexpected response shape", {
        traceId,
        domain: "ai",
        eventId: "claudeSummary",
        costBand: "claude:haiku:summary",
      }, { durationMs, stopReason: response.stop_reason });
      throw new IntegrationError("claudeSummary: no text block in response");
    }

    const summary = block.text.trim();

    log.info("claudeSummary: complete", {
      traceId,
      domain: "ai",
      eventId: "claudeSummary",
      costBand: "claude:haiku:summary",
    }, {
      durationMs,
      reviewsUsed: reviewsSlice.length,
      summaryLength: summary.length,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    return summary;
  } catch (err) {
    const durationMs = Date.now() - startMs;

    if (err instanceof IntegrationError) throw err;

    log.error("claudeSummary: API call failed", {
      traceId,
      domain: "ai",
      eventId: "claudeSummary",
      costBand: "claude:haiku:summary",
    }, { error: String(err), durationMs });

    throw new IntegrationError(`claudeSummary: ${String(err)}`);
  }
}
