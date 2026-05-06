/**
 * badges.ts — Badge unlock utility.
 *
 * Reusable across submitReview (B4), badge progression engine (B7), and challenges (B8).
 *
 * Badge IDs from SOW §13.1. Only these IDs are valid for automatic unlock.
 * Founder badge requires admin award and is excluded from this utility.
 *
 * Milestone: B4
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { Paths, UserBadgeDoc, BadgeDefinitionDoc, REVIEWS_COLLECTION, ReviewDoc } from "./schema";
import { log } from "./logging";
import { awardPoints } from "./ledger";

// ---------------------------------------------------------------------------
// Valid badge IDs from SOW §13.1
// ---------------------------------------------------------------------------

export const VALID_BADGE_IDS = [
  "taster",         // First review ever submitted
  "first_bite",     // First verified review (photo or receipt)
  "critic",         // 10+ reviews submitted
  "explorer",       // Reviewed 5+ different establishments
  "trailblazer",    // Onboarding complete
  "founder",        // Admin-only; first 150 members (not auto-unlockable here)
] as const;

export type BadgeId = typeof VALID_BADGE_IDS[number];

// ---------------------------------------------------------------------------
// unlockBadge
// ---------------------------------------------------------------------------

/**
 * Unlock a badge for a user if not already earned.
 *
 * - Checks VALID_BADGE_IDS before writing.
 * - Founder badge is excluded from automatic unlock (requiresAdminApproval gate).
 * - Reads the badge definition to get bonus points, then awards them via the ledger.
 * - Writes to userBadges/{uid}/badges/{badgeId}.
 * - Returns true if newly unlocked, false if already earned.
 *
 * NOTE: This function does NOT award bonus points itself — the caller (submitReview)
 * handles point awards to keep the ledger write in a single coordinated flow.
 * It returns the badgeId and the bonus points amount from the badge definition.
 */
export interface UnlockBadgeResult {
  newlyUnlocked: boolean;
  bonusPoints: number;
}

export async function unlockBadge(
  uid: string,
  badgeId: string,
  traceId?: string
): Promise<UnlockBadgeResult> {
  // Validate badge ID
  if (!VALID_BADGE_IDS.includes(badgeId as BadgeId)) {
    throw new HttpsError("invalid-argument", `Unknown badge ID: ${badgeId}`);
  }

  // Founder badge is admin-only
  if (badgeId === "founder") {
    throw new HttpsError(
      "permission-denied",
      "Founder badge can only be awarded by an admin."
    );
  }

  const db = getFirestore();
  const badgeRef = db.doc(Paths.userBadge(uid, badgeId));
  const existing = await badgeRef.get();

  if (existing.exists) {
    return { newlyUnlocked: false, bonusPoints: 0 };
  }

  // Fetch badge definition for bonus points
  let bonusPoints = 0;
  const defRef = db.doc(Paths.badge(badgeId));
  const defSnap = await defRef.get();
  if (defSnap.exists) {
    const def = defSnap.data() as BadgeDefinitionDoc;
    // Respect requiresAdminApproval gate even for non-founder badges
    if (def.requiresAdminApproval) {
      return { newlyUnlocked: false, bonusPoints: 0 };
    }
    bonusPoints = def.pointsOnUnlock ?? 0;
  }

  const now = Timestamp.now();
  const badgeDoc: UserBadgeDoc = {
    badgeId,
    userId: uid,
    earnedAt: now,
    awardedBy: null,
  };

  await badgeRef.set(badgeDoc);

  if (traceId) {
    log.info("unlockBadge: badge earned", {
      traceId,
      userId: uid,
      domain: "badges",
      eventId: `badge_${badgeId}_${uid}`,
    }, { badgeId, bonusPoints });
  }

  return { newlyUnlocked: true, bonusPoints };
}

// ---------------------------------------------------------------------------
// Badge definitions — in-code fallback (authoritative values stored in Firestore
// badges/{badgeId} and managed via Admin; these are the server-side defaults)
// ---------------------------------------------------------------------------

interface BadgeDefinition {
  id: string;
  name: string;
  /** Trigger classification — for documentation and checks below */
  trigger: "onboarding_complete" | "first_review" | "first_verified_review" | "review_count_10" | "unique_establishments_5" | "admin_grant";
  bonusPoints: number;  // awarded on unlock (0 if definition lives in Firestore)
}

export const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  trailblazer: {
    id: "trailblazer",
    name: "Trailblazer",
    trigger: "onboarding_complete",
    bonusPoints: 0,
  },
  taster: {
    id: "taster",
    name: "Taster",
    trigger: "first_review",
    bonusPoints: 150, // RC: badge_taster_bonus (matches POINTS_FIRST_REVIEW_BONUS in submitReview)
  },
  first_bite: {
    id: "first_bite",
    name: "First Bite",
    trigger: "first_verified_review",
    bonusPoints: 0, // bonus read from Firestore definition at runtime
  },
  critic: {
    id: "critic",
    name: "Critic",
    trigger: "review_count_10",
    bonusPoints: 200, // RC: badge_critic_bonus
  },
  explorer: {
    id: "explorer",
    name: "Explorer",
    trigger: "unique_establishments_5",
    bonusPoints: 300, // RC: badge_explorer_bonus
  },
  founder: {
    id: "founder",
    name: "Founder",
    trigger: "admin_grant",
    bonusPoints: 500, // RC: badge_founder_bonus — awarded only by admin callable
  },
};

// ---------------------------------------------------------------------------
// checkAndUnlockBadges
// ---------------------------------------------------------------------------

/**
 * Check all auto-unlock badge conditions for a user and unlock any newly earned badges.
 * Awards bonus points for each newly unlocked badge via the ledger.
 * Returns an array of newly unlocked badge IDs.
 *
 * Called after:
 * - Review submission (review count + unique establishment checks)
 * - Onboarding completion (trailblazer check)
 *
 * Idempotent: unlockBadge already guards against double-unlock.
 */
export async function checkAndUnlockBadges(
  uid: string,
  traceId?: string
): Promise<string[]> {
  const db = getFirestore();
  const newlyUnlocked: string[] = [];

  // Fetch user document for review count
  const userSnap = await db.doc(Paths.user(uid)).get();
  if (!userSnap.exists) return [];
  const userData = userSnap.data() as { reviewCount?: number; onboardingComplete?: boolean };
  const reviewCount = userData.reviewCount ?? 0;
  const onboardingComplete = userData.onboardingComplete ?? false;

  // --- trailblazer: onboarding complete ---
  if (onboardingComplete) {
    const result = await unlockBadge(uid, "trailblazer", traceId);
    if (result.newlyUnlocked) {
      newlyUnlocked.push("trailblazer");
      // Trailblazer has 0 bonus points by design
    }
  }

  // --- critic: review count >= 10 ---
  if (reviewCount >= 10) {
    const result = await unlockBadge(uid, "critic", traceId);
    if (result.newlyUnlocked) {
      newlyUnlocked.push("critic");
      const bonusPoints = result.bonusPoints > 0
        ? result.bonusPoints
        : BADGE_DEFINITIONS.critic.bonusPoints;
      if (bonusPoints > 0) {
        await awardPoints(uid, {
          amount: bonusPoints,
          type: "earn_badge_unlock",
          description: "Critic badge — 10 reviews submitted",
          relatedEntityType: "badge",
          relatedEntityId: "critic",
        });
      }
    }
  }

  // --- explorer: 5+ distinct establishments reviewed ---
  const reviewsSnap = await db
    .collection(REVIEWS_COLLECTION)
    .where("authorUid", "==", uid)
    .where("status", "in", ["published", "pending"])
    .select("estId")
    .get();

  const distinctEstablishments = new Set<string>();
  for (const doc of reviewsSnap.docs) {
    const d = doc.data() as Pick<ReviewDoc, "estId">;
    distinctEstablishments.add(d.estId);
  }

  if (distinctEstablishments.size >= 5) {
    const result = await unlockBadge(uid, "explorer", traceId);
    if (result.newlyUnlocked) {
      newlyUnlocked.push("explorer");
      const bonusPoints = result.bonusPoints > 0
        ? result.bonusPoints
        : BADGE_DEFINITIONS.explorer.bonusPoints;
      if (bonusPoints > 0) {
        await awardPoints(uid, {
          amount: bonusPoints,
          type: "earn_badge_unlock",
          description: "Explorer badge — 5 distinct establishments reviewed",
          relatedEntityType: "badge",
          relatedEntityId: "explorer",
        });
      }
    }
  }

  if (newlyUnlocked.length > 0 && traceId) {
    log.info("checkAndUnlockBadges: badges unlocked", {
      traceId,
      userId: uid,
      domain: "badges",
      eventId: `badge_check_${uid}`,
    }, { newlyUnlocked });
  }

  return newlyUnlocked;
}
