/**
 * onUserCreate.ts — Firebase Auth v1 onCreate trigger.
 *
 * Fires after a new user registers via Firebase Auth.
 * Creates: users/{uid}, private_user_data/{uid}, userBalances/{uid}.
 * Does NOT award points — completeOnboarding callable handles that.
 *
 * Uses firebase-functions/v1 auth (v2 identity only has blocking beforeCreate/beforeSignIn).
 *
 * Domain: auth / users
 * Milestone: B2
 */

import * as functionsV1 from "firebase-functions/v1";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  UserDoc,
  PrivateUserDataDoc,
  UserBalanceDoc,
  DemographicFingerprint,
  Paths,
  LoyaltyTier,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

const SCHEMA_VERSION = 1;

/** Blank fingerprint assigned at creation. Populated during/after onboarding. */
const EMPTY_FINGERPRINT: DemographicFingerprint = {
  ageGroup: 0,
  genderIdentity: 0,
  cuisinePreferences: [],
  activityPreferences: [],
  dietaryRestrictions: [],
  spendingHabit: 0,
};

// B13: generateReferralCode is now handled in lib/referral.ts at onboarding completion.
// At account creation we just set null — the real code is generated in completeOnboarding.

export const onUserCreate = functionsV1
  .region("us-central1")
  .runWith({ memory: "256MB" })
  .auth.user()
  .onCreate(async (user) => {
    const traceId = newTraceId();
    const { uid, displayName, photoURL } = user;

    log.info("onUserCreate: start", { traceId, userId: uid, domain: "auth" });

    const db = getFirestore();
    const now = Timestamp.now();
    const batch = db.batch();

    // ------------------------------------------------------------------
    // 1. users/{uid}
    // ------------------------------------------------------------------
    const userDoc: UserDoc = {
      uid,
      displayName: displayName ?? "",
      photoUrl: photoURL ?? null,
      fingerprint: EMPTY_FINGERPRINT,
      loyaltyTier: "bronze" as LoyaltyTier,
      tierUpdatedAt: now,
      tierHiddenByUser: false,
      pointsBalance: 0,
      rollingPoints12mo: 0,
      bio: null,
      followersCount: 0,
      followingCount: 0,
      reviewCount: 0,
      verifiedReviewCount: 0,
      onboardingComplete: false,
      phoneVerified: false,
      // B13: referral fields — fully populated at completeOnboarding time
      referralCode: null,            // code this user applied (null until they enter one)
      myReferralCode: null,          // this user's shareable code (generated at onboarding)
      referredBy: null,              // referrer uid (null until referral applied)
      referralRewardClaimed: false,  // set true once first-verified-review reward fires
      noShowCount: 0,           // B7: reservation no-show counter
      reservationsBanned: false, // B7: set true at noShowCount >= 3
      isPlusSubscriber: false,
      plusExpiresAt: null,
      // B14: Plus managed state
      plusActive: false,
      plusActivatedAt: null,
      plusActiveUntil: null,
      plusSource: null,
      // B14: Tier override (admin-set)
      tierOverride: false,
      tierOverrideReason: null,
      tierOverrideExpiresAt: null,
      // B10: FCM + notification defaults
      fcmTokens: [],
      fcmTokenDetails: {},
      notificationPreferences: {},    // all types enabled by default (empty = all on)
      unreadNotificationCount: 0,
      // B12: ban state (defaults)
      isBanned: false,
      bannedAt: null,
      banReason: null,
      banExpiresAt: null,
      accountType: "user" as const,
      following: [],
      followers: [],
      lastActiveAt: null,
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
    };
    batch.set(db.doc(Paths.user(uid)), userDoc);

    // ------------------------------------------------------------------
    // 2. private_user_data/{uid}
    // ------------------------------------------------------------------
    const privateDoc: PrivateUserDataDoc = {
      uid,
      uar: 0.5,                  // RC: uar.default
      uarUpdatedAt: now,
      uarHistory: [],
      deviceFingerprints: [],
      fraudFlags: [],
      isSandboxed: false,
      sandboxedAt: null,
      isQuarantined: false,
      isBanned: false,
      bannedAt: null,
      banReason: null,
      reviewsThisWeek: 0,
      weeklyCapWindowStart: now,
      behaviorSignals: {
        confirmedReportCount: 0,
        vpnFlagged: false,
        accountAgeAtFirstReview: null,
        reviewCountAtDay7: null,
      },
      lastUARComputedAt: null,
      internalNotes: "",
      schemaVersion: SCHEMA_VERSION,
    };
    batch.set(db.doc(Paths.privateUserData(uid)), privateDoc);

    // ------------------------------------------------------------------
    // 3. userBalances/{uid}
    // ------------------------------------------------------------------
    const balanceDoc: UserBalanceDoc = {
      userId: uid,
      balance: 0,
      lifetimeEarned: 0,
      lifetimeSpent: 0,
      updatedAt: now,
    };
    batch.set(db.doc(Paths.userBalance(uid)), balanceDoc);

    await batch.commit();

    log.info("onUserCreate: complete", { traceId, userId: uid, domain: "auth" });
  });
