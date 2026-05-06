/**
 * applyReferralCode.ts — Callable: applyReferralCode
 *
 * Allows a user to apply a referral code AFTER onboarding (7-day grace period).
 * Same anti-fraud rules as applyReferral utility.
 *
 * Milestone: B13
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { applyReferral } from "../lib/referral";
import { UserDoc, Paths } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFERRAL_APPLY_GRACE_DAYS = 7;  // RC: referral_apply_grace_days

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ApplyReferralCodeSchema = z.object({
  referralCode: z.string().trim().min(1).max(20),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const applyReferralCode = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 30,
    enforceAppCheck: true,
  },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }
    const uid = request.auth.uid;

    // Validate input
    const parsed = ApplyReferralCodeSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.errors.map((e) => e.message).join("; ")}`
      );
    }
    const { referralCode } = parsed.data;

    log.info("applyReferralCode: start", { traceId, userId: uid, domain: "referrals" });

    const db = getFirestore();

    // Check account age — only within 7-day grace period
    const userSnap = await db.doc(Paths.user(uid)).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userSnap.data() as UserDoc;
    const createdAtMs = userData.createdAt?.toMillis() ?? Date.now();
    const accountAgeDays = (Date.now() - createdAtMs) / (1000 * 60 * 60 * 24);

    if (accountAgeDays > REFERRAL_APPLY_GRACE_DAYS) {
      throw new HttpsError(
        "deadline-exceeded",
        `Referral codes can only be applied within ${REFERRAL_APPLY_GRACE_DAYS} days of account creation.`
      );
    }

    // Apply the referral via shared utility
    const result = await applyReferral(uid, referralCode);

    if (!result.success) {
      throw new HttpsError("failed-precondition", result.error ?? "Failed to apply referral code.");
    }

    log.info("applyReferralCode: complete", {
      traceId, userId: uid, domain: "referrals",
    }, { referralCode, referrerUid: result.referrerUid });

    return { success: true, referrerUid: result.referrerUid };
  }
);
