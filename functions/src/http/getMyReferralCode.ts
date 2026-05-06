/**
 * getMyReferralCode.ts — Callable: getMyReferralCode
 *
 * Returns the calling user's referral code + stats + referee list.
 * If the user has no code yet (edge case: onboarding incomplete), generates one on-demand.
 *
 * Milestone: B13
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  REFERRAL_CODES_COLLECTION,
  USERS_COLLECTION,
  UserDoc,
  ReferralCodeDoc,
  RefereeEntry,
  Paths,
} from "../lib/schema";
import { generateReferralCode } from "../lib/referral";
import { log, newTraceId } from "../lib/logging";

const REFERRAL_BASE_URL = "https://zupurb.com/join";  // RC: referral_base_url

export const getMyReferralCode = onCall(
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

    log.info("getMyReferralCode: start", { traceId, userId: uid, domain: "referrals" });

    const db = getFirestore();

    // 1. Fetch user doc to get myReferralCode
    const userSnap = await db.doc(Paths.user(uid)).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User profile not found.");
    }

    const userData = userSnap.data() as UserDoc;
    let code: string | null = userData.myReferralCode ?? null;

    // 2. Edge case: no code yet — generate on-demand
    if (!code) {
      log.warn("getMyReferralCode: no code found, generating on-demand", {
        traceId, userId: uid, domain: "referrals",
      });

      code = await generateReferralCode(uid);
      const now = Timestamp.now();

      const referralDoc: ReferralCodeDoc = {
        code,
        ownerUid: uid,
        createdAt: now,
        isActive: true,
        totalReferrals: 0,
        successfulReferrals: 0,
        referees: [],
        successfulReferralsLast30Days: 0,
        rollingWindowStart: now,
      };

      await db.collection(REFERRAL_CODES_COLLECTION).doc(code).set(referralDoc);
      await db.doc(Paths.user(uid)).update({
        myReferralCode: code,
        updatedAt: now,
      } as Record<string, unknown>);
    }

    // 3. Fetch referral code doc for stats
    const codeSnap = await db.collection(REFERRAL_CODES_COLLECTION).doc(code).get();
    if (!codeSnap.exists) {
      throw new HttpsError("internal", "Referral code document not found.");
    }

    const codeDoc = codeSnap.data() as ReferralCodeDoc;
    const referees: RefereeEntry[] = codeDoc.referees ?? [];

    const pendingReferrals = referees.filter((r) => r.rewardStatus === "pending").length;

    // Estimate total earned: successfulReferrals × 500 pts (referrer reward)
    // RC: referrals.pointsReferrer (500)
    const totalEarned = (codeDoc.successfulReferrals ?? 0) * 500;

    // 4. Enrich referee entries with display names
    const enrichedReferees: Array<{
      displayName: string;
      appliedAt: Timestamp;
      rewardStatus: "pending" | "awarded" | "expired";
    }> = await Promise.all(
      referees.map(async (entry) => {
        let displayName = "Zupurb Member";
        try {
          const refereeSnap = await db
            .collection(USERS_COLLECTION)
            .doc(entry.uid)
            .get();
          if (refereeSnap.exists) {
            const refereeData = refereeSnap.data() as { displayName?: string };
            displayName = refereeData.displayName ?? displayName;
          }
        } catch {
          // Non-critical — default name used
        }
        return {
          displayName,
          appliedAt: entry.appliedAt,
          rewardStatus: entry.rewardStatus,
        };
      })
    );

    log.info("getMyReferralCode: complete", { traceId, userId: uid, domain: "referrals" });

    return {
      code,
      shareUrl: `${REFERRAL_BASE_URL}?ref=${code}`,
      stats: {
        totalReferrals: codeDoc.totalReferrals ?? 0,
        successfulReferrals: codeDoc.successfulReferrals ?? 0,
        pendingReferrals,
        totalEarned,
      },
      referees: enrichedReferees,
    };
  }
);
