/**
 * domains/referrals/index.ts — Referral domain barrel.
 *
 * Exports all B13 referral callables and library functions.
 *
 * Milestone: B13
 */

// Callable Cloud Functions
export { getReferralCode }   from "./codes";
export { getReferralStats }  from "./stats";

// Library functions (imported by other domains)
export { generateReferralCode, ensureReferralCodeDoc } from "./codes";
export { writeReferralDoc, getReferralDocByReferee }   from "./attribution";
export { onFirstVerifiedReview }                        from "./rewards";
