/**
 * moderation.ts — Content moderation stub for chat messages.
 *
 * Real implementation wired to Perspective API (or similar) in integrations milestone I9.
 * RC: moderation_enabled (default: false until I9 is complete)
 *
 * Milestone: B8
 */

// RC: moderation_enabled (default: false)
const MODERATION_ENABLED = false;

export interface ModerationResult {
  flagged: boolean;
  reason?: string;
}

/**
 * Moderate the given text content.
 * Stub: always returns { flagged: false } until I9 wires Perspective API.
 * TODO: wire to Perspective API or similar in integrations milestone I9.
 */
export async function moderateContent(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _text: string
): Promise<ModerationResult> {
  if (!MODERATION_ENABLED) {
    return { flagged: false };
  }
  // TODO(I9): call Perspective API here
  return { flagged: false };
}
