/**
 * adminGetReferralStats.ts — Admin callable: adminGetReferralStats
 *
 * Returns aggregate referral system stats and top 10 referrers.
 * Admin-only: enforces custom claim { admin: true }.
 *
 * Milestone: B13
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import {
  REFERRAL_CODES_COLLECTION,
  USERS_COLLECTION,
  ReferralCodeDoc,
  UserDoc,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

const TOP_REFERRERS_LIMIT = 10;

export const adminGetReferralStats = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 60,
    enforceAppCheck: true,
  },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    // Admin-only guard
    const isAdmin = request.auth.token?.admin === true;
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    log.info("adminGetReferralStats: start", {
      traceId, userId: request.auth.uid, domain: "referrals",
    });

    const db = getFirestore();

    // Fetch all active referral code docs
    const codesSnap = await db
      .collection(REFERRAL_CODES_COLLECTION)
      .where("isActive", "==", true)
      .get();

    let totalCodes = 0;
    let totalReferrals = 0;
    let successfulReferrals = 0;

    // Track per-owner stats for topReferrers
    const ownerStats: Record<string, { successfulReferrals: number }> = {};

    for (const doc of codesSnap.docs) {
      const data = doc.data() as ReferralCodeDoc;
      totalCodes++;
      totalReferrals += data.totalReferrals ?? 0;
      successfulReferrals += data.successfulReferrals ?? 0;

      const ownerUid = data.ownerUid;
      if (!ownerStats[ownerUid]) {
        ownerStats[ownerUid] = { successfulReferrals: 0 };
      }
      ownerStats[ownerUid].successfulReferrals += data.successfulReferrals ?? 0;
    }

    const conversionRate = totalReferrals > 0
      ? successfulReferrals / totalReferrals
      : 0;

    // RC: referrals.pointsReferrer (500) + referrals.pointsReferee (250) = 750 per successful referral
    const totalPointsAwarded = successfulReferrals * 750;

    // Build top referrers list — sorted descending, top 10
    const sortedOwners = Object.entries(ownerStats)
      .sort(([, a], [, b]) => b.successfulReferrals - a.successfulReferrals)
      .slice(0, TOP_REFERRERS_LIMIT);

    const topReferrers = await Promise.all(
      sortedOwners.map(async ([ownerUid, stats]) => {
        let displayName = ownerUid;
        try {
          const userSnap = await db.collection(USERS_COLLECTION).doc(ownerUid).get();
          if (userSnap.exists) {
            displayName = (userSnap.data() as UserDoc).displayName ?? ownerUid;
          }
        } catch {
          // fallback to uid
        }
        return {
          uid: ownerUid,
          displayName,
          successfulReferrals: stats.successfulReferrals,
          ptsEarned: stats.successfulReferrals * 500,  // RC: referrals.pointsReferrer
        };
      })
    );

    log.info("adminGetReferralStats: complete", {
      traceId, userId: request.auth.uid, domain: "referrals",
    }, { totalCodes, totalReferrals, successfulReferrals });

    return {
      totalCodes,
      totalReferrals,
      successfulReferrals,
      conversionRate,
      totalPointsAwarded,
      topReferrers,
    };
  }
);
