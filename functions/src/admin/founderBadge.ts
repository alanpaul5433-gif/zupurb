/**
 * founderBadge.ts — Founder badge admin endpoints.
 *
 * Callables:
 *   adminAwardFounderBadge  — manually award Founder badge (bypasses progression).
 *                             Enforces 150-cap (ADR-007). Admin only.
 *   getFounderBadgeStatus   — returns count of awarded Founder badges vs cap. Admin only.
 *
 * Uses checkFounderCap from badges/founderCap.ts and unlockBadge from lib/badges.ts.
 * Awards founder bonus points via lib/ledger.ts awardPoints.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  Paths,
  UserBadgeDoc,
  USER_BADGES_SUBCOLLECTION,
} from "../lib/schema";
import { BADGE_DEFINITIONS } from "../lib/badges";
import { requireAdmin } from "../lib/adminGuard";
import { awardPoints } from "../lib/ledger";
import { checkFounderCap } from "../badges/founderCap";
import { sendNotification } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// adminAwardFounderBadge
// ---------------------------------------------------------------------------

const AwardFounderBadgeSchema = z.object({
  targetUid: z.string().min(1),
});

export const adminAwardFounderBadge = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = AwardFounderBadgeSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { targetUid } = parsed.data;

    log.info("adminAwardFounderBadge: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `founder_award_${targetUid}`,
    });

    const db = getFirestore();

    // 1. Check cap
    const capResult = await checkFounderCap(db);
    if (capResult.atCap) {
      throw new HttpsError(
        "resource-exhausted",
        `Founder badge cap reached (${capResult.count}/${capResult.cap}). Cannot award.`
      );
    }

    // 2. Check if user already has the Founder badge
    const badgeRef = db.doc(Paths.userBadge(targetUid, "founder"));
    const existing = await badgeRef.get();
    if (existing.exists) {
      throw new HttpsError("already-exists", `User ${targetUid} already has the Founder badge.`);
    }

    // 3. Check target user exists
    const userSnap = await db.doc(Paths.user(targetUid)).get();
    if (!userSnap.exists) {
      throw new HttpsError("not-found", `User ${targetUid} not found.`);
    }

    // 4. Write badge document
    const now = Timestamp.now();
    const badgeDoc: UserBadgeDoc = {
      badgeId:   "founder",
      userId:    targetUid,
      earnedAt:  now,
      awardedBy: adminUid,
    };
    await badgeRef.set(badgeDoc);

    // 5. Award bonus points (RC: badge_founder_bonus = 500)
    const bonusPoints = BADGE_DEFINITIONS.founder.bonusPoints;
    if (bonusPoints > 0) {
      await awardPoints(targetUid, {
        amount:            bonusPoints,
        type:              "earn_badge_unlock",
        description:       "Founder badge — awarded by admin",
        relatedEntityType: "badge",
        relatedEntityId:   "founder",
      });
    }

    // 6. Notify user
    await sendNotification(targetUid, {
      type:  "badge_unlocked",
      title: "You earned the Founder Badge!",
      body:  "You have been awarded the exclusive Zupurb Founder badge. Thank you for being one of our first members.",
      data:  { badgeId: "founder" },
    });

    log.info("adminAwardFounderBadge: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: targetUid,
    }, {
      capAfter: capResult.count + 1,
      capMax:   capResult.cap,
      bonusPoints,
    });

    return {
      targetUid,
      badgeId:     "founder",
      awardedBy:   adminUid,
      earnedAt:    now,
      bonusPoints,
      capCount:    capResult.count + 1,
      capMax:      capResult.cap,
    };
  }
);

// ---------------------------------------------------------------------------
// getFounderBadgeStatus
// ---------------------------------------------------------------------------

export const getFounderBadgeStatus = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    log.info("getFounderBadgeStatus: start", {
      traceId, userId: adminUid, domain: "admin", eventId: "founder_badge_status",
    });

    const db = getFirestore();
    const capResult = await checkFounderCap(db);

    // Also fetch the list of recipients (paginated — first 150 max)
    const recipientsSnap = await db
      .collectionGroup(USER_BADGES_SUBCOLLECTION)
      .where("badgeId", "==", "founder")
      .orderBy("earnedAt", "asc")
      .get();

    const recipients = recipientsSnap.docs.map((d) => {
      const doc = d.data() as UserBadgeDoc;
      return {
        userId:    doc.userId,
        earnedAt:  doc.earnedAt,
        awardedBy: doc.awardedBy,
      };
    });

    log.info("getFounderBadgeStatus: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: "founder_badge_status",
    }, { count: capResult.count, cap: capResult.cap });

    return {
      count:      capResult.count,
      cap:        capResult.cap,
      remaining:  capResult.cap - capResult.count,
      atCap:      capResult.atCap,
      recipients,
    };
  }
);
