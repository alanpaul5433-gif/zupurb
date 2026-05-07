/**
 * badges.ts — Canonical type definitions for the badges & challenges domain.
 *
 * These interfaces align with the Firestore schema defined in lib/schema.ts and
 * the B7 spec. They are provided here as a single-import convenience for other
 * domains that consume badge/challenge data without importing the full schema.
 *
 * Milestone: B7
 */

// Re-export from schema for consumers that prefer the types/ barrel.
export type {
  BadgeDefinitionDoc,
  UserBadgeDoc,
  ChallengeDefinitionDoc,
  UserChallengeProgressDoc,
  BadgeCategory,
} from "../lib/schema";

// ---------------------------------------------------------------------------
// B7: Result types returned by progression functions
// ---------------------------------------------------------------------------

export interface AwardBadgeResult {
  /** true when the badge was newly awarded in this call; false if already held. */
  awarded: boolean;
  /** Bonus points credited to the user for this badge award (0 if already held or no bonus). */
  bonusPoints: number;
}

export interface CheckFounderCapResult {
  atCap: boolean;
  count: number;
  cap: number;
}

export interface EvaluateBadgeProgressResult {
  newlyAwarded: string[]; // badgeIds awarded in this evaluation pass
}
