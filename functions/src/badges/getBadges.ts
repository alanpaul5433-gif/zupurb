/**
 * getBadges.ts — Callable: returns user's earned badges + available badge catalogue.
 *
 * Response shape:
 *   earned:    UserBadgeDoc[]          — badges this user has earned (with earnedAt)
 *   available: BadgeDefinitionDoc[]    — badges the user has NOT yet earned
 *   founderCapInfo: { count, cap }     — always returned for display purposes
 *
 * Auth required. App Check enforced at deployment.
 *
 * Milestone: B7
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import {
  BADGES_COLLECTION,
  BadgeDefinitionDoc,
} from "../lib/schema";
import { getUserBadges } from "./progression";
import { checkFounderCap } from "./founderCap";
import { log, newTraceId } from "../lib/logging";

export const getBadges = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const uid = request.auth.uid;

    log.info("getBadges: start", {
      traceId,
      userId: uid,
      domain: "badges",
      eventId: `get_badges_${uid}`,
    });

    const db = getFirestore();

    // Fetch earned badges for this user
    const earned = await getUserBadges(uid, db);
    const earnedIds = new Set(earned.map((b) => b.badgeId));

    // Fetch all active badge definitions
    const allBadgesSnap = await db
      .collection(BADGES_COLLECTION)
      .where("isActive", "==", true)
      .orderBy("sortOrder", "asc")
      .get();

    const allBadges = allBadgesSnap.docs.map((d) => d.data() as BadgeDefinitionDoc);

    // Filter to badges the user has NOT yet earned
    const available = allBadges.filter((b) => !earnedIds.has(b.badgeId));

    // Founder cap info (always returned so UI can show "X/150 claimed")
    const founderCapInfo = await checkFounderCap(db);

    log.info("getBadges: complete", {
      traceId,
      userId: uid,
      domain: "badges",
      eventId: `get_badges_${uid}`,
    }, {
      earnedCount: earned.length,
      availableCount: available.length,
    });

    return {
      earned,
      available,
      founderCapInfo: {
        count: founderCapInfo.count,
        cap: founderCapInfo.cap,
        atCap: founderCapInfo.atCap,
      },
    };
  }
);
