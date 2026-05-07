/**
 * domains/badges/index.ts — Badge domain barrel.
 *
 * Re-exports all badge-domain callables and utilities for use
 * by index.ts and other domains.
 *
 * Milestone: B7
 */

export { getBadges }                  from "../../badges/getBadges";
export { badges_challengesCron }      from "../../badges/challengeCron";
export { awardBadge, evaluateBadgeProgress, getUserBadges } from "../../badges/progression";
export { checkFounderCap }            from "../../badges/founderCap";
