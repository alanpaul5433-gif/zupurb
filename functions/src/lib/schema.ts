/**
 * schema.ts — Single source of truth for all Firestore document shapes.
 *
 * Conventions:
 *   - All timestamps: FirebaseFirestore.Timestamp (never Date)
 *   - All monetary values: integer cents
 *   - All point values: integer
 *   - Score values: integer × 100  (e.g., 4.23 → 423)
 *   - RC: comments indicate the Remote Config key controlling that value
 */

import { Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Shared enums & literals
// ---------------------------------------------------------------------------

export type VerificationTier = "unverified" | "partially_verified" | "verified";
export type ReviewStatus = "draft" | "pending" | "published" | "quarantined" | "removed";
export type ReservationStatus = "confirmed" | "checked_in" | "completed" | "no_show" | "cancelled";
export type LedgerEntryType =
  | "earn_review_unverified"
  | "earn_review_partial"
  | "earn_review_verified"
  | "earn_upvote_received"
  | "earn_badge_unlock"
  | "earn_challenge_complete"
  | "earn_referral_bonus"
  | "earn_referral_welcome"
  | "earn_birthday_bonus"
  | "earn_anniversary_bonus"
  | "earn_admin_grant"
  | "earn_onboarding_bonus"    // B6: onboarding completion bonus
  | "earn_deal_cashback"       // B6: cashback from deal redemption (future)
  | "spend_deal_redemption"
  | "spend_gift_card"
  | "spend_noshow_penalty"    // B7: no-show deduction
  | "earn_reservation_create" // B7: 50 pts for making a reservation
  | "earn_checkin"            // B7: check-in points (tier-multiplied)
  | "earn_tier_upgrade_bonus" // B14: bonus awarded on tier upgrade
  | "expire";

// B6: Deal redemption lifecycle status
export type DealRedemptionStatus = "pending" | "fulfilled" | "failed" | "refunded";

// B6: Deal tier visibility — Platinum-exclusive deals
export type DealTier = "standard" | "platinum";
export type FraudFlagReason =
  | "velocity_exceeded"
  | "structural_anomaly"
  | "q8_contradiction"
  | "coordinated_attack"
  | "device_cluster"
  | "admin_flag"
  | "review_burst"       // B3: 3+ reviews within burst window
  | "self_review"        // B3: reviewer is venue owner
  | "duplicate_review"   // B3: SHA-256 hash matches prior review
  | "shared_device";     // B3: device fingerprint shared with flagged account
export type BadgeCategory =
  | "reviewer"
  | "explorer"
  | "social"
  | "reservation"
  | "deal"
  | "special";
export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";
/** Alias for LoyaltyTier — used by the B14 tier engine. */
export type TierName = LoyaltyTier;
export type EstablishmentCategory =
  | "restaurant"
  | "bar"
  | "nightclub"
  | "coffee"
  | "hotel"
  | "experience"
  | "other";
export type DisclosureCategory = "none" | "complimentary" | "media" | "employee" | "owner";

// ---------------------------------------------------------------------------
// COLLECTION: users/{userId}
// ---------------------------------------------------------------------------

export const USERS_COLLECTION = "users";

export interface UserDoc {
  uid: string;
  displayName: string;
  photoUrl: string | null;

  // Demographic fingerprint — used for "From People Like You" cosine similarity.
  // Stored as a named vector object, not an array, so fields can be added forward-compatibly.
  // RC: fingerprint.similarityThreshold (default 0.75)
  fingerprint: DemographicFingerprint;

  // Loyalty tier (computed from rolling 12-month points, never set by client)
  loyaltyTier: LoyaltyTier;
  tierUpdatedAt: Timestamp;
  tierHiddenByUser: boolean; // privacy toggle; default false

  // Points (projected cache — source of truth is pointsLedger)
  pointsBalance: number;             // integer; RC: not applicable
  rollingPoints12mo: number;         // sum of earn entries in past 12 months; drives tier calc

  // Profile metadata
  bio: string | null;
  followersCount: number;
  followingCount: number;
  reviewCount: number;
  verifiedReviewCount: number;

  // Onboarding & phone
  onboardingComplete: boolean;
  phoneVerified: boolean;

  // Referral
  referralCode: string | null;              // the code this user used when signing up (applied to them)
  myReferralCode: string | null;            // this user's own shareable referral code (generated at onboarding)
  referredBy: string | null;               // uid of the user who referred this user
  referralRewardClaimed: boolean;          // true once first-verified-review reward has been awarded

  // Reservation behaviour tracking (B7)
  noShowCount: number;             // lifetime no-show counter; default 0
  reservationsBanned: boolean;     // RC: noshow_ban_threshold (3)

  // Plus subscription state (sourced from RevenueCat webhook, not client)
  isPlusSubscriber: boolean;
  plusExpiresAt: Timestamp | null;

  // B14: Zupurb Plus managed state (replaces/supplements isPlusSubscriber for tier-driven Plus)
  plusActive: boolean;
  plusActivatedAt: Timestamp | null;
  plusActiveUntil: Timestamp | null;
  plusSource: "iap" | "platinum_tier" | null;

  // B14: Tier override — admin can manually set tier (e.g., for customer support)
  tierOverride: boolean;
  tierOverrideReason: string | null;
  tierOverrideExpiresAt: Timestamp | null;

  // B10: FCM push token management
  // RC: max_fcm_tokens_per_user (default 5)
  fcmTokens: string[];                                          // flat array for FCM multicast
  fcmTokenDetails: Record<string, FCMTokenDetail>;              // token → detail map

  // B10: User notification preferences — false = suppress FCM push for that type
  // Firestore inbox entry is always written regardless; only push is suppressed.
  notificationPreferences: Partial<Record<NotificationType, boolean>>;

  // B10: Unread notification counter — incremented by onNotificationWrite trigger
  unreadNotificationCount: number;

  // B12: Ban state — set by adminBanUser callable; never set by client
  isBanned: boolean;
  bannedAt: Timestamp | null;
  banReason: string | null;
  banExpiresAt: Timestamp | null;  // null = permanent ban

  // B12: Account classification
  accountType: "user" | "business" | "entertainer";

  // B12: Social graph lists (denormalized; capped — use subcollection at scale)
  following: string[];           // uids this user follows
  followers: string[];           // uids following this user
  // Note: followingCount and followersCount already exist above (pre-B12 fields)

  // B12: Last active signal — updated on any authenticated callable
  lastActiveAt: Timestamp | null;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Schema version — increment when shape changes to allow migration guards
  schemaVersion: number;
}

// ---------------------------------------------------------------------------
// B14: Tier history — sub-collection users/{uid}/tierHistory/{eventId}
// ---------------------------------------------------------------------------

export const TIER_HISTORY_SUBCOLLECTION = "tierHistory";

export interface TierHistoryEvent {
  eventId: string;
  previousTier: TierName;
  newTier: TierName;
  transitionedAt: Timestamp;
  rolling12MonthPts: number;
  bonusAwarded?: number;    // upgrade bonus points, if any
}

export interface DemographicFingerprint {
  // Dimensions used for cosine similarity.
  // All are normalised floats [0.0, 1.0] unless specified.
  // Integer-encoded categorical values are mapped to continuous dimensions server-side.
  ageGroup: number;              // 0=18-24, 0.25=25-34, 0.5=35-44, 0.75=45-54, 1=55+
  genderIdentity: number;        // encoded ordinal
  cuisinePreferences: number[];  // multi-hot vector over cuisine taxonomy (length = taxonomy size)
  activityPreferences: number[]; // multi-hot vector over activity taxonomy
  dietaryRestrictions: number[]; // multi-hot vector
  spendingHabit: number;         // 0=budget → 1=luxury
  // future dimensions go here; existing snapshots stay frozen at their creation-time shape
}

// ---------------------------------------------------------------------------
// SUB-COLLECTION: users/{userId}/fingerprintSnapshots/{snapshotId}
// Frozen at each review submission. Admin-only read. Never returned to client.
// ---------------------------------------------------------------------------

export const FINGERPRINT_SNAPSHOTS_SUBCOLLECTION = "fingerprintSnapshots";

export interface FingerprintSnapshotDoc {
  snapshotId: string;
  userId: string;
  reviewId: string;            // the review this snapshot was frozen for
  fingerprint: DemographicFingerprint;
  capturedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// SUB-COLLECTION: users/{userId}/referrals/{referralId}
// Outbound referrals where this user is the referrer.
// ---------------------------------------------------------------------------

export const USER_REFERRALS_SUBCOLLECTION = "referrals";

export interface UserReferralDoc {
  referralId: string;
  referrerUid: string;
  refereeUid: string;
  referralCode: string;
  status: "pending" | "completed" | "rejected";
  completedAt: Timestamp | null; // set when referee posts first verified review
  pointsAwardedToReferrer: number; // RC: referrals.pointsReferrer (default 500)
  pointsAwardedToReferee: number;  // RC: referrals.pointsReferee  (default 250)
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// COLLECTION: private_user_data/{userId}
// Admin-only reads. Cloud Functions write via Admin SDK. No client access.
// ---------------------------------------------------------------------------

export const PRIVATE_USER_DATA_COLLECTION = "private_user_data";

export interface PrivateUserDataDoc {
  uid: string;

  // User Authenticity Rating (UAR). Default 0.5 on creation.
  // RC: uar.default (0.5), uar.sandboxThreshold (0.3)
  uar: number;                         // [0.0, 1.0]; never sent to client
  uarUpdatedAt: Timestamp;
  uarHistory: UarHistoryEntry[];        // last 50 events kept

  // Device fingerprints collected from FingerprintJS Pro
  deviceFingerprints: string[];         // array of visitorId hashes; max 20 stored

  // Fraud flags
  fraudFlags: FraudFlag[];
  isSandboxed: boolean;                 // true if UAR < uar.sandboxThreshold
  sandboxedAt: Timestamp | null;
  isQuarantined: boolean;               // soft quarantine: writes succeed but are hidden
  isBanned: boolean;
  bannedAt: Timestamp | null;
  banReason: string | null;

  // Weekly review counter (rolling 7-day window for rate limiting)
  // RC: fraud.weeklyReviewCap (default 7)
  reviewsThisWeek: number;
  weeklyCapWindowStart: Timestamp;

  // Behavior signals written by fraud checks / admin actions
  behaviorSignals: BehaviorSignals;

  // Timestamp of last full UAR recompute (used by daily stale-UAR cron)
  lastUARComputedAt: Timestamp | null;

  // Internal notes from admin
  internalNotes: string;

  schemaVersion: number;
}

export interface BehaviorSignals {
  confirmedReportCount: number;   // count of confirmed (resolved) fraud reports against this user
  vpnFlagged: boolean;            // set by device fingerprint / IP analysis
  accountAgeAtFirstReview: number | null; // days between account creation and first review
  reviewCountAtDay7: number | null;       // review count at day 7 post-signup (mismatch signal)
}

export interface UarHistoryEntry {
  eventType: string;          // e.g., "verified_review_published", "flag_received"
  delta: number;              // e.g., +0.10 or -0.05
  uarAfter: number;
  occurredAt: Timestamp;
}

export interface FraudFlag {
  flagId: string;
  reason: FraudFlagReason;
  reviewId: string | null;    // if flag is tied to a specific review
  detectedAt: Timestamp;
  resolvedAt: Timestamp | null;
  resolvedBy: string | null;  // admin uid
}

// ---------------------------------------------------------------------------
// COLLECTION: establishments/{estId}
// ---------------------------------------------------------------------------

export const ESTABLISHMENTS_COLLECTION = "establishments";

export interface EstablishmentDoc {
  estId: string;
  name: string;
  description: string | null;
  categories: EstablishmentCategory[];  // array for array-contains queries
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  geohash: string;            // for geo queries
  lat: number;
  lng: number;

  // Computed scores — recomputed by Cloud Function on every review write.
  // Stored as integer × 100. E.g., 4.23 → 423.
  overallScore: number;       // weighted rolling average × 100
  overallScoreUpdatedAt: Timestamp;
  reviewCount: number;        // total published reviews
  verifiedReviewCount: number;

  // Claiming
  claimedByUid: string | null;  // business owner uid
  claimedAt: Timestamp | null;
  isVerifiedBusiness: boolean;

  // B12: Verification by admin
  isVerified: boolean;           // admin-set; signals trust badge in search results
  verifiedAt: Timestamp | null;
  verificationNotes: string | null;
  verifiedBy: string | null;     // admin uid who performed verification

  // B12: Owner management (multiple owners supported)
  ownerUids: string[];           // uids with businessOwner claim for this establishment

  // B12: Report signal
  reportCount: number;           // incremented by reportContent callable

  // Media
  coverPhotoUrl: string | null;
  photoUrls: string[];

  // Availability
  isActive: boolean;            // false = soft-deleted / not visible
  isOpenForReservations: boolean;

  // Contact
  websiteUrl: string | null;
  phoneNumber: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
}

// SUB-COLLECTION: establishments/{estId}/reviews/{reviewId}
// Denormalized copy of review for fast venue-page queries.
// Written by Cloud Function at same time as top-level review.
export const EST_REVIEWS_SUBCOLLECTION = "reviews";

// SUB-COLLECTION: establishments/{estId}/reservationSlots/{slotId}
export const RESERVATION_SLOTS_SUBCOLLECTION = "reservationSlots";

export interface ReservationSlotDoc {
  slotId: string;
  estId: string;
  dayOfWeek: number;          // 0=Sunday … 6=Saturday
  startTime: string;          // "HH:MM" 24h
  endTime: string;
  maxCovers: number;
  isActive: boolean;
}

// SUB-COLLECTION: establishments/{estId}/deals/{dealId}
// Also duplicated to top-level deals/{dealId} for global indexing.
export const EST_DEALS_SUBCOLLECTION = "deals";

// ---------------------------------------------------------------------------
// COLLECTION: reviews/{reviewId}  (flat — cross-venue queries)
// ---------------------------------------------------------------------------

export const REVIEWS_COLLECTION = "reviews";

export interface ReviewDoc {
  reviewId: string;
  authorUid: string;
  estId: string;

  // Q1–Q7: scored answers.  Q8: visit claim (used for contradiction check only).
  // Each element is "A" | "B" | "C" | "D".
  answers: string[];          // length exactly 8; index 7 = Q8

  // Score fields (computed server-side; never accepted from client)
  rawScore: number;           // integer × 100; e.g., 3.75 → 375
  weightFactor: number;       // 100 | 75 | 50  (maps to 1.0 | 0.75 | 0.5)
  uarAtSubmission: number;    // snapshot of author's UAR at submission time

  verificationTier: VerificationTier;
  verifiedAt: Timestamp | null;   // set by OCR / photo validation Cloud Function

  // Fingerprint snapshot ID — links to users/{authorUid}/fingerprintSnapshots/{id}
  // Used for "From People Like You" cosine similarity.
  fingerprintSnapshotId: string;

  disclosureCategory: DisclosureCategory;

  // Written review
  title: string | null;
  body: string | null;

  // AI-generated summary (populated async)
  aiSummary: string | null;
  aiSummaryGeneratedAt: Timestamp | null;

  // Media
  mediaIds: string[];         // Storage object IDs

  // Social
  upvoteCount: number;
  downvoteCount: number;
  helpfulScore: number;       // integer × 100; composite of upvotes / total votes

  // Status & moderation
  status: ReviewStatus;
  flagCount: number;
  isFeatured: boolean;        // admin-set for editorial spotlight

  // B12: Moderation workflow
  isModerated: boolean;       // true = hidden pending human review
  moderationStatus: "pending" | "approved" | "flagged" | "removed";
  removedAt: Timestamp | null;
  removedBy: string | null;   // admin uid
  removedReason: string | null;
  reportCount: number;        // incremented by reportContent callable

  // Fraud detection result fields (set by async fraud checks)
  isAnomalous: boolean;       // all-A or all-D structural anomaly
  hasQ8Contradiction: boolean;
  isCoordinatedAttack: boolean;

  createdAt: Timestamp;        // alias for submittedAt for query clarity
  submittedAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
}

// SUB-COLLECTION: reviews/{reviewId}/votes/{voterUid}
export const REVIEW_VOTES_SUBCOLLECTION = "votes";

export interface ReviewVoteDoc {
  voterUid: string;
  vote: "up" | "down";
  votedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// COLLECTION: pointsLedger/{entryId}  (append-only; never update or delete)
// ---------------------------------------------------------------------------

export const POINTS_LEDGER_COLLECTION = "pointsLedger";

export interface PointsLedgerEntry {
  entryId: string;
  userId: string;
  delta: number;              // positive = earn, negative = spend/expire; non-zero integer
  type: LedgerEntryType;
  sourceId: string | null;    // reviewId, reservationId, dealId, etc.
  sourceType: string | null;  // "review" | "reservation" | "deal" | "badge" | etc.
  description: string;        // human-readable reason (for wallet display)

  balanceAfter: number;       // projected balance after this entry (integer)

  // Expiry — earn entries expire; spend entries do not.
  // RC: points.expiryMonths (default 12)
  expiresAt: Timestamp | null;  // null for spend/expire entries
  isExpired: boolean;

  // Multiplier applied (e.g., 1.25 for Plus subscribers)
  // RC: points.multiplier.plus (1.25), points.multiplier.default (1.0)
  multiplierApplied: number;  // integer × 100 stored; e.g., 125 = 1.25×

  createdAt: Timestamp;
  schemaVersion: number;
}

// COLLECTION: userBalances/{userId}
// Projected current balance — derived from ledger, cached for fast reads.
export const USER_BALANCES_COLLECTION = "userBalances";

export interface UserBalanceDoc {
  userId: string;
  balance: number;            // current spendable balance (integer)
  lifetimeEarned: number;     // total ever earned (integer)
  lifetimeSpent: number;      // total ever spent (integer)
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// COLLECTION: badges/{badgeId}  (global definitions)
// ---------------------------------------------------------------------------

export const BADGES_COLLECTION = "badges";

export interface BadgeDefinitionDoc {
  badgeId: string;
  name: string;
  description: string;
  iconUrl: string;
  category: BadgeCategory;
  isFounderBadge: boolean;        // true → only admin can award; max 150 recipients
  founderCapRemaining: number;    // decremented by admin; RC: badges.founderCap (150)
  pointsOnUnlock: number;         // bonus points awarded when badge is earned; integer
  requiresAdminApproval: boolean;
  isActive: boolean;
  sortOrder: number;
  schemaVersion: number;
}

// COLLECTION: userBadges/{userId}/badges/{badgeId}
export const USER_BADGES_COLLECTION = "userBadges";
export const USER_BADGES_SUBCOLLECTION = "badges";

export interface UserBadgeDoc {
  badgeId: string;
  userId: string;
  earnedAt: Timestamp;
  awardedBy: string | null;    // admin uid for founder badge; null for automatic
}

// ---------------------------------------------------------------------------
// COLLECTION: challenges/{challengeId}  (global definitions)
// ---------------------------------------------------------------------------

export const CHALLENGES_COLLECTION = "challenges";

export interface ChallengeDefinitionDoc {
  challengeId: string;
  title: string;
  description: string;
  iconUrl: string;
  pointsReward: number;         // integer
  badgeReward: string | null;   // badgeId if challenge unlocks a badge
  isActive: boolean;
  isTierExclusive: boolean;     // true = only Gold/Platinum can see
  eligibleTiers: LoyaltyTier[]; // which tiers can participate
  startAt: Timestamp;
  endAt: Timestamp;
  targetCount: number;          // e.g., "submit 5 reviews" → 5
  targetType: string;           // "reviews" | "reservations" | "deals" | etc.
  schemaVersion: number;
}

// COLLECTION: userChallengeProgress/{userId}_{challengeId}
export const USER_CHALLENGE_PROGRESS_COLLECTION = "userChallengeProgress";

export interface UserChallengeProgressDoc {
  compositeId: string;           // "{userId}_{challengeId}"
  userId: string;
  challengeId: string;
  progress: number;              // current count toward targetCount
  isComplete: boolean;
  completedAt: Timestamp | null;
  pointsAwarded: boolean;        // guard: prevent double-award
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// COLLECTION: reservations/{reservationId}
// ---------------------------------------------------------------------------

export const RESERVATIONS_COLLECTION = "reservations";

export interface ReservationDoc {
  reservationId: string;
  guestUid: string;
  estId: string;
  estName: string;               // denormalized for display without join
  guestDisplayName: string;      // denormalized
  guestPhotoUrl: string | null;  // denormalized

  partySize: number;
  scheduledAt: Timestamp;        // the booked date+time
  slotId: string;                // which slot was booked
  notes: string | null;          // special requests

  status: ReservationStatus;     // client can only create with "confirmed"
  checkedInAt: Timestamp | null;
  completedAt: Timestamp | null;
  cancelledAt: Timestamp | null;

  // Cancellation policy: client can only cancel if scheduledAt > now + 48h
  // RC: reservations.cancellationCutoffHours (48)
  cancellationDeadlineAt: Timestamp; // = scheduledAt - 48h; set by Cloud Function

  // QR / OTP for check-in (set by Cloud Function at booking time)
  checkInQrCode: string | null;   // base64 payload (signed stub; real HMAC in B9)
  /** @deprecated use checkInOtpHash */
  checkInOtp?: string | null;     // legacy field — may still exist in prod documents; do not write
  checkInOtpHash: string | null;  // SHA-256 hash of 4-digit OTP; plaintext never stored
  otpExpiresAt: Timestamp | null; // scheduledAt + 15 min  // RC: otp_validity_minutes
  otpAttempts: number;            // failed OTP attempts counter; RC: otp_max_attempts (5)

  // Idempotency key (client-supplied UUID; prevents double-booking on retry)
  idempotencyKey: string;

  // Cancellation metadata
  cancelledBy: "guest" | "admin" | null;
  cancellationReason: string | null;

  // Check-in metadata
  checkInMethod: "qr" | "otp" | null;

  // Reminder flags (set by scheduled job to avoid duplicate sends)
  reminder24hSent: boolean;
  reminder2hSent: boolean;

  // No-show tracking
  noShowAt: Timestamp | null;
  noShowRecordedAt: Timestamp | null;
  noShowPenaltyApplied: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
}

// ---------------------------------------------------------------------------
// COLLECTION: conversations/{conversationId}  (in-house Firestore chat)
// ---------------------------------------------------------------------------

export const CONVERSATIONS_COLLECTION = "conversations";

// Conversation type encodes which party initiated and the account types involved.
export type ConversationType =
  | "user_user"
  | "user_business"
  | "business_user"
  | "entertainer_user";

export interface ConversationDoc {
  conversationId: string;
  participantUids: string[];           // exactly 2; sorted lexicographically for dedup
  participantInfo: Record<string, ParticipantInfo>; // uid → display snapshot
  conversationType: ConversationType;

  lastMessageText: string | null;      // preview (first 100 chars of last message)
  lastMessageAt: Timestamp | null;
  lastMessageSenderUid: string | null;
  unreadCounts: Record<string, number>; // uid → unread count

  // Business 1-msg gate (B8)
  // Count of messages sent by the business before any user reply.
  // RC: messaging.businessIntroLimit (1)
  businessInitiatedMessageCount: number;
  // Set to the non-business participant's uid once they reply.
  lastRepliedByUid: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ParticipantInfo {
  displayName: string;
  photoUrl: string | null;
}

// SUB-COLLECTION: conversations/{conversationId}/messages/{messageId}
export const MESSAGES_SUBCOLLECTION = "messages";

export interface MessageDoc {
  messageId: string;
  conversationId: string;
  senderUid: string;

  text: string;                        // renamed from body; max 2000 chars
  mediaUrls: string[];                 // supports multiple attachments

  isRead: boolean;
  readAt: Timestamp | null;
  sentAt: Timestamp;

  // Idempotency — client-supplied UUID; duplicate sends with same key are ignored
  idempotencyKey: string;

  // Content moderation (stub until I9)
  isModerated: boolean;
  moderationResult: { flagged: boolean; reason?: string } | null;

  // Soft delete — messages are NEVER hard-deleted (audit trail)
  isDeleted: boolean;
  deletedAt: Timestamp | null;
  deletedBy: string | null;            // uid of deleter (sender or admin)
}

// ---------------------------------------------------------------------------
// COLLECTION: notifications/{userId}/items/{notifId}
// ---------------------------------------------------------------------------

export const NOTIFICATIONS_COLLECTION = "notifications";
export const NOTIFICATIONS_ITEMS_SUBCOLLECTION = "items";

// B10: Canonical notification type union used by sendNotification utility.
export type NotificationType =
  | "new_message"
  | "new_follower"
  | "review_helpful_vote"
  | "points_earned"
  | "points_expiring_soon"
  | "points_expiring_urgent"
  | "badge_unlocked"
  | "challenge_complete"
  | "tier_upgrade"
  | "tier_downgrade"
  | "reservation_confirmed"
  | "reservation_reminder_24h"
  | "reservation_reminder_2h"
  | "reservation_cancelled"
  | "reservation_no_show"
  | "deal_ready"
  | "deal_expiring"
  | "review_flagged"
  | "admin_alert"
  | "system";

// B10: Per-device FCM token detail stored on users/{uid}.fcmTokenDetails
export interface FCMTokenDetail {
  token: string;
  platform: "ios" | "android";
  registeredAt: Timestamp;
}

export interface NotificationDoc {
  notifId: string;
  userId: string;
  type: string;                 // "review_upvote" | "badge_unlock" | "tier_change" | etc.
  title: string;
  body: string;
  deepLinkPath: string | null;  // in-app route
  imageUrl: string | null;

  // Payload — type-specific data for action routing
  payload: Record<string, string | number | boolean | null>;

  isRead: boolean;
  readAt: Timestamp | null;
  createdAt: Timestamp;

  // B10: soft delete support
  isDeleted?: boolean;
  deletedAt?: Timestamp;

  // B10: extra fields written by sendNotification
  relatedEntityId?: string;
  relatedEntityType?: string;
  data?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// COLLECTION: deals/{dealId}  (global index; also sub-collection on establishment)
// ---------------------------------------------------------------------------

export const DEALS_COLLECTION = "deals";

export interface DealDoc {
  dealId: string;
  estId: string;
  estName: string;               // denormalized
  estCity: string;               // denormalized for city filter
  geohash: string;               // for geo proximity queries

  title: string;
  description: string;
  category: string;              // "dessert" | "appetizer" | "drink" | "entree" | "experience"
  pointCost: number;             // integer; RC: points.cost.deal.{category}
  originalValueCents: number;    // face value in cents (integer)

  coverImageUrl: string | null;

  isActive: boolean;
  startsAt: Timestamp;
  expiresAt: Timestamp;

  // Caps
  totalRedemptionCap: number | null;   // null = unlimited
  redemptionsCount: number;            // incremented on each redemption
  remainingRedemptions: number | null; // null = unlimited; decremented atomically on redeem
  perUserMonthlyCapFreeUser: number;   // RC: deals.perUserMonthlyCapFree (3)
  perUserMonthlyCapPlus: number;       // RC: deals.perUserMonthlyCapPlus (5)
  maxRedemptionsPerUser: number;       // per-deal per-user limit; RC: deal_default_max_per_user (1)

  // B6: Tier visibility — Platinum-only deals
  dealTier: DealTier;                  // "standard" | "platinum"

  // B6: Deactivation audit trail (set by deactivateDeal admin callable)
  deactivatedAt: Timestamp | null;
  deactivatedReason: string | null;

  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
}

// COLLECTION: dealRedemptions/{redemptionId}  (append-only log)
export const DEAL_REDEMPTIONS_COLLECTION = "dealRedemptions";

export interface DealRedemptionDoc {
  redemptionId: string;
  dealId: string;
  estId: string;
  userId: string;
  pointsSpent: number;         // integer; negative delta in ledger
  redeemedAt: Timestamp;

  // B6: Idempotency key (client-supplied UUID; prevents double-charge on retry)
  idempotencyKey: string;

  // B6: Redemption lifecycle status
  status: DealRedemptionStatus; // RC: not applicable — lifecycle state machine

  // QR code shown to staff at venue; expires after 2 hours
  // RC: deals.qrTtlMinutes (120)
  redemptionQrCode: string | null;   // null for gift card deals; set for venue deals
  qrExpiresAt: Timestamp | null;
  isQrUsed: boolean;
  qrUsedAt: Timestamp | null;

  // B6: Gift card delivery — only set for category = gift_card
  tremendousOrderId: string | null;  // set by Cloud Tasks job after Tremendous API call
  estimatedDeliveryAt: Timestamp | null;

  // B6: Notification and analytics
  dealTitle: string;           // denormalized for wallet display
  dealCategory: string;        // denormalized for analytics
  createdAt: Timestamp;
  schemaVersion: number;
}

// ---------------------------------------------------------------------------
// COLLECTION: referralCodes/{code}  (reverse lookup: code → userId)
// ---------------------------------------------------------------------------

export const REFERRAL_CODES_COLLECTION = "referralCodes";

// ---------------------------------------------------------------------------
// B13: Referee entry — stored inside ReferralCodeDoc.referees array
// ---------------------------------------------------------------------------

export interface RefereeEntry {
  uid: string;
  appliedAt: Timestamp;
  rewardStatus: "pending" | "awarded" | "expired";
  rewardedAt?: Timestamp;
}

export interface ReferralCodeDoc {
  code: string;                // unique; URL-safe base58
  ownerUid: string;
  createdAt: Timestamp;
  isActive: boolean;           // false = code deactivated (admin or expiry)
  totalReferrals: number;      // how many users applied the code
  successfulReferrals: number; // how many completed the reward trigger
  referees: RefereeEntry[];    // array of referee entries
  // Rolling 30-day successful referral count
  // RC: referrals.rollingCapPer30Days (10)
  successfulReferralsLast30Days: number;
  rollingWindowStart: Timestamp;
}

// ---------------------------------------------------------------------------
// COLLECTION: posts/{postId}  (social photo posts)
// ---------------------------------------------------------------------------

export const POSTS_COLLECTION = "posts";

export interface PostDoc {
  postId: string;
  authorUid: string;
  authorDisplayName: string;   // denormalized
  authorPhotoUrl: string | null; // denormalized
  estId: string | null;        // optional location tag
  caption: string | null;
  mediaIds: string[];          // Storage object IDs
  likeCount: number;
  commentCount: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// COLLECTION: flags/{flagId}  (anti-fraud flags — admin queue)
// ---------------------------------------------------------------------------

export const FLAGS_COLLECTION = "flags";

export interface FlagDoc {
  flagId: string;
  reporterUid: string;
  targetType: "review" | "post" | "user" | "deal";
  targetId: string;
  reason: string;
  status: "open" | "reviewed" | "dismissed" | "actioned";
  reviewedBy: string | null;   // admin uid
  reviewedAt: Timestamp | null;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// COLLECTION: adminQueue/{queueItemId}  (moderation tasks)
// ---------------------------------------------------------------------------

export const ADMIN_QUEUE_COLLECTION = "adminQueue";

export interface AdminQueueItemDoc {
  queueItemId: string;
  type: "review_moderation" | "user_sanction" | "founder_badge_award" | "content_flag";
  priority: "p0" | "p1" | "p2";
  targetId: string;
  targetType: string;
  summary: string;
  assignedTo: string | null;   // admin uid
  status: "pending" | "in_progress" | "resolved" | "dismissed";
  resolvedAt: Timestamp | null;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// COLLECTION: establishmentScores/{estId}  (cached rolling scores)
// Recomputed by Cloud Function on every relevant review write.
// ---------------------------------------------------------------------------

export const ESTABLISHMENT_SCORES_COLLECTION = "establishmentScores";

export interface EstablishmentScoreDoc {
  estId: string;

  // Overall rolling score — weighted by UAR × weightFactor × timeDecay.
  // Stored as integer × 100.
  overallScore: number;
  overallScoreUpdatedAt: Timestamp;

  // Per-verification-tier breakdown (for display / debugging)
  verifiedScore: number;       // integer × 100; score using verified reviews only
  partialScore: number;        // integer × 100; score using partial reviews only

  reviewCount: number;
  verifiedReviewCount: number;

  // Score window stats
  score12moCount: number;      // reviews in past 12 months (full weight)
  score24moCount: number;      // reviews 12–24 months (0.7 weight)
  score36moCount: number;      // reviews 24–36 months (0.4 weight)
  scoreOlderCount: number;     // reviews >36 months (0.2 weight)

  updatedAt: Timestamp;
  schemaVersion: number;
}

// ---------------------------------------------------------------------------
// COLLECTION: reportedContent/{reportId}  (user-submitted content reports)
// ---------------------------------------------------------------------------

export const REPORTED_CONTENT_COLLECTION = "reportedContent";

export type ReportedContentType = "review" | "post" | "message" | "establishment" | "user";
export type ReportedContentReason = "spam" | "inappropriate" | "fake" | "harassment" | "other";
export type ReportedContentStatus = "pending" | "resolved";

export interface ReportedContentDoc {
  reportId: string;
  contentType: ReportedContentType;
  contentId: string;
  reason: ReportedContentReason;
  details: string | null;
  reporterUid: string;
  reportedAt: Timestamp;

  // Moderation resolution (set by resolveModerationItem)
  status: ReportedContentStatus;
  resolution: "no_action" | "content_removed" | "user_warned" | "user_banned" | null;
  resolvedAt: Timestamp | null;
  resolvedBy: string | null;   // admin uid
  resolutionNotes: string | null;

  schemaVersion: number;
}

// ---------------------------------------------------------------------------
// Collection path helpers — return typed Firestore path strings
// ---------------------------------------------------------------------------

export const Paths = {
  user: (uid: string) => `${USERS_COLLECTION}/${uid}`,
  privateUserData: (uid: string) => `${PRIVATE_USER_DATA_COLLECTION}/${uid}`,
  fingerprintSnapshot: (uid: string, snapshotId: string) =>
    `${USERS_COLLECTION}/${uid}/${FINGERPRINT_SNAPSHOTS_SUBCOLLECTION}/${snapshotId}`,
  userReferral: (uid: string, referralId: string) =>
    `${USERS_COLLECTION}/${uid}/${USER_REFERRALS_SUBCOLLECTION}/${referralId}`,
  establishment: (estId: string) => `${ESTABLISHMENTS_COLLECTION}/${estId}`,
  estReview: (estId: string, reviewId: string) =>
    `${ESTABLISHMENTS_COLLECTION}/${estId}/${EST_REVIEWS_SUBCOLLECTION}/${reviewId}`,
  review: (reviewId: string) => `${REVIEWS_COLLECTION}/${reviewId}`,
  reviewVote: (reviewId: string, voterUid: string) =>
    `${REVIEWS_COLLECTION}/${reviewId}/${REVIEW_VOTES_SUBCOLLECTION}/${voterUid}`,
  ledgerEntry: (entryId: string) => `${POINTS_LEDGER_COLLECTION}/${entryId}`,
  userBalance: (uid: string) => `${USER_BALANCES_COLLECTION}/${uid}`,
  badge: (badgeId: string) => `${BADGES_COLLECTION}/${badgeId}`,
  userBadge: (uid: string, badgeId: string) =>
    `${USER_BADGES_COLLECTION}/${uid}/${USER_BADGES_SUBCOLLECTION}/${badgeId}`,
  challenge: (challengeId: string) => `${CHALLENGES_COLLECTION}/${challengeId}`,
  userChallengeProgress: (uid: string, challengeId: string) =>
    `${USER_CHALLENGE_PROGRESS_COLLECTION}/${uid}_${challengeId}`,
  reservation: (reservationId: string) => `${RESERVATIONS_COLLECTION}/${reservationId}`,
  conversation: (conversationId: string) => `${CONVERSATIONS_COLLECTION}/${conversationId}`,
  message: (conversationId: string, messageId: string) =>
    `${CONVERSATIONS_COLLECTION}/${conversationId}/${MESSAGES_SUBCOLLECTION}/${messageId}`,
  notification: (uid: string, notifId: string) =>
    `${NOTIFICATIONS_COLLECTION}/${uid}/${NOTIFICATIONS_ITEMS_SUBCOLLECTION}/${notifId}`,
  deal: (dealId: string) => `${DEALS_COLLECTION}/${dealId}`,
  estDeal: (estId: string, dealId: string) =>
    `${ESTABLISHMENTS_COLLECTION}/${estId}/${EST_DEALS_SUBCOLLECTION}/${dealId}`,
  dealRedemption: (redemptionId: string) => `${DEAL_REDEMPTIONS_COLLECTION}/${redemptionId}`,
  referralCode: (code: string) => `${REFERRAL_CODES_COLLECTION}/${code}`,
  post: (postId: string) => `${POSTS_COLLECTION}/${postId}`,
  flag: (flagId: string) => `${FLAGS_COLLECTION}/${flagId}`,
  adminQueueItem: (itemId: string) => `${ADMIN_QUEUE_COLLECTION}/${itemId}`,
  establishmentScore: (estId: string) => `${ESTABLISHMENT_SCORES_COLLECTION}/${estId}`,
  reportedContent: (reportId: string) => `${REPORTED_CONTENT_COLLECTION}/${reportId}`,
  tierHistoryEvent: (uid: string, eventId: string) =>
    `${USERS_COLLECTION}/${uid}/${TIER_HISTORY_SUBCOLLECTION}/${eventId}`,
} as const;
