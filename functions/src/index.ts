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

export { onUserCreate }     from "./triggers/onUserCreate";
export { onUserDelete }     from "./triggers/onUserDelete";
export { seedDemoData }     from "./admin/seedDemoData"; // temporary demo seeder
export { completeOnboarding }       from "./http/completeOnboarding";
export { updateProfile }            from "./http/updateProfile";
export { checkUsernameAvailable }   from "./http/checkUsernameAvailable";

// B2 — Profile domain callables
export { getProfile, deleteAccount, exportUserData } from "./users/profile";

// B2 — Account cleanup jobs
export {
  purgeExpiredAccounts,
  onScheduledDeleteCreated,
} from "./users/cleanup";

// ---------------------------------------------------------------------------
// B3 — UAR & Anti-Fraud
// ---------------------------------------------------------------------------

export { onReviewWriteFraudCheck } from "./triggers/onReviewWrite";
export { onReviewWritten }         from "./reviews/triggers";
export { adminFlagUser }           from "./http/adminFlagUser";
export { recomputeUAR }            from "./scheduled/recomputeUAR";

// B3 — Moderation helpers (callable by other domains; not exported as Cloud Functions)
// Exported here so other domains can import from index.ts as a single barrel.
// These are library functions, not Cloud Function registrations.
export { maybeSandboxUser }        from "./moderation/sandbox";
export { checkWeeklyReviewCap, incrementWeeklyReviewCount } from "./moderation/caps";
export { quarantineReview }        from "./moderation/quarantine";

// ---------------------------------------------------------------------------
// B4 — Review Submission & Fan-Out
// ---------------------------------------------------------------------------

// B5 canonical callable (supersedes ./http/submitReview for new clients).
// B4 legacy kept as submitReview_b4 for backward compatibility — remove in B6 cleanup (FIX_LIST P1).
export { submitReview }               from "./reviews/submit";
export { updateEstablishmentScore }   from "./reviews/aggregation";
export { submitReview as submitReview_b4 } from "./http/submitReview";
export { recomputeEstablishmentScore } from "./http/recomputeEstablishmentScore";
export { getEstablishmentScore }       from "./http/getEstablishmentScore";
export { voteReview }                  from "./http/voteReview";

// ---------------------------------------------------------------------------
// B4 — Establishments (venue schema, Algolia indexing, claiming, geo queries)
// ---------------------------------------------------------------------------

// Algolia search indexing trigger (re-exported from B9 trigger; registered here for B4)
export { onEstablishmentWrite }          from "./establishments/search";

// Claiming workflow
export { submitClaimRequest }            from "./establishments/claiming";
export { reviewClaimRequest }            from "./establishments/claiming";
export { addEstablishment }              from "./establishments/claiming";

// Geo queries
export { getNearbyEstablishments }       from "./establishments/geo";
export { getEstablishmentById }          from "./establishments/geo";

// ---------------------------------------------------------------------------
// B5 — Points Ledger, Badges & Challenges
// ---------------------------------------------------------------------------

export { getPointsWallet }  from "./http/getPointsWallet";
export { getLedgerHistory } from "./http/getLedgerHistory";
export { getChallenges }    from "./http/getChallenges";
export { expirePoints }     from "./scheduled/expirePoints";
export { recomputeTiers }   from "./scheduled/recomputeTiers";

// ---------------------------------------------------------------------------
// B6 — Points Engine (Earn / Spend / Expiry / Multipliers / Eligibility)
// ---------------------------------------------------------------------------

export { getWallet, redeemPoints } from "./domains/points/index";
export { runPointsExpiry }         from "./domains/points/expiry";

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
// B7 — Badges & Challenges
// ---------------------------------------------------------------------------

// Callables
export { getBadges }                from "./badges/getBadges";
// getChallenges already exported under B5 above (http/getChallenges.ts)

// Scheduled cron — daily 04:00 UTC; deactivates expired challenges + awards badge rewards
export { badges_challengesCron }    from "./badges/challengeCron";

// ---------------------------------------------------------------------------
// B8 — Reservations (canonical module — supersedes B7 http/ stubs for new clients)
//
// The new callables live in reservations/ and are exported with a namespaced
// prefix to avoid collisions with the B7 http/ stubs (kept for backward compat).
// ---------------------------------------------------------------------------

export {
  createReservation  as reservations_createReservation,
  cancelReservation  as reservations_cancelReservation,
  getMyReservations  as reservations_getMyReservations,
}                    from "./reservations/booking";

export {
  checkInByQR        as reservations_checkInByQR,
  checkInByOTP       as reservations_checkInByOTP,
}                    from "./reservations/checkin";

export { refreshOTP  as reservations_refreshOTP }   from "./reservations/verification";
export { markNoShows as reservations_markNoShows }  from "./reservations/noshow";

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
// B9 — Deals (matching engine, redemption flow, anti-abuse, expiry)
// ---------------------------------------------------------------------------

export { getDealsForUser, getDealsByEstablishment } from "./domains/deals/index";
export {
  initiateDealRedemption,
  confirmDealRedemption,
  expireUnredeemedDeals,
} from "./domains/deals/index";

// ---------------------------------------------------------------------------
// B9 — Search & Discovery
// ---------------------------------------------------------------------------

export { searchVenues }             from "./http/searchVenues";
export { searchUsers }              from "./http/searchUsers";
export { searchContent }            from "./http/searchContent";
export { getDiscoverFeed }          from "./http/getDiscoverFeed";
export { getHomeFeed }              from "./http/getHomeFeed";
export { getEstablishmentDetail }   from "./http/getEstablishmentDetail";
// onEstablishmentWrite exported under B4 — Establishments above
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
// B10 — Social (follow graph, feed ranking, notification fanout, messaging gates)
// ---------------------------------------------------------------------------

// Follow graph
export {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
}                                           from "./social/follow";

// Feed ranking
export { getFeed }                          from "./social/feed";

// Notification callables (canonical — wraps lib/notify)
export {
  getNotifications  as social_getNotifications,
  markAllRead       as social_markAllRead,
}                                           from "./social/notifications";

// Messaging gates (B10 canonical callables — supersede B8 http/ stubs)
export {
  canSendMessageCallable as canSendMessage,
  getConversationsSocial as social_getConversations,
  sendMessageSocial      as social_sendMessage,
}                                           from "./social/messaging";

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
// B12 — Admin Domain (account states, moderation queue, founder badge, content)
// ---------------------------------------------------------------------------

// Account state management (suspend / ban / unsuspend / sandbox)
export {
  admin_suspendUser,
  admin_banUser      as admin_banUserV2,
  admin_unsuspendUser,
  admin_sandboxUser,
  liftExpiredSuspensions,
}                                  from "./admin/accountStates";

// Moderation queue domain API
export {
  getModerationQueueAdmin,
  moderateItem,
  flagReviewForModeration,
}                                  from "./admin/moderationQueue";

// Founder badge admin endpoints
export {
  adminAwardFounderBadge,
  getFounderBadgeStatus,
}                                  from "./admin/founderBadge";

// Content admin actions
export {
  adminDeleteReview,
  adminEditEstablishment,
  adminVerifyEstablishment          as adminVerifyEstablishmentV2,
}                                  from "./admin/contentAdmin";

// ---------------------------------------------------------------------------
// B13 — Referral System
// ---------------------------------------------------------------------------

// Canonical B13 callables (domains/referrals/)
export { getReferralCode }              from "./domains/referrals/codes";
export { getReferralStats }             from "./domains/referrals/stats";

// Legacy http/ stubs kept for backward compatibility
export { getMyReferralCode }            from "./http/getMyReferralCode";
export { applyReferralCode }            from "./http/applyReferralCode";
export { validateReferralCodePublic }   from "./http/validateReferralCodePublic";
export { adminGetReferralStats }        from "./http/adminGetReferralStats";
export { expireStaleReferrals }         from "./scheduled/expireStaleReferrals";

// ---------------------------------------------------------------------------
// B14 — Loyalty Tiers Engine
// ---------------------------------------------------------------------------

export { getTierStatus }                  from "./http/getTierStatus";
export { getTierPerks }                   from "./http/getTierPerks";
export { adminAdjustTier }                from "./http/adminAdjustTier";
export { getBirthdayBonus }               from "./http/getBirthdayBonus";
export { getAnniversaryBonus }            from "./http/getAnniversaryBonus";
export { processPlusExpirations }         from "./scheduled/processPlusExpirations";
export { runQuarterlyTierEvaluation }     from "./scheduled/runQuarterlyTierEvaluation";

// ---------------------------------------------------------------------------
// I4 — OCR Vendor Harness, Production Receipt Extraction & Verification
// ---------------------------------------------------------------------------

export { runOCRHarnessCallable as runOCRHarness }  from "./http/runOCRHarness";
export { extractReceiptData }                       from "./http/extractReceiptData";
export { verifyReceiptForReview }                   from "./integrations/ocr/verifyReceipt";

// ---------------------------------------------------------------------------
// I5 — Algolia Multi-Index Search
// ---------------------------------------------------------------------------

export { adminReindexAlgolia } from "./http/adminReindexAlgolia";

// ---------------------------------------------------------------------------
// B11 — Plus & IAP Validation
// Subscription state checks, entitlement queries, Plus benefit gating.
// revenueCatWebhook is the HTTP POST endpoint handled under I7 below.
// ---------------------------------------------------------------------------

export { getPlusStatus }     from "./plus/entitlements";
export { getPlusGateStatus } from "./plus/gates";

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
// I7 — Gift Cards (giftcards integration layer)
// redeemGiftCard:      callable — spend points and deliver a gift card via Tremendous
// listGiftCardCatalog: callable — returns available gift card products from Tremendous
// ---------------------------------------------------------------------------

export { redeemGiftCard, listGiftCardCatalog } from "./integrations/giftcards/redeem";

// ---------------------------------------------------------------------------
// I2 — Storage & Media (image moderation trigger)
// ---------------------------------------------------------------------------

export { onPhotoUploaded } from "./media/photoTrigger";

// ---------------------------------------------------------------------------
// I8 — Push Notifications (FCM)
// updateFcmToken: callable — validates + upserts FCM token for the authed user.
// sendPushNotification / sendBulkPushNotification are library helpers used by
// lib/notify.ts and domain code; they are NOT exported as Cloud Functions.
// ---------------------------------------------------------------------------

export { updateFcmToken } from "./integrations/push/tokenUpdate";

// ---------------------------------------------------------------------------
// D8 — Crashlytics Alerts
// ---------------------------------------------------------------------------

export {
  alerts_onNewFatalIssue,
  alerts_onNewAnrIssue,
  alerts_onVelocityAlert,
  alerts_onStabilityDigest,
} from "./alerts/crashlytics_alerts";

// ---------------------------------------------------------------------------
// I11 — Anti-Fraud (FingerprintJS Pro, reCAPTCHA Enterprise stub, App Check)
// ---------------------------------------------------------------------------

export { storeDeviceFingerprint } from "./integrations/antiFraud/fingerprint";

// ---------------------------------------------------------------------------
// Owner Portal
// ---------------------------------------------------------------------------

export { approveClaimRequest, rejectClaimRequest, inviteOwner } from './owner/claimOps';
export { respondToReview }  from './owner/reviewOps';
export { markReservation }  from './owner/reservationOps';
export { getOwnerAnalytics } from './owner/analytics';
export { broadcastAnnouncement } from './owner/announcements';
