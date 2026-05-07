/**
 * progression.ts — Badge progression engine.
 *
 * Responsibilities:
 *   - evaluateBadgeProgress: called after key user actions to check all
 *     auto-unlock badges the user has not yet earned.
 *   - awardBadge: writes UserBadgeDoc, credits bonus points, sends a
 *     notification stub. Enforces Founder cap before awarding founder badge.
 *   - getUserBadges: returns all earned badges for a user.
 *
 * Integration points:
 *   - Called from reviews/submit (after review published)
 *   - Called from reservations (after check-in)
 *   - Called from completeOnboarding (trailblazer check)
 *   - Called from challenges cron (badge reward for challenge completion)
 *
 * Badge unlock conditions (server-side only — never client-trusted):
 *   taster        — first review ever submitted
 *   first_bite    — first verified review (verificationTier == "verified")
 *   critic        — reviewCount >= 10
 *   explorer      — reviewed 5+ distinct establishments
 *   trailblazer   — onboarding complete
 *   founder       — admin-only; blocked here unless explicitly bypassed
 *
 * RC keys (badge bonus points):
 *   badge_taster_bonus    (default 150)
 *   badge_critic_bonus    (default 200)
 *   badge_explorer_bonus  (default 300)
 *   badge_founder_bonus   (default 500)
 *
 * Milestone: B7
 */

import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  Paths,
  UserBadgeDoc,
  BadgeDefinitionDoc,
  REVIEWS_COLLECTION,
  ReviewDoc,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  NotificationDoc,
} from "../lib/schema";
import { awardPoints } from "../lib/ledger";
import { log } from "../lib/logging";
import { BADGE_DEFINITIONS, BadgeId, VALID_BADGE_IDS } from "../lib/badges";
import { checkFounderCap } from "./founderCap";
import type { AwardBadgeResult, EvaluateBadgeProgressResult } from "../types/badges";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getBadgeBonus(badgeId: string, db: Firestore): Promise<number> {
  // Try the Firestore definition first (admin can override via Retool).
  // Fall back to the in-code constant.
  try {
    const defSnap = await db.doc(Paths.badge(badgeId)).get();
    if (defSnap.exists) {
      const def = defSnap.data() as BadgeDefinitionDoc;
      return def.pointsOnUnlock ?? 0;
    }
  } catch {
    // Non-fatal: fall through to in-code default
  }
  return BADGE_DEFINITIONS[badgeId]?.bonusPoints ?? 0;
}

async function sendBadgeNotification(
  uid: string,
  badgeId: string,
  badgeName: string,
  db: Firestore
): Promise<void> {
  const notifId = `badge_${badgeId}_${uid}_${Date.now()}`;
  const notif: NotificationDoc = {
    notifId,
    userId: uid,
    type: "badge_unlocked",
    title: "Badge Unlocked!",
    body: `You earned the ${badgeName} badge.`,
    deepLinkPath: "/badges",
    imageUrl: null,
    payload: { badgeId },
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

// ---------------------------------------------------------------------------
// awardBadge
// ---------------------------------------------------------------------------

/**
 * Award a badge to a user.
 *
 * - Validates the badgeId against VALID_BADGE_IDS.
 * - For the founder badge: calls checkFounderCap and rejects if at cap
 *   (unless skipCapCheck is true — admin-override path).
 * - Idempotent: returns { awarded: false, bonusPoints: 0 } if already earned.
 * - Writes UserBadgeDoc to userBadges/{uid}/badges/{badgeId}.
 * - Awards bonus points via the ledger.
 * - Sends an in-app notification stub.
 */
export async function awardBadge(
  uid: string,
  badgeId: string,
  db: Firestore,
  options?: {
    awardedByUid?: string;    // admin uid for manual awards
    skipCapCheck?: boolean;   // only true for admin-override path
    traceId?: string;
  }
): Promise<AwardBadgeResult> {
  const traceId = options?.traceId ?? "no-trace";

  // Validate badge ID
  if (!VALID_BADGE_IDS.includes(badgeId as BadgeId)) {
    throw new HttpsError("invalid-argument", `Unknown badge ID: ${badgeId}`);
  }

  // Founder badge cap check (skip only on explicit admin override)
  if (badgeId === "founder" && !options?.skipCapCheck) {
    const capResult = await checkFounderCap(db);
    if (capResult.atCap) {
      log.warn("awardBadge: founder cap reached", {
        traceId,
        userId: uid,
        domain: "badges",
        eventId: `badge_founder_cap_${uid}`,
      }, { count: capResult.count, cap: capResult.cap });
      return { awarded: false, bonusPoints: 0 };
    }
  }

  const badgeRef = db.doc(Paths.userBadge(uid, badgeId));
  const existing = await badgeRef.get();
  if (existing.exists) {
    return { awarded: false, bonusPoints: 0 };
  }

  // Check requiresAdminApproval on Firestore definition
  if (!options?.awardedByUid) {
    try {
      const defSnap = await db.doc(Paths.badge(badgeId)).get();
      if (defSnap.exists) {
        const def = defSnap.data() as BadgeDefinitionDoc;
        if (def.requiresAdminApproval) {
          log.warn("awardBadge: badge requires admin approval, skipping auto-award", {
            traceId,
            userId: uid,
            domain: "badges",
            eventId: `badge_admin_required_${uid}`,
          }, { badgeId });
          return { awarded: false, bonusPoints: 0 };
        }
      }
    } catch {
      // Non-fatal — proceed optimistically for auto-unlock badges
    }
  }

  const now = Timestamp.now();
  const badgeDoc: UserBadgeDoc = {
    badgeId,
    userId: uid,
    earnedAt: now,
    awardedBy: options?.awardedByUid ?? null,
  };

  await badgeRef.set(badgeDoc);

  // Award bonus points
  const bonusPoints = await getBadgeBonus(badgeId, db);
  if (bonusPoints > 0) {
    await awardPoints(uid, {
      amount: bonusPoints,
      type: "earn_badge_unlock",
      description: `Badge unlocked: ${badgeId}`,
      relatedEntityType: "badge",
      relatedEntityId: badgeId,
    });
  }

  // Notification stub (non-fatal if it fails)
  const badgeName = BADGE_DEFINITIONS[badgeId]?.name ?? badgeId;
  try {
    await sendBadgeNotification(uid, badgeId, badgeName, db);
  } catch {
    // Non-fatal — badge is already written
  }

  log.info("awardBadge: badge awarded", {
    traceId,
    userId: uid,
    domain: "badges",
    eventId: `badge_${badgeId}_${uid}`,
  }, { badgeId, bonusPoints });

  return { awarded: true, bonusPoints };
}

// ---------------------------------------------------------------------------
// evaluateBadgeProgress
// ---------------------------------------------------------------------------

/**
 * Evaluate all auto-unlock badge conditions for a user.
 * Called after key user actions: review submit, check-in, onboarding complete.
 *
 * Idempotent: awardBadge guards against double-award.
 *
 * @param uid - The user to evaluate.
 * @param action - The triggering action (for logging; does not restrict which badges are checked).
 * @param db - Firestore instance.
 * @param traceId - Optional trace ID for structured logging.
 */
export async function evaluateBadgeProgress(
  uid: string,
  action: string,
  db: Firestore,
  traceId?: string
): Promise<EvaluateBadgeProgressResult> {
  const trace = traceId ?? "no-trace";
  const newlyAwarded: string[] = [];

  // Fetch user document for counts + flags
  const userSnap = await db.doc(Paths.user(uid)).get();
  if (!userSnap.exists) {
    return { newlyAwarded };
  }
  const userData = userSnap.data() as {
    reviewCount?: number;
    verifiedReviewCount?: number;
    onboardingComplete?: boolean;
  };

  const reviewCount = userData.reviewCount ?? 0;
  const verifiedReviewCount = userData.verifiedReviewCount ?? 0;
  const onboardingComplete = userData.onboardingComplete ?? false;

  // Helper to run awardBadge and record result
  async function tryAward(badgeId: string): Promise<void> {
    const result = await awardBadge(uid, badgeId, db, { traceId: trace });
    if (result.awarded) {
      newlyAwarded.push(badgeId);
    }
  }

  // --- trailblazer: onboarding complete ---
  if (onboardingComplete) {
    await tryAward("trailblazer");
  }

  // --- taster: first review ever submitted ---
  if (reviewCount >= 1) {
    await tryAward("taster");
  }

  // --- first_bite: first verified review ---
  if (verifiedReviewCount >= 1) {
    await tryAward("first_bite");
  }

  // --- critic: 10+ reviews ---
  if (reviewCount >= 10) {
    await tryAward("critic");
  }

  // --- explorer: 5+ distinct establishments ---
  const reviewsSnap = await db
    .collection(REVIEWS_COLLECTION)
    .where("authorUid", "==", uid)
    .where("status", "in", ["published", "pending"])
    .select("estId")
    .get();

  const distinctEsts = new Set<string>();
  for (const doc of reviewsSnap.docs) {
    const d = doc.data() as Pick<ReviewDoc, "estId">;
    distinctEsts.add(d.estId);
  }

  if (distinctEsts.size >= 5) {
    await tryAward("explorer");
  }

  if (newlyAwarded.length > 0) {
    log.info("evaluateBadgeProgress: badges awarded", {
      traceId: trace,
      userId: uid,
      domain: "badges",
      eventId: `badge_eval_${uid}`,
    }, { action, newlyAwarded });
  }

  return { newlyAwarded };
}

// ---------------------------------------------------------------------------
// getUserBadges
// ---------------------------------------------------------------------------

/**
 * Return all earned badges for a user, ordered by earnedAt descending.
 */
export async function getUserBadges(
  uid: string,
  db: Firestore
): Promise<UserBadgeDoc[]> {
  const snap = await db
    .collection(`userBadges/${uid}/badges`)
    .orderBy("earnedAt", "desc")
    .get();

  return snap.docs.map((d) => d.data() as UserBadgeDoc);
}
