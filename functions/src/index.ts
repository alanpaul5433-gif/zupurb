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

// ---------------------------------------------------------------------------
// B7 — Reservations
// ---------------------------------------------------------------------------

export { createReservation }         from "./http/createReservation";
export { cancelReservation }         from "./http/cancelReservation";
export { verifyCheckIn }             from "./http/verifyCheckIn";
export { getReservations }           from "./http/getReservations";
export { getAvailableSlots }         from "./http/getAvailableSlots";
export { processNoShows }            from "./scheduled/processNoShows";
export { sendReservationReminders }  from "./scheduled/sendReservationReminders";

// ---------------------------------------------------------------------------
// B8 — Messaging (in-house Firestore chat)
// ---------------------------------------------------------------------------

export { createConversation }    from "./http/createConversation";
export { sendMessage }           from "./http/sendMessage";
export { getConversations }      from "./http/getConversations";
export { getMessages }           from "./http/getMessages";
export { markConversationRead }  from "./http/markConversationRead";
export { deleteMessage }         from "./http/deleteMessage";
export { onMessageWrite }        from "./triggers/onMessageWrite";

// ---------------------------------------------------------------------------
// B9 — Search & Discovery
// ---------------------------------------------------------------------------

export { searchVenues }             from "./http/searchVenues";
export { searchUsers }              from "./http/searchUsers";
export { searchContent }            from "./http/searchContent";
export { getDiscoverFeed }          from "./http/getDiscoverFeed";
export { getHomeFeed }              from "./http/getHomeFeed";
export { getEstablishmentDetail }   from "./http/getEstablishmentDetail";
export { onEstablishmentWrite }     from "./triggers/onEstablishmentWrite";
export { refreshDiscoverCache }     from "./scheduled/refreshDiscoverCache";

// ---------------------------------------------------------------------------
// B10 — Notifications
// ---------------------------------------------------------------------------

export { getNotifications }                 from "./http/getNotifications";
export { markNotificationsRead }            from "./http/markNotificationsRead";
export { deleteNotification }               from "./http/deleteNotification";
export { updateNotificationPreferences }    from "./http/updateNotificationPreferences";
export { registerFCMToken }                 from "./http/registerFCMToken";
export { unregisterFCMToken }               from "./http/unregisterFCMToken";
export { onNotificationWrite }              from "./triggers/onNotificationWrite";
export { cleanupOldNotifications }          from "./scheduled/cleanupOldNotifications";

// ---------------------------------------------------------------------------
// B11 — Caching & Performance (Redis/Upstash)
// ---------------------------------------------------------------------------

export { warmCache }         from "./http/warmCache";
export { evictStaleCache }   from "./scheduled/evictStaleCache";

// ---------------------------------------------------------------------------
// B12 — Admin & Moderation
// ---------------------------------------------------------------------------

// Content reporting & moderation queue
export { reportContent }           from "./http/reportContent";
export { moderateReview }          from "./http/moderateReview";
export { getModerationQueue }      from "./http/getModerationQueue";
export { resolveModerationItem }   from "./http/resolveModerationItem";

// Establishment management
export { createEstablishment }     from "./http/createEstablishment";
export { updateEstablishment }     from "./http/updateEstablishment";
export { verifyEstablishment }     from "./http/verifyEstablishment";

// User management
export { adminGetUser }            from "./http/adminGetUser";
export { adminBanUser }            from "./http/adminBanUser";
export { adminUnbanUser }          from "./http/adminUnbanUser";

// Scheduled
export { processBanExpirations }   from "./scheduled/processBanExpirations";

// ---------------------------------------------------------------------------
// B13 — Referral System
// ---------------------------------------------------------------------------

export { getMyReferralCode }            from "./http/getMyReferralCode";
export { applyReferralCode }            from "./http/applyReferralCode";
export { validateReferralCodePublic }   from "./http/validateReferralCodePublic";
export { adminGetReferralStats }        from "./http/adminGetReferralStats";
export { expireStaleReferrals }         from "./scheduled/expireStaleReferrals";

// ---------------------------------------------------------------------------
// B14 — Loyalty Tiers Engine
// ---------------------------------------------------------------------------

export { getTierStatus }           from "./http/getTierStatus";
export { getTierPerks }            from "./http/getTierPerks";
export { adminAdjustTier }         from "./http/adminAdjustTier";
export { processPlusExpirations }  from "./scheduled/processPlusExpirations";

// ---------------------------------------------------------------------------
// I4 — OCR Vendor Harness & Production Receipt Extraction
// ---------------------------------------------------------------------------

export { runOCRHarnessCallable as runOCRHarness }  from "./http/runOCRHarness";
export { extractReceiptData }                       from "./http/extractReceiptData";

// ---------------------------------------------------------------------------
// I5 — Algolia Multi-Index Search
// ---------------------------------------------------------------------------

export { adminReindexAlgolia } from "./http/adminReindexAlgolia";

// ---------------------------------------------------------------------------
// I7 — RevenueCat IAP Webhook
// Receives POST /revenueCatWebhook from RevenueCat.
// Activates / deactivates Zupurb Plus by calling activatePlus / deactivatePlus.
// ---------------------------------------------------------------------------

export { revenueCatWebhook } from "./integrations/revenuecat/webhook";

// ---------------------------------------------------------------------------
// I8 — Gift Cards (Tremendous)
// tremendousWebhook: POST endpoint for Tremendous order status webhooks
// syncTremendousOrders: hourly job to reconcile pending orders
// adminListTremendousProducts: admin callable to browse the Tremendous catalog
// ---------------------------------------------------------------------------

export { tremendousWebhook }           from "./integrations/tremendous/webhookHandler";
export { syncTremendousOrders }        from "./scheduled/syncTremendousOrders";
export { adminListTremendousProducts } from "./http/adminListTremendousProducts";

// ---------------------------------------------------------------------------
// D8 — Crashlytics Alerts
// ---------------------------------------------------------------------------

export {
  alerts_onNewFatalIssue,
  alerts_onNewAnrIssue,
  alerts_onVelocityAlert,
  alerts_onStabilityDigest,
} from "./alerts/crashlytics_alerts";
