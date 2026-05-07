/**
 * types/user.ts — Public TypeScript interfaces for the User domain.
 *
 * This file re-exports and extends the core Firestore document types with
 * view-model variants suitable for returning to clients. Raw Firestore
 * document types (UserDoc, PrivateUserDataDoc) live in lib/schema.ts and
 * should never be returned to clients directly.
 *
 * Milestone: B2 — Identity & Profile
 */

import { Timestamp } from "firebase-admin/firestore";
import { LoyaltyTier, VerificationTier } from "../lib/schema";

// Re-export DemographicFingerprint so callers can import from a single types location.
export type { DemographicFingerprint } from "../lib/schema";

// ---------------------------------------------------------------------------
// UserProfile — public subset returned by getProfile callable
// ---------------------------------------------------------------------------

/**
 * Public profile fields visible to any authenticated user looking at someone
 * else's profile. No PII; no UAR; no fingerprint vector.
 */
export interface PublicUserProfile {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  bio: string | null;

  // Social counts
  followersCount: number;
  followingCount: number;
  reviewCount: number;
  verifiedReviewCount: number;

  // Tier (hidden if user toggled tierHiddenByUser)
  loyaltyTier: LoyaltyTier | null;  // null when hidden
  tierHiddenByUser: boolean;

  // Verification badge (public — shown on profile header)
  verificationTier: VerificationTier | null;

  createdAt: Timestamp;
}

/**
 * Full profile returned to the owner only (includes mutable preference fields,
 * subscription state, referral codes). Still excludes UAR and device fingerprint.
 */
export interface OwnUserProfile extends PublicUserProfile {
  // Demographics (owner-only — not shown to others)
  username: string | null;
  birthYear: number | null;
  gender: string | null;
  ethnicity: string | null;
  incomeRange: string | null;
  city: string | null;
  neighborhood: string | null;
  activityPreferences: string[];
  diningPreferences: string[];
  nightlifePreferences: string[];

  // Points
  pointsBalance: number;
  rollingPoints12mo: number;

  // Onboarding
  onboardingComplete: boolean;
  phoneVerified: boolean;

  // Referral (B13)
  myReferralCode: string | null;
  referredBy: string | null;
  referralRewardClaimed: boolean;

  // Plus subscription
  isPlusSubscriber: boolean;
  plusActive: boolean;
  plusExpiresAt: Timestamp | null;
  plusActiveUntil: Timestamp | null;
  plusSource: "iap" | "platinum_tier" | null;

  // Reservation
  noShowCount: number;
  reservationsBanned: boolean;

  // Account
  accountType: "user" | "business" | "entertainer";
  isBanned: boolean;

  updatedAt: Timestamp;
}

/**
 * Union convenience type — what getProfile returns depends on whether the
 * caller is the owner.
 */
export type UserProfile = PublicUserProfile | OwnUserProfile;

// ---------------------------------------------------------------------------
// AccountStatus — logical account lifecycle states used by deleteAccount
// ---------------------------------------------------------------------------

export type AccountStatus = "active" | "suspended" | "banned" | "deleted";

// ---------------------------------------------------------------------------
// ScheduledDeleteDoc — written to _scheduled_deletes/{uid} on deleteAccount
// Hard-delete job reads and processes these after TTL.
// ---------------------------------------------------------------------------

export interface ScheduledDeleteDoc {
  uid: string;
  requestedAt: Timestamp;
  scheduledDeleteAt: Timestamp;  // requestedAt + 30 days
  reason: "user_requested" | "admin_action";
  anonymizedAt: Timestamp;       // when PII was wiped (set during soft-delete)
}
