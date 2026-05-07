/**
 * getBirthdayBonus.ts — Awards a tier-based birthday bonus once per calendar year.
 *
 * Rules:
 *   - Caller must be authenticated.
 *   - User's dateOfBirth (MM-DD) must be set on their profile.
 *   - Today's MM-DD must match the user's dateOfBirth (server-side clock only).
 *   - Only one award per calendar year (birthdayBonusClaimedYear guard).
 *   - Points awarded based on current tier:
 *       Bronze=50, Silver=100, Gold=200, Platinum=500 (RC-governed)
 *
 * RC keys (future):
 *   tier_birthday_bonus_bronze   (50)
 *   tier_birthday_bonus_silver   (100)
 *   tier_birthday_bonus_gold     (200)
 *   tier_birthday_bonus_platinum (500)
 *
 * Milestone: B14
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { Paths, UserDoc, LoyaltyTier } from "../lib/schema";
import { awardPoints } from "../lib/ledger";
import { sendNotification } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";
import { BIRTHDAY_BONUS_POINTS } from "../types/loyalty";

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getBirthdayBonus = onCall(
  { region: "us-central1" },
  async (request): Promise<{ pointsAwarded: number; currentTier: LoyaltyTier }> => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in to claim birthday bonus.");
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    log.info("getBirthdayBonus: start", {
      traceId, userId: uid, domain: "tiers", eventId: "getBirthdayBonus",
    });

    // 1. Fetch user doc
    const userSnap = await db.doc(Paths.user(uid)).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }
    const userData = userSnap.data() as UserDoc;

    // 2. Must have dateOfBirth set
    if (!userData.dateOfBirth) {
      throw new HttpsError(
        "failed-precondition",
        "Please set your date of birth in your profile to claim a birthday bonus."
      );
    }

    // 3. Check today's MM-DD matches (server clock, UTC)
    const now = new Date();
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(now.getUTCDate()).padStart(2, "0");
    const todayMmDd = `${mm}-${dd}`;

    if (userData.dateOfBirth !== todayMmDd) {
      throw new HttpsError(
        "failed-precondition",
        "Today is not your birthday. Birthday bonus is only available on your birthday."
      );
    }

    // 4. One award per calendar year (UTC)
    const currentYear = now.getUTCFullYear();
    if (userData.birthdayBonusClaimedYear === currentYear) {
      throw new HttpsError(
        "already-exists",
        "Birthday bonus has already been claimed this year."
      );
    }

    // 5. Determine bonus amount from tier
    const tier: LoyaltyTier = userData.loyaltyTier ?? "bronze";
    const pointsAwarded = BIRTHDAY_BONUS_POINTS[tier];

    // 6. Award points
    await awardPoints(uid, {
      amount: pointsAwarded,
      type: "earn_birthday_bonus",
      description: `Birthday bonus — ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier`,
    });

    // 7. Mark claimed for this year
    await db.doc(Paths.user(uid)).update({
      birthdayBonusClaimedYear: currentYear,
      updatedAt: Timestamp.now(),
    });

    // 8. Send notification
    await sendNotification(uid, {
      type: "birthday_bonus",
      title: "Happy Birthday!",
      body: `You've earned ${pointsAwarded} birthday bonus points as a ${tier.charAt(0).toUpperCase() + tier.slice(1)} member!`,
      data: { pointsAwarded: String(pointsAwarded), tier },
      relatedEntityId: uid,
      relatedEntityType: "tier",
    });

    log.info("getBirthdayBonus: awarded", {
      traceId, userId: uid, domain: "tiers", eventId: "getBirthdayBonus",
    }, { tier, pointsAwarded, year: currentYear });

    return { pointsAwarded, currentTier: tier };
  }
);
