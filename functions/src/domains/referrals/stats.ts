/**
 * domains/referrals/stats.ts — User-facing referral dashboard callable.
 *
 * getReferralStats — returns:
 *   referralCode, totalReferrals, pendingReferrals, completedReferrals,
 *   pointsEarned, recentReferrals[]
 *
 * Milestone: B13
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  REFERRAL_CODES_COLLECTION,
  USERS_COLLECTION,
  ReferralCodeDoc,
  RefereeEntry,
  UserDoc,
  Paths,
} from "../../lib/schema";
import { log, newTraceId } from "../../lib/logging";

const REFERRAL_BASE_URL = "https://zupurb.com/join"; // RC: referral_base_url
const POINTS_REFERRER   = 500;                        // RC: referrals.pointsReferrer
const RECENT_LIMIT      = 20;

export const getReferralStats = onCall(
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

    log.info("getReferralStats: start", { traceId, userId: uid, domain: "referrals" });

    const db = getFirestore();

    // 1. Fetch user doc
    const userSnap = await db.doc(Paths.user(uid)).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userSnap.data() as UserDoc;
    const referralCode: string | null = userData.myReferralCode ?? null;

    if (!referralCode) {
      // No code yet — return empty stats
      return {
        referralCode: null,
        shareUrl: null,
        totalReferrals: 0,
        pendingReferrals: 0,
        completedReferrals: 0,
        pointsEarned: 0,
        recentReferrals: [],
      };
    }

    // 2. Fetch referral code doc
    const codeSnap = await db.collection(REFERRAL_CODES_COLLECTION).doc(referralCode).get();
    if (!codeSnap.exists) {
      throw new HttpsError("internal", "Referral code document not found.");
    }

    const codeDoc = codeSnap.data() as ReferralCodeDoc;
    const referees: RefereeEntry[] = codeDoc.referees ?? [];

    const pendingReferrals   = referees.filter((r) => r.rewardStatus === "pending").length;
    const completedReferrals = referees.filter((r) => r.rewardStatus === "awarded").length;
    const totalReferrals     = referees.length;
    const pointsEarned       = completedReferrals * POINTS_REFERRER;

    // 3. Build recent referrals (most recent first, capped at RECENT_LIMIT)
    const sortedReferees = [...referees]
      .sort((a, b) => b.appliedAt.toMillis() - a.appliedAt.toMillis())
      .slice(0, RECENT_LIMIT);

    const recentReferrals = await Promise.all(
      sortedReferees.map(async (entry) => {
        let displayName = "Zupurb Member";
        try {
          const refereeSnap = await db.collection(USERS_COLLECTION).doc(entry.uid).get();
          if (refereeSnap.exists) {
            const refereeData = refereeSnap.data() as UserDoc;
            displayName = refereeData.displayName ?? displayName;
          }
        } catch {
          // Non-critical — fallback name used
        }
        return {
          displayName,
          appliedAt: entry.appliedAt as Timestamp,
          rewardStatus: entry.rewardStatus,
        };
      })
    );

    log.info("getReferralStats: complete", { traceId, userId: uid, domain: "referrals" });

    return {
      referralCode,
      shareUrl: `${REFERRAL_BASE_URL}?ref=${referralCode}`,
      totalReferrals,
      pendingReferrals,
      completedReferrals,
      pointsEarned,
      recentReferrals,
    };
  }
);
