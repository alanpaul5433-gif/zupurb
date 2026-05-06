/**
 * integrations/perspective/client.ts — REST client for the Perspective API.
 *
 * API endpoint: https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze
 * API key credential: process.env.PERSPECTIVE_API_KEY
 *
 * Requested attributes: TOXICITY, SEVERE_TOXICITY, INSULT, PROFANITY, THREAT
 *
 * Graceful degradation:
 *   - If PERSPECTIVE_API_KEY is not set, logs a warning and returns all scores as 0
 *     so the review flow is never broken by a missing credential.
 *   - Any non-2xx response or network error also returns all-zero scores and logs
 *     the error — callers must not propagate Perspective failures to end users.
 *
 * Telemetry:
 *   - Every call logs domain: "moderation", costBand: "perspective:analyze"
 *   - Timing (durationMs) is included on every completion log entry
 *
 * Timeout: 5000 ms
 *
 * Milestone: I9
 */

import { log } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerspectiveResult {
  toxicity: number;
  severeToxicity: number;
  insult: number;
  profanity: number;
  threat: number;
}

/** All-zero result used for pass-through on missing credentials or API error. */
export const ZERO_SCORES: PerspectiveResult = {
  toxicity: 0,
  severeToxicity: 0,
  insult: 0,
  profanity: 0,
  threat: 0,
};

// ---------------------------------------------------------------------------
// Internal Perspective API response shape
// ---------------------------------------------------------------------------

interface PerspectiveAttributeScore {
  summaryScore: { value: number };
}

interface PerspectiveResponse {
  attributeScores: {
    TOXICITY?: PerspectiveAttributeScore;
    SEVERE_TOXICITY?: PerspectiveAttributeScore;
    INSULT?: PerspectiveAttributeScore;
    PROFANITY?: PerspectiveAttributeScore;
    THREAT?: PerspectiveAttributeScore;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PERSPECTIVE_URL =
  "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";
const TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * analyzeText — calls the Perspective API and returns normalized attribute scores.
 *
 * @param text     The review or comment text to evaluate.
 * @param eventId  Trace correlation identifier (review ID or request ID).
 * @param traceId  Parent trace ID from the calling function.
 * @returns        PerspectiveResult with scores in [0, 1], or all-zero on error/missing key.
 */
export async function analyzeText(
  text: string,
  eventId: string,
  traceId: string
): Promise<PerspectiveResult> {
  const apiKey = process.env.PERSPECTIVE_API_KEY;

  if (!apiKey) {
    log.warn("perspective/client: PERSPECTIVE_API_KEY not set — returning zero scores (pass-through)", {
      traceId,
      eventId,
      domain: "moderation",
    });
    return { ...ZERO_SCORES };
  }

  const startMs = Date.now();

  try {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${PERSPECTIVE_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: { text },
          requestedAttributes: {
            TOXICITY: {},
            SEVERE_TOXICITY: {},
            INSULT: {},
            PROFANITY: {},
            THREAT: {},
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    const durationMs = Date.now() - startMs;

    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      log.error("perspective/client: non-2xx response", {
        traceId,
        eventId,
        domain: "moderation",
        costBand: "perspective:analyze",
      }, { status: response.status, body, durationMs });
      return { ...ZERO_SCORES };
    }

    const data = (await response.json()) as PerspectiveResponse;

    const result: PerspectiveResult = {
      toxicity:       data.attributeScores.TOXICITY?.summaryScore.value       ?? 0,
      severeToxicity: data.attributeScores.SEVERE_TOXICITY?.summaryScore.value ?? 0,
      insult:         data.attributeScores.INSULT?.summaryScore.value          ?? 0,
      profanity:      data.attributeScores.PROFANITY?.summaryScore.value       ?? 0,
      threat:         data.attributeScores.THREAT?.summaryScore.value          ?? 0,
    };

    log.info("perspective/client: analyze complete", {
      traceId,
      eventId,
      domain: "moderation",
      costBand: "perspective:analyze",
    }, { durationMs });

    return result;
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const isTimeout = err instanceof Error && err.name === "AbortError";
    log.error("perspective/client: request failed", {
      traceId,
      eventId,
      domain: "moderation",
      costBand: "perspective:analyze",
    }, { error: String(err), isTimeout, durationMs });
    return { ...ZERO_SCORES };
  }
}
