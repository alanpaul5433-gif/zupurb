/**
 * challengeCron.ts — Daily challenge evaluation scheduled Cloud Function.
 *
 * Schedule: daily at 04:00 UTC
 * Trigger: Cloud Scheduler → Pub/Sub
 *
 * Responsibilities:
 *   1. Deactivate challenges whose endAt has passed.
 *   2. For every active challenge with a badgeReward, find all
 *      userChallengeProgress documents where isComplete=true and
 *      pointsAwarded=true but the badge has NOT been awarded yet —
 *      award the badge.
 *   3. (Points are awarded at completion time by the challenge progression
 *      engine in lib/challenges.ts; this cron handles the badge reward
 *      half that could not run synchronously.)
 *
 * Idempotent: awardBadge guards against double-award; Firestore
 * transactions guard double point awards in lib/ledger.ts.
 *
 * RC key: challenges_cron_batch_size (default 200)
 *
 * Milestone: B7
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  CHALLENGES_COLLECTION,
  USER_CHALLENGE_PROGRESS_COLLECTION,
  ChallengeDefinitionDoc,
  UserChallengeProgressDoc,
} from "../lib/schema";
import { awardBadge } from "./progression";
import { log, newTraceId } from "../lib/logging";

// RC: challenges_cron_batch_size — default 200
const BATCH_SIZE = 200;

export const badges_challengesCron = onSchedule(
  {
    schedule: "0 4 * * *",   // 04:00 UTC daily
    timeZone: "UTC",
    region: "us-central1",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const traceId = newTraceId();
    const db = getFirestore();
    const now = Timestamp.now();

    log.info("badges_challengesCron: start", {
      traceId,
      domain: "badges",
      eventId: "challenges_cron",
    });

    // -------------------------------------------------------------------------
    // Step 1: Deactivate expired challenges
    // -------------------------------------------------------------------------

    const expiredSnap = await db
      .collection(CHALLENGES_COLLECTION)
      .where("isActive", "==", true)
      .where("endAt", "<=", now)
      .get();

    if (!expiredSnap.empty) {
      for (let i = 0; i < expiredSnap.docs.length; i += 400) {
        const batch = db.batch();
        const slice = expiredSnap.docs.slice(i, i + 400);
        for (const doc of slice) {
          batch.update(doc.ref, { isActive: false });
        }
        await batch.commit();
      }
      log.info("badges_challengesCron: deactivated expired challenges", {
        traceId,
        domain: "badges",
        eventId: "challenges_cron_deactivate",
      }, { count: expiredSnap.size });
    }

    // -------------------------------------------------------------------------
    // Step 2: Award badge rewards for completed challenges
    // -------------------------------------------------------------------------

    // Fetch all active challenges that have a badgeReward
    const activeChallengesSnap = await db
      .collection(CHALLENGES_COLLECTION)
      .where("isActive", "==", true)
      .get();

    const challengesWithBadge = activeChallengesSnap.docs
      .map((d) => d.data() as ChallengeDefinitionDoc)
      .filter((c) => c.badgeReward !== null && c.badgeReward !== undefined);

    let badgesAwarded = 0;

    for (const challenge of challengesWithBadge) {
      const badgeId = challenge.badgeReward!;

      // Find completed progress records for this challenge
      // that haven't had the badge awarded yet.
      // We use a simple flag `badgeAwarded` on the progress doc.
      let query = db
        .collection(USER_CHALLENGE_PROGRESS_COLLECTION)
        .where("challengeId", "==", challenge.challengeId)
        .where("isComplete", "==", true)
        .where("pointsAwarded", "==", true)
        .limit(BATCH_SIZE);

      const progressSnap = await query.get();

      for (const doc of progressSnap.docs) {
        const progress = doc.data() as UserChallengeProgressDoc & { badgeAwarded?: boolean };

        // Skip if badge already awarded (idempotency field)
        if (progress.badgeAwarded === true) continue;

        const uid = progress.userId;

        try {
          const result = await awardBadge(uid, badgeId, db, { traceId });
          if (result.awarded) {
            badgesAwarded++;
          }

          // Mark badge as awarded on the progress doc to prevent re-runs
          await doc.ref.update({ badgeAwarded: true });
        } catch (err) {
          // Log and continue — don't abort the entire cron for one user
          log.error("badges_challengesCron: failed to award badge", {
            traceId,
            userId: uid,
            domain: "badges",
            eventId: `cron_badge_err_${uid}`,
          }, { badgeId, error: String(err) });
        }
      }
    }

    log.info("badges_challengesCron: complete", {
      traceId,
      domain: "badges",
      eventId: "challenges_cron_done",
    }, {
      expiredDeactivated: expiredSnap.size,
      badgesAwarded,
    });
  }
);
