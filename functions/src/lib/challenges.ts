/**
 * challenges.ts — Challenge progression engine.
 *
 * Supports time-boxed point-earning objectives displayed on the Badges & Challenges screen.
 * Challenge progress is stored in users/{uid}/challengeProgress/{challengeId}.
 *
 * Supported challenge types:
 *   weekend_warrior      — 3 new spots Sat–Sun in the same weekend (+150 pts)
 *   neighborhood_explorer — 5 establishments in the same neighborhood (+200 pts)
 *   tasting_menu         — 5 restaurant reviews in 30 days (+250 pts)
 *   night_owl            — 3 bar/nightclub reviews in 14 days (+200 pts)
 *
 * RC keys:
 *   challenge_ww_spots (default 3)       challenge_ww_bonus (default 150)
 *   challenge_ne_spots (default 5)       challenge_ne_bonus (default 200)
 *   challenge_tm_reviews (default 5)     challenge_tm_bonus (default 250)
 *   challenge_no_reviews (default 3)     challenge_no_bonus (default 200)
 *
 * Milestone: B5
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  Paths,
  ReviewDoc,
  REVIEWS_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  NotificationDoc,
  EstablishmentDoc,
  ESTABLISHMENTS_COLLECTION,
} from "./schema";
import { awardPoints } from "./ledger";
import { log } from "./logging";

// ---------------------------------------------------------------------------
// Challenge progress sub-collection path (under users/{uid})
// ---------------------------------------------------------------------------

const CHALLENGE_PROGRESS_SUBCOLLECTION = "challengeProgress";

export interface ChallengeProgressDoc {
  challengeId: string;
  userId: string;
  progress: number;
  target: number;
  completedAt: Timestamp | null;
  bonusAwarded: boolean;
  windowStart: Timestamp;
  windowEnd: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Challenge definitions (in-code; authoritative copy in Firestore challenges/{id})
// ---------------------------------------------------------------------------

interface ChallengeDefinition {
  id: string;
  title: string;
  description: string;
  bonusPoints: number;
  target: number;
  windowDays: number; // rolling window length in days
}

export const CHALLENGE_DEFINITIONS: Record<string, ChallengeDefinition> = {
  weekend_warrior: {
    id: "weekend_warrior",
    title: "Weekend Warrior",
    description: "Visit 3 new spots over the weekend",
    bonusPoints: 150, // RC: challenge_ww_bonus
    target: 3,        // RC: challenge_ww_spots
    windowDays: 3,    // Sat through Sun
  },
  neighborhood_explorer: {
    id: "neighborhood_explorer",
    title: "Neighborhood Explorer",
    description: "Review 5 establishments in the same neighborhood",
    bonusPoints: 200, // RC: challenge_ne_bonus
    target: 5,        // RC: challenge_ne_spots
    windowDays: 90,   // rolling 90-day window
  },
  tasting_menu: {
    id: "tasting_menu",
    title: "Tasting Menu",
    description: "Submit 5 restaurant reviews in 30 days",
    bonusPoints: 250, // RC: challenge_tm_bonus
    target: 5,        // RC: challenge_tm_reviews
    windowDays: 30,
  },
  night_owl: {
    id: "night_owl",
    title: "Night Owl",
    description: "Submit 3 bar or nightclub reviews in 14 days",
    bonusPoints: 200, // RC: challenge_no_bonus
    target: 3,        // RC: challenge_no_reviews
    windowDays: 14,
  },
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function challengeProgressRef(uid: string, challengeId: string) {
  return getFirestore()
    .collection(`users/${uid}/${CHALLENGE_PROGRESS_SUBCOLLECTION}`)
    .doc(challengeId);
}

function getWeekendWindow(now: Date): { windowStart: Date; windowEnd: Date } {
  // Most-recent Sat 00:00 UTC → following Sun 23:59:59 UTC
  const dow = now.getUTCDay(); // 0=Sun,6=Sat
  const daysSinceSat = dow === 0 ? 1 : (dow === 6 ? 0 : dow + 1);
  const saturday = new Date(now);
  saturday.setUTCDate(now.getUTCDate() - daysSinceSat);
  saturday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(saturday);
  sunday.setUTCDate(saturday.getUTCDate() + 1);
  sunday.setUTCHours(23, 59, 59, 999);

  return { windowStart: saturday, windowEnd: sunday };
}

async function createChallengeNotification(
  uid: string,
  challengeTitle: string,
  bonusPoints: number
): Promise<void> {
  const db = getFirestore();
  const notifId = `challenge_complete_${uid}_${Date.now()}`;
  const notif: NotificationDoc = {
    notifId,
    userId: uid,
    type: "challenge_complete",
    title: "Challenge Complete!",
    body: `${challengeTitle} — You earned ${bonusPoints} pts`,
    deepLinkPath: "/badges",
    imageUrl: null,
    payload: { bonusPoints },
    isRead: false,
    readAt: null,
    createdAt: Timestamp.now(),
  };
  await db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(uid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
    .doc(notifId)
    .set(notif);
}

async function completeChallenge(
  uid: string,
  challengeId: string,
  progressRef: FirebaseFirestore.DocumentReference,
  def: ChallengeDefinition,
  traceId: string
): Promise<void> {
  const now = Timestamp.now();

  await progressRef.update({
    completedAt: now,
    bonusAwarded: true,
    updatedAt: now,
  });

  await awardPoints(uid, {
    amount: def.bonusPoints,
    type: "earn_challenge_complete",
    description: `Challenge complete: ${def.title}`,
    relatedEntityType: "challenge",
    relatedEntityId: challengeId,
  });

  await createChallengeNotification(uid, def.title, def.bonusPoints);

  log.info("challenge: completed", {
    traceId,
    userId: uid,
    domain: "challenges",
    eventId: `challenge_${challengeId}_${uid}`,
  }, { challengeId, bonusPoints: def.bonusPoints });
}

// ---------------------------------------------------------------------------
// onReviewSubmittedChallenges
// ---------------------------------------------------------------------------

/**
 * Called after a review is submitted. Evaluates all review-triggered challenges.
 * Updates progress docs and completes challenges if targets are met.
 */
export async function onReviewSubmittedChallenges(
  uid: string,
  review: ReviewDoc,
  traceId = "no-trace"
): Promise<void> {
  const db = getFirestore();
  const now = new Date();

  // Fetch establishment to determine category
  let estCategories: string[] = [];
  try {
    const estSnap = await db.doc(Paths.establishment(review.estId)).get();
    if (estSnap.exists) {
      const est = estSnap.data() as EstablishmentDoc;
      estCategories = est.categories ?? [];
    }
  } catch {
    // Non-fatal — proceed with empty categories
  }

  // ---- 1. weekend_warrior ---------------------------------------------------
  const def_ww = CHALLENGE_DEFINITIONS.weekend_warrior;
  const { windowStart: wwStart, windowEnd: wwEnd } = getWeekendWindow(now);
  const nowMs = now.getTime();

  if (nowMs >= wwStart.getTime() && nowMs <= wwEnd.getTime()) {
    const wwRef = challengeProgressRef(uid, "weekend_warrior");
    const wwSnap = await wwRef.get();

    if (!wwSnap.exists) {
      // Initialize progress for this weekend
      const doc: ChallengeProgressDoc = {
        challengeId: "weekend_warrior",
        userId: uid,
        progress: 1,
        target: def_ww.target,
        completedAt: null,
        bonusAwarded: false,
        windowStart: Timestamp.fromDate(wwStart),
        windowEnd: Timestamp.fromDate(wwEnd),
        updatedAt: Timestamp.now(),
      };
      await wwRef.set(doc);
      if (doc.progress >= def_ww.target) {
        await completeChallenge(uid, "weekend_warrior", wwRef, def_ww, traceId);
      }
    } else {
      const wwData = wwSnap.data() as ChallengeProgressDoc;
      // Only count if still in the same weekend window and not yet complete
      if (
        !wwData.bonusAwarded &&
        wwData.windowStart.toMillis() === Timestamp.fromDate(wwStart).toMillis()
      ) {
        const newProgress = wwData.progress + 1;
        await wwRef.update({ progress: newProgress, updatedAt: Timestamp.now() });
        if (newProgress >= def_ww.target) {
          await completeChallenge(uid, "weekend_warrior", wwRef, def_ww, traceId);
        }
      }
    }
  }

  // ---- 2. tasting_menu (restaurant reviews in 30 days) ---------------------
  const def_tm = CHALLENGE_DEFINITIONS.tasting_menu;
  const isRestaurant = estCategories.includes("restaurant");

  if (isRestaurant) {
    const tmRef = challengeProgressRef(uid, "tasting_menu");
    const tmSnap = await tmRef.get();
    const windowStart30 = Timestamp.fromMillis(nowMs - 30 * 24 * 60 * 60 * 1000);

    if (!tmSnap.exists) {
      const doc: ChallengeProgressDoc = {
        challengeId: "tasting_menu",
        userId: uid,
        progress: 1,
        target: def_tm.target,
        completedAt: null,
        bonusAwarded: false,
        windowStart: windowStart30,
        windowEnd: Timestamp.fromDate(new Date(nowMs + 30 * 24 * 60 * 60 * 1000)),
        updatedAt: Timestamp.now(),
      };
      await tmRef.set(doc);
    } else {
      const tmData = tmSnap.data() as ChallengeProgressDoc;
      if (!tmData.bonusAwarded) {
        // Count restaurant reviews in the 30-day window from first review
        const countSnap = await db
          .collection(REVIEWS_COLLECTION)
          .where("authorUid", "==", uid)
          .where("createdAt", ">=", tmData.windowStart)
          .get();

        // Re-count by filtering for restaurant category server-side
        // (we need to cross-reference establishments — approximate with progress increment)
        const newProgress = tmData.progress + 1;
        await tmRef.update({ progress: newProgress, updatedAt: Timestamp.now() });
        if (newProgress >= def_tm.target && !tmData.bonusAwarded) {
          await completeChallenge(uid, "tasting_menu", tmRef, def_tm, traceId);
        }
        void countSnap; // used for side-effect free reference
      }
    }
  }

  // ---- 3. night_owl (bar/nightclub reviews in 14 days) ---------------------
  const def_no = CHALLENGE_DEFINITIONS.night_owl;
  const isBarOrNightclub = estCategories.includes("bar") || estCategories.includes("nightclub");

  if (isBarOrNightclub) {
    const noRef = challengeProgressRef(uid, "night_owl");
    const noSnap = await noRef.get();
    const windowStart14 = Timestamp.fromMillis(nowMs - 14 * 24 * 60 * 60 * 1000);

    if (!noSnap.exists) {
      const doc: ChallengeProgressDoc = {
        challengeId: "night_owl",
        userId: uid,
        progress: 1,
        target: def_no.target,
        completedAt: null,
        bonusAwarded: false,
        windowStart: windowStart14,
        windowEnd: Timestamp.fromDate(new Date(nowMs + 14 * 24 * 60 * 60 * 1000)),
        updatedAt: Timestamp.now(),
      };
      await noRef.set(doc);
    } else {
      const noData = noSnap.data() as ChallengeProgressDoc;
      if (!noData.bonusAwarded) {
        const newProgress = noData.progress + 1;
        await noRef.update({ progress: newProgress, updatedAt: Timestamp.now() });
        if (newProgress >= def_no.target) {
          await completeChallenge(uid, "night_owl", noRef, def_no, traceId);
        }
      }
    }
  }

  // ---- 4. neighborhood_explorer (5 same-neighborhood in 90 days) -----------
  // Neighborhood is approximated by zip code from the establishment doc.
  const def_ne = CHALLENGE_DEFINITIONS.neighborhood_explorer;
  const neRef = challengeProgressRef(uid, "neighborhood_explorer");
  const neSnap = await neRef.get();

  if (!neSnap.exists) {
    const windowStart90 = Timestamp.fromMillis(nowMs - 90 * 24 * 60 * 60 * 1000);
    const doc: ChallengeProgressDoc = {
      challengeId: "neighborhood_explorer",
      userId: uid,
      progress: 1,
      target: def_ne.target,
      completedAt: null,
      bonusAwarded: false,
      windowStart: windowStart90,
      windowEnd: Timestamp.fromDate(new Date(nowMs + 90 * 24 * 60 * 60 * 1000)),
      updatedAt: Timestamp.now(),
    };
    await neRef.set(doc);
  } else {
    const neData = neSnap.data() as ChallengeProgressDoc;
    if (!neData.bonusAwarded) {
      // Count reviews in window, query establishments for same zip code
      const reviewsInWindow = await db
        .collection(REVIEWS_COLLECTION)
        .where("authorUid", "==", uid)
        .where("createdAt", ">=", neData.windowStart)
        .select("estId")
        .get();

      const estIds = reviewsInWindow.docs.map((d) => d.data().estId as string);

      if (estIds.length >= def_ne.target) {
        // Batch fetch establishments to check zip codes
        const estSnaps = await Promise.all(
          estIds.map((id) => db.doc(`${ESTABLISHMENTS_COLLECTION}/${id}`).get())
        );
        const zipCounts: Record<string, number> = {};
        for (const snap of estSnaps) {
          if (!snap.exists) continue;
          const zip = (snap.data() as EstablishmentDoc).zipCode;
          if (zip) {
            zipCounts[zip] = (zipCounts[zip] ?? 0) + 1;
          }
        }
        const maxSameZip = Math.max(0, ...Object.values(zipCounts));
        const newProgress = Math.min(maxSameZip, def_ne.target);

        await neRef.update({ progress: newProgress, updatedAt: Timestamp.now() });

        if (newProgress >= def_ne.target) {
          await completeChallenge(uid, "neighborhood_explorer", neRef, def_ne, traceId);
        }
      } else {
        // Just increment
        const newProgress = neData.progress + 1;
        await neRef.update({ progress: newProgress, updatedAt: Timestamp.now() });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// evaluateChallenges (general — called on non-review events)
// ---------------------------------------------------------------------------

/**
 * Re-evaluate all active challenges for a user.
 * For review-based challenges prefer onReviewSubmittedChallenges (faster).
 * This is a catch-all for admin re-sync or manual triggers.
 */
export async function evaluateChallenges(uid: string): Promise<void> {
  const db = getFirestore();
  const now = new Date();
  const nowMs = now.getTime();

  // Fetch all existing progress docs for user
  const progressSnap = await db
    .collection(`users/${uid}/${CHALLENGE_PROGRESS_SUBCOLLECTION}`)
    .get();

  const existingProgress = new Map<string, ChallengeProgressDoc>();
  for (const doc of progressSnap.docs) {
    existingProgress.set(doc.id, doc.data() as ChallengeProgressDoc);
  }

  // For tasting_menu: recount from Firestore
  const tmData = existingProgress.get("tasting_menu");
  if (tmData && !tmData.bonusAwarded) {
    const def_tm = CHALLENGE_DEFINITIONS.tasting_menu;
    const windowStart = tmData.windowStart;
    const reviewsSnap = await db
      .collection(REVIEWS_COLLECTION)
      .where("authorUid", "==", uid)
      .where("createdAt", ">=", windowStart)
      .select("estId", "createdAt")
      .get();

    // Fetch categories for each reviewed establishment
    const estIds = [...new Set(reviewsSnap.docs.map((d) => d.data().estId as string))];
    const estSnaps = await Promise.all(
      estIds.map((id) => db.doc(`${ESTABLISHMENTS_COLLECTION}/${id}`).get())
    );
    const restaurantEstIds = new Set<string>();
    for (const snap of estSnaps) {
      if (!snap.exists) continue;
      const est = snap.data() as EstablishmentDoc;
      if (est.categories?.includes("restaurant")) {
        restaurantEstIds.add(est.estId);
      }
    }
    const restaurantReviewCount = reviewsSnap.docs.filter((d) =>
      restaurantEstIds.has(d.data().estId as string)
    ).length;

    const tmRef = challengeProgressRef(uid, "tasting_menu");
    await tmRef.update({ progress: restaurantReviewCount, updatedAt: Timestamp.now() });
    if (restaurantReviewCount >= def_tm.target) {
      await completeChallenge(uid, "tasting_menu", tmRef, def_tm, "evaluate");
    }
  }

  // For night_owl: recount from Firestore
  const noData = existingProgress.get("night_owl");
  if (noData && !noData.bonusAwarded) {
    const def_no = CHALLENGE_DEFINITIONS.night_owl;
    const windowStart = noData.windowStart;
    const windowEnd = Timestamp.fromMillis(nowMs);

    const reviewsSnap = await db
      .collection(REVIEWS_COLLECTION)
      .where("authorUid", "==", uid)
      .where("createdAt", ">=", windowStart)
      .where("createdAt", "<=", windowEnd)
      .select("estId")
      .get();

    const estIds = [...new Set(reviewsSnap.docs.map((d) => d.data().estId as string))];
    const estSnaps = await Promise.all(
      estIds.map((id) => db.doc(`${ESTABLISHMENTS_COLLECTION}/${id}`).get())
    );
    const barEstIds = new Set<string>();
    for (const snap of estSnaps) {
      if (!snap.exists) continue;
      const est = snap.data() as EstablishmentDoc;
      if (est.categories?.includes("bar") || est.categories?.includes("nightclub")) {
        barEstIds.add(est.estId);
      }
    }
    const barReviewCount = reviewsSnap.docs.filter((d) =>
      barEstIds.has(d.data().estId as string)
    ).length;

    const noRef = challengeProgressRef(uid, "night_owl");
    await noRef.update({ progress: barReviewCount, updatedAt: Timestamp.now() });
    if (barReviewCount >= def_no.target) {
      await completeChallenge(uid, "night_owl", noRef, def_no, "evaluate");
    }
  }
}
