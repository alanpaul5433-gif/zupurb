/**
 * getChallenges.ts — Returns active, completed, and available challenges for the current user.
 *
 * Output:
 *   active:    ChallengeProgressDoc[]  — in-progress challenges
 *   completed: ChallengeProgressDoc[]  — completed in the last 30 days
 *   available: ChallengeDefinition[]   — challenges not yet started
 *
 * Milestone: B5
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { CHALLENGE_DEFINITIONS, ChallengeProgressDoc } from "../lib/challenges";
import { log, newTraceId } from "../lib/logging";

const CHALLENGE_PROGRESS_SUBCOLLECTION = "challengeProgress";

export const getChallenges = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }
    const uid = request.auth.uid;

    log.info("getChallenges: start", {
      traceId, userId: uid, domain: "challenges", eventId: `challenges_${uid}`,
    });

    const db = getFirestore();

    const progressSnap = await db
      .collection(`users/${uid}/${CHALLENGE_PROGRESS_SUBCOLLECTION}`)
      .get();

    const progressDocs = progressSnap.docs.map((d) => d.data() as ChallengeProgressDoc);

    const thirtyDaysAgo = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const active: ChallengeProgressDoc[] = [];
    const completed: ChallengeProgressDoc[] = [];
    const startedChallengeIds = new Set<string>();

    for (const prog of progressDocs) {
      startedChallengeIds.add(prog.challengeId);
      if (prog.completedAt !== null) {
        // Include completed challenges from the last 30 days
        if (prog.completedAt.toMillis() >= thirtyDaysAgo.toMillis()) {
          completed.push(prog);
        }
      } else {
        active.push(prog);
      }
    }

    // Available = defined challenges not yet started
    const available = Object.values(CHALLENGE_DEFINITIONS)
      .filter((def) => !startedChallengeIds.has(def.id))
      .map((def) => ({
        challengeId: def.id,
        title: def.title,
        description: def.description,
        bonusPoints: def.bonusPoints,
        target: def.target,
        windowDays: def.windowDays,
      }));

    log.info("getChallenges: complete", {
      traceId, userId: uid, domain: "challenges", eventId: `challenges_${uid}`,
    }, { activeCount: active.length, completedCount: completed.length, availableCount: available.length });

    return { active, completed, available };
  }
);
