/**
 * domains/challenges/index.ts — Challenges domain barrel.
 *
 * Re-exports challenge progression utilities for use by other domains
 * (e.g., reviews/submit calls onReviewSubmittedChallenges).
 *
 * Note: The getChallenges callable is registered via http/getChallenges.ts
 * and exported directly from index.ts. The challenge cron
 * (badges_challengesCron) lives in domains/badges and is also registered
 * from index.ts to keep all badge/challenge crons co-located.
 *
 * Milestone: B7
 */

export {
  onReviewSubmittedChallenges,
  evaluateChallenges,
  CHALLENGE_DEFINITIONS,
} from "../../lib/challenges";
