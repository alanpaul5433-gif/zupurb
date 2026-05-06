/**
 * index.ts — Cloud Functions entry point.
 *
 * B1: Admin SDK initialized.
 * B2: Identity & Profile triggers + callables registered.
 * B3: UAR engine, fingerprint engine, anti-fraud trigger, admin callable, UAR cron.
 *
 * All functions use 2nd gen (firebase-functions/v2).
 */

import { initializeApp } from "firebase-admin/app";

// Initialize the Admin SDK once at module load.
initializeApp();

// ---------------------------------------------------------------------------
// B2 — Identity & Profile
// ---------------------------------------------------------------------------

export { onUserCreate } from "./triggers/onUserCreate";
export { onUserDelete } from "./triggers/onUserDelete";
export { completeOnboarding } from "./http/completeOnboarding";
export { updateProfile } from "./http/updateProfile";
export { checkUsernameAvailable } from "./http/checkUsernameAvailable";

// ---------------------------------------------------------------------------
// B3 — UAR & Anti-Fraud
// ---------------------------------------------------------------------------

export { onReviewWriteFraudCheck } from "./triggers/onReviewWrite";
export { adminFlagUser }           from "./http/adminFlagUser";
export { recomputeUAR }            from "./scheduled/recomputeUAR";

// ---------------------------------------------------------------------------
// B4 — Review Submission & Fan-Out
// ---------------------------------------------------------------------------

export { submitReview }               from "./http/submitReview";
export { recomputeEstablishmentScore } from "./http/recomputeEstablishmentScore";
export { getEstablishmentScore }       from "./http/getEstablishmentScore";
export { voteReview }                  from "./http/voteReview";

// ---------------------------------------------------------------------------
// B5 — Points Ledger, Badges & Challenges
// ---------------------------------------------------------------------------

export { getPointsWallet }  from "./http/getPointsWallet";
export { getLedgerHistory } from "./http/getLedgerHistory";
export { getChallenges }    from "./http/getChallenges";
export { expirePoints }     from "./scheduled/expirePoints";
export { recomputeTiers }   from "./scheduled/recomputeTiers";

// ---------------------------------------------------------------------------
// B6 — Deals & Redemptions
// ---------------------------------------------------------------------------

export { getDeals }               from "./http/getDeals";
export { redeemDeal }             from "./http/redeemDeal";
export { getRedemptionHistory }   from "./http/getRedemptionHistory";
export { createDeal }             from "./http/createDeal";
export { deactivateDeal }         from "./http/deactivateDeal";
export { onDealRedemptionWrite }  from "./triggers/onDealRedemptionWrite";
