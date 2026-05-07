/**
 * getAnniversaryBonus.ts — Awards a tier-based account anniversary bonus once per calendar year.
 *
 * Rules:
 *   - Caller must be authenticated.
 *   - User account must be at least 1 year old (createdAt).
 *   - Today's MM-DD must match the MM-DD of the user's createdAt (account anniversary).
 *   - Only one award per calendar year (anniversaryBonusClaimedYear guard).
 *   - Points awarded based on current tier:
 *       Bronze=50, Silver=100, Gold=200, Platinum=500 (RC-governed)
 *
 * RC keys (future):
 *   tier_anniversary_bonus_bronze   (50)
 *   tier_anniversary_bonus_silver   (100)
 *   tier_anniversary_bonus_gold     (200)
 *   tier_anniversary_bonus_platinum (500)
 *
 * Milestone: B14
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { Paths, UserDoc, LoyaltyTier } from "../lib/schema";
import { awardPoints } from "../lib/ledger";
import { sendNotification } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";
import { ANNIVERSARY_BONUS_POINTS } from "../types/loyalty";

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getAnniversaryBonus = onCall(
  { region: "us-central1" },
  async (request): Promise<{ pointsAwarded: number; currentTier: LoyaltyTier; yearsActive: number }> => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to claim anniversary bonus.");
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    log.info("getAnniversaryBonus: start", {
      traceId, userId: uid, domain: "tiers", eventId: "getAnniversaryBonus",
    });

    // 1. Fetch user doc
    const userSnap = await db.doc(Paths.user(uid)).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }
    const userData = userSnap.data() as UserDoc;

    // 2. Must have createdAt to derive anniversary
    if (!userData.createdAt) {
      throw new HttpsError("failed-precondition", "Account creation date is unavailable.");
    }

    const createdAt = userData.createdAt.toDate();
    const now = new Date();

    // 3. Account must be at least 1 year old
    const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
    const yearsActive = Math.floor((now.getTime() - createdAt.getTime()) / msPerYear);
    if (yearsActive < 1) {
      throw new HttpsError(
        "failed-precondition",
        "Your account must be at least 1 year old to claim an anniversary bonus."
      );
    }

    // 4. Check today's MM-DD matches account creation MM-DD (UTC)
    const createdMm = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
    const createdDd = String(createdAt.getUTCDate()).padStart(2, "0");
    const anniversaryMmDd = `${createdMm}-${createdDd}`;

    const todayMm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const todayDd = String(now.getUTCDate()).padStart(2, "0");
    const todayMmDd = `${todayMm}-${todayDd}`;

    if (anniversaryMmDd !== todayMmDd) {
      throw new HttpsError(
        "failed-precondition",
        "Today is not your account anniversary. This bonus is only available on your anniversary date."
      );
    }

    // 5. One award per calendar year (UTC)
    const currentYear = now.getUTCFullYear();
    if (userData.anniversaryBonusClaimedYear === currentYear) {
      throw new HttpsError(
        "already-exists",
        "Anniversary bonus has already been claimed this year."
      );
    }

    // 6. Determine bonus amount from tier
    const tier: LoyaltyTier = userData.loyaltyTier ?? "bronze";
    const pointsAwarded = ANNIVERSARY_BONUS_POINTS[tier];

    // 7. Award points
    await awardPoints(uid, {
      amount: pointsAwarded,
      type: "earn_anniversary_bonus",
      description: `${yearsActive}-year anniversary bonus — ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier`,
    });

    // 8. Mark claimed for this year
    await db.doc(Paths.user(uid)).update({
      anniversaryBonusClaimedYear: currentYear,
      updatedAt: Timestamp.now(),
    });

    // 9. Send notification
    await sendNotification(uid, {
      type: "anniversary_bonus",
      title: `${yearsActive} Year Zupurb Anniversary!`,
      body: `Congratulations on ${yearsActive} year${yearsActive === 1 ? "" : "s"} with Zupurb! You've earned ${pointsAwarded} bonus points as a ${tier.charAt(0).toUpperCase() + tier.slice(1)} member.`,
      data: { pointsAwarded: String(pointsAwarded), tier, yearsActive: String(yearsActive) },
      relatedEntityId: uid,
      relatedEntityType: "tier",
    });

    log.info("getAnniversaryBonus: awarded", {
      traceId, userId: uid, domain: "tiers", eventId: "getAnniversaryBonus",
    }, { tier, pointsAwarded, yearsActive, year: currentYear });

    return { pointsAwarded, currentTier: tier, yearsActive };
  }
);
