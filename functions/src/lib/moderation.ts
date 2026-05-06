/**
 * moderation.ts — Content moderation via Perspective API.
 *
 * Provides moderateContent() which scores text for toxicity, threats, profanity,
 * insults, and severe toxicity. All thresholds are Remote Config governed.
 *
 * Error contract: this function NEVER throws. On any Perspective failure it returns
 * { flagged: false, scores: allZero } so the review flow is unaffected.
 *
 * Milestone: I9 (replaces B8 stub)
 */

import { analyzeText, PerspectiveResult, ZERO_SCORES } from "../integrations/perspective/client";
import { log } from "./logging";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModerationResult {
  flagged: boolean;
  scores: PerspectiveResult;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Thresholds (Remote Config governed)
// ---------------------------------------------------------------------------

const TOXICITY_THRESHOLD        = 0.80; // RC: moderation_toxicity_threshold
const SEVERE_TOXICITY_THRESHOLD = 0.60; // RC: moderation_severe_toxicity_threshold
const THREAT_THRESHOLD          = 0.60; // RC: moderation_threat_threshold
const PROFANITY_THRESHOLD       = 0.85; // RC: moderation_profanity_threshold
const INSULT_THRESHOLD          = 0.80; // RC: moderation_insult_threshold

// ---------------------------------------------------------------------------
// moderateContent
// ---------------------------------------------------------------------------

/**
 * Moderate the given text using the Perspective API.
 *
 * @param text     The review body or comment to evaluate.
 * @param traceId  Parent trace ID for log correlation.
 * @returns        ModerationResult — never rejects.
 */
export async function moderateContent(
  text: string,
  traceId: string
): Promise<ModerationResult> {
  // Empty or whitespace-only text passes immediately — nothing to moderate.
  if (!text || text.trim().length === 0) {
    return { flagged: false, scores: { ...ZERO_SCORES } };
  }

  let scores: PerspectiveResult;
  try {
    scores = await analyzeText(text, traceId, traceId);
  } catch (err) {
    // analyzeText is already safe, but belt-and-suspenders
    log.error("moderation: unexpected error from analyzeText", {
      traceId,
      domain: "moderation",
      eventId: traceId,
    }, { error: String(err) });
    return { flagged: false, scores: { ...ZERO_SCORES } };
  }

  // Evaluate each attribute against its threshold; track highest-scoring violator.
  type Check = { attribute: keyof PerspectiveResult; score: number; threshold: number };
  const checks: Check[] = [
    { attribute: "toxicity",       score: scores.toxicity,       threshold: TOXICITY_THRESHOLD },
    { attribute: "severeToxicity", score: scores.severeToxicity, threshold: SEVERE_TOXICITY_THRESHOLD },
    { attribute: "threat",         score: scores.threat,         threshold: THREAT_THRESHOLD },
    { attribute: "profanity",      score: scores.profanity,      threshold: PROFANITY_THRESHOLD },
    { attribute: "insult",         score: scores.insult,         threshold: INSULT_THRESHOLD },
  ];

  let reason: string | undefined;
  let highestExcess = 0;

  for (const { attribute, score, threshold } of checks) {
    if (score >= threshold) {
      const excess = score - threshold;
      if (excess > highestExcess) {
        highestExcess = excess;
        reason = attribute;
      }
    }
  }

  const flagged = reason !== undefined;

  if (flagged) {
    log.warn("moderation: content flagged", {
      traceId,
      domain: "moderation",
      eventId: traceId,
    }, { reason, scores: scores as unknown as Record<string, unknown> });
  }

  return { flagged, scores, reason };
}
