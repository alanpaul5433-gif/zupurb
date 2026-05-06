/**
 * expireStaleReferrals.ts — Scheduled: expireStaleReferrals
 *
 * Weekly Sunday 2 AM UTC.
 * Marks referee entries as 'expired' if they have been pending for more than
 * 90 days without posting a verified review.
 *
 * These users applied a code but never triggered the reward. Silent expiry —
 * no notification, no points awarded.
 *
 * RC: referral_reward_expiry_days (default 90)
 *
 * Milestone: B13
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { REFERRAL_CODES_COLLECTION, ReferralCodeDoc, RefereeEntry } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

const REFERRAL_REWARD_EXPIRY_DAYS = 90;  // RC: referral_reward_expiry_days

export const expireStaleReferrals = onSchedule(
  {
    schedule: "0 2 * * 0",   // Every Sunday at 2 AM UTC
    timeZone: "UTC",
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 540,
  },
  async () => {
    const traceId = newTraceId();
    const db = getFirestore();
    const now = Timestamp.now();

    // Cutoff: referees who applied > 90 days ago and are still pending
    const cutoffMs = now.toMillis() - REFERRAL_REWARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const cutoffTimestamp = Timestamp.fromMillis(cutoffMs);

    log.info("expireStaleReferrals: start", {
      traceId, domain: "referrals", eventId: "expire_stale",
    }, { cutoffDate: new Date(cutoffMs).toISOString() });

    // Fetch all active referral code docs that have at least one referee
    // Note: we load all active docs and filter in memory — acceptable for referral volume
    const codesSnap = await db
      .collection(REFERRAL_CODES_COLLECTION)
      .where("isActive", "==", true)
      .get();

    let totalExpired = 0;
    let totalDocsUpdated = 0;

    for (const codeDoc of codesSnap.docs) {
      const data = codeDoc.data() as ReferralCodeDoc;
      const referees: RefereeEntry[] = data.referees ?? [];

      // Check if any referee needs expiry
      const hasStale = referees.some(
        (r) =>
          r.rewardStatus === "pending" &&
          r.appliedAt.toMillis() < cutoffTimestamp.toMillis()
      );

      if (!hasStale) continue;

      // Update: expire stale pending entries
      const updatedReferees = referees.map((entry) => {
        if (
          entry.rewardStatus === "pending" &&
          entry.appliedAt.toMillis() < cutoffTimestamp.toMillis()
        ) {
          totalExpired++;
          return { ...entry, rewardStatus: "expired" as const };
        }
        return entry;
      });

      await codeDoc.ref.update({ referees: updatedReferees });
      totalDocsUpdated++;
    }

    log.info("expireStaleReferrals: complete", {
      traceId, domain: "referrals", eventId: "expire_stale",
    }, { totalDocsUpdated, totalExpired });
  }
);
