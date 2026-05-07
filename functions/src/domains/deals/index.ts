/**
 * domains/deals/index.ts — Deals domain barrel.
 *
 * Re-exports the B9 matching engine and redemption flow so other domains
 * can import from a single path.
 *
 * Milestone: B9
 */

export { getDealsForUser, getDealsByEstablishment } from "../../deals/matching";
export { initiateDealRedemption, confirmDealRedemption, expireUnredeemedDeals } from "../../deals/redemption";
export { checkDealAbuseThrottle } from "../../deals/antiAbuse";
