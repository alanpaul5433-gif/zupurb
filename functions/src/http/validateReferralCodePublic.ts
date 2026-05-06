/**
 * validateReferralCodePublic.ts — Callable: validateReferralCodePublic
 *
 * Unauthenticated callable — called on sign-up screen when user enters a
 * referral code to show "Referred by Alan P." confirmation.
 *
 * Returns only the referrer's first name for privacy.
 *
 * RC: validate_code_rate_limit — 5 calls per IP per minute (stub; real
 * rate limiting is enforced by App Check + Cloud Armor in production).
 *
 * Milestone: B13
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { validateReferralCode } from "../lib/referral";
import { UserDoc, Paths } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ValidateReferralCodePublicSchema = z.object({
  code: z.string().trim().min(1).max(20),
});

// ---------------------------------------------------------------------------
// Callable (no enforceAppCheck — pre-auth context)
// ---------------------------------------------------------------------------

export const validateReferralCodePublic = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 15,
    // RC: validate_code_rate_limit — 5 calls per IP per minute
    // Real enforcement: Cloud Armor WAF rule in production
    enforceAppCheck: false,
  },
  async (request) => {
    const traceId = newTraceId();

    // Validate input shape
    const parsed = ValidateReferralCodePublicSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.errors.map((e) => e.message).join("; ")}`
      );
    }
    const { code } = parsed.data;

    log.info("validateReferralCodePublic: start", {
      traceId, domain: "referrals", eventId: `validate_${code}`,
    });

    const validation = await validateReferralCode(code);

    if (!validation || !validation.valid) {
      return { valid: false };
    }

    // Fetch referrer's first name only (privacy)
    let referrerName: string | undefined;
    try {
      const db = getFirestore();
      const referrerSnap = await db.doc(Paths.user(validation.referrerUid)).get();
      if (referrerSnap.exists) {
        const referrerData = referrerSnap.data() as UserDoc;
        const displayName = referrerData.displayName ?? "";
        // Return first name + last initial only (e.g., "Alan P.")
        const parts = displayName.trim().split(/\s+/);
        if (parts.length >= 2) {
          referrerName = `${parts[0]} ${parts[parts.length - 1][0]}.`;
        } else {
          referrerName = parts[0] ?? undefined;
        }
      }
    } catch (err) {
      log.warn("validateReferralCodePublic: could not fetch referrer name", {
        traceId, domain: "referrals", eventId: `validate_${code}`,
      }, { error: String(err) });
      // Non-fatal — return valid: true without name
    }

    return { valid: true, referrerName };
  }
);
