/**
 * integrations/ai/perspective.ts — I5 toxicity detection wrapper.
 *
 * Thin adapter over integrations/perspective/client.ts that exposes the
 * I5-specified `scoreTextToxicity` interface.
 *
 * Attributes evaluated: TOXICITY, SEVERE_TOXICITY, INSULT
 * Threshold: TOXICITY > 0.7 → toxic = true  (RC: toxicity_threshold)
 *
 * Reads PERSPECTIVE_API_KEY from the environment (handled by the underlying
 * client — missing key degrades gracefully to all-zero scores).
 *
 * Milestone: I5
 */

import { analyzeText } from "../perspective/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToxicityResult {
  /** true when TOXICITY score exceeds TOXICITY_THRESHOLD */
  toxic: boolean;
  /** TOXICITY score in [0, 1] */
  score: number;
  /** Per-attribute scores keyed by attribute name */
  attributes: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RC: toxicity_threshold — flag when TOXICITY score exceeds this value. */
const TOXICITY_THRESHOLD = 0.7;

// ---------------------------------------------------------------------------
// scoreTextToxicity
// ---------------------------------------------------------------------------

/**
 * Scores the toxicity of a piece of text using the Perspective API.
 *
 * @param text     Review body text to evaluate.
 * @param traceId  Correlation ID from the calling function.
 * @param eventId  Entity ID for log attribution (e.g., reviewId).
 * @returns        ToxicityResult — never throws; degrades to all-zero on error.
 */
export async function scoreTextToxicity(
  text: string,
  traceId: string,
  eventId: string
): Promise<ToxicityResult> {
  const result = await analyzeText(text, eventId, traceId);

  return {
    toxic: result.toxicity > TOXICITY_THRESHOLD,
    score: result.toxicity,
    attributes: {
      TOXICITY:       result.toxicity,
      SEVERE_TOXICITY: result.severeToxicity,
      INSULT:         result.insult,
    },
  };
}
