/**
 * seed_staging.ts — Populates the zupurb-staging Firestore project with
 * realistic test data for beta testing and Apple/Play review.
 *
 * Usage:
 *   cd functions
 *   npm run seed:staging
 *
 * Prerequisites:
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account
 *     key for zupurb-staging, OR run `firebase use staging` first and rely
 *     on Application Default Credentials.
 */

import * as admin from "firebase-admin";

const STAGING_PROJECT_ID = "zupurb-staging";

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

admin.initializeApp({
  projectId: STAGING_PROJECT_ID,
});

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const NOW = admin.firestore.Timestamp.now();

// Twelve months from now — used for points expiry
const ONE_YEAR = new Date();
ONE_YEAR.setFullYear(ONE_YEAR.getFullYear() + 1);
const ONE_YEAR_TS = admin.firestore.Timestamp.fromDate(ONE_YEAR);

const USERS = [
  {
    uid: "test-user-001",
    displayName: "Alice Tester",
    phoneNumber: "+15550000001",
    pointsBalance: 500,
  },
  {
    uid: "test-user-002",
    displayName: "Bob Reviewer",
    phoneNumber: "+15550000002",
    pointsBalance: 500,
  },
  {
    uid: "test-user-003",
    displayName: "Carol Explorer",
    phoneNumber: "+15550000003",
    pointsBalance: 500,
  },
];

const ESTABLISHMENTS = [
  {
    estId: "est-test-lounge-001",
    name: "The Test Lounge",
    description: "A sophisticated cocktail bar in the heart of downtown — staging seed data only.",
    categories: ["bar"],
    address: "123 Main Street",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90001",
    country: "US",
    geohash: "9q5ctr",
    lat: 34.0522,
    lng: -118.2437,
  },
  {
    estId: "est-demo-bar-002",
    name: "Demo Bar & Grill",
    description: "Casual American fare and craft beers — staging seed data only.",
    categories: ["bar", "restaurant"],
    address: "456 Oak Avenue",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90002",
    country: "US",
    geohash: "9q5ctq",
    lat: 34.0489,
    lng: -118.2416,
  },
];

const DEALS = [
  {
    dealId: "deal-test-lounge-001",
    estId: "est-test-lounge-001",
    estName: "The Test Lounge",
    estCity: "Los Angeles",
    geohash: "9q5ctr",
    title: "Free Welcome Cocktail",
    description: "Redeem for one complimentary house cocktail of your choice.",
    category: "drink",
    pointCost: 200,
    originalValueCents: 1400,
    coverImageUrl: null,
    isActive: true,
    totalRedemptionCap: 50,
    redemptionsCount: 0,
    remainingRedemptions: 50,
    perUserMonthlyCapFreeUser: 3,
    perUserMonthlyCapPlus: 5,
    maxRedemptionsPerUser: 1,
    dealTier: "standard" as const,
    deactivatedAt: null,
    deactivatedReason: null,
    schemaVersion: 1,
  },
  {
    dealId: "deal-demo-bar-001",
    estId: "est-demo-bar-002",
    estName: "Demo Bar & Grill",
    estCity: "Los Angeles",
    geohash: "9q5ctq",
    title: "Complimentary Appetizer",
    description: "Enjoy a free appetizer from our starter menu with any entree purchase.",
    category: "appetizer",
    pointCost: 150,
    originalValueCents: 1200,
    coverImageUrl: null,
    isActive: true,
    totalRedemptionCap: 30,
    redemptionsCount: 0,
    remainingRedemptions: 30,
    perUserMonthlyCapFreeUser: 3,
    perUserMonthlyCapPlus: 5,
    maxRedemptionsPerUser: 1,
    dealTier: "standard" as const,
    deactivatedAt: null,
    deactivatedReason: null,
    schemaVersion: 1,
  },
];

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

async function seedUsers(): Promise<void> {
  console.log("Seeding users...");
  const batch = db.batch();

  for (const u of USERS) {
    const ref = db.collection("users").doc(u.uid);
    batch.set(ref, {
      uid: u.uid,
      displayName: u.displayName,
      photoUrl: null,
      fingerprint: {
        ageGroup: 0.25,
        genderIdentity: 0,
        cuisinePreferences: [1, 0, 1, 0, 0],
        activityPreferences: [1, 1, 0],
        dietaryRestrictions: [0, 0, 0],
        spendingHabit: 0.5,
      },
      loyaltyTier: "bronze",
      tierUpdatedAt: NOW,
      tierHiddenByUser: false,
      pointsBalance: u.pointsBalance,
      rollingPoints12mo: u.pointsBalance,
      bio: null,
      followersCount: 0,
      followingCount: 0,
      reviewCount: 0,
      verifiedReviewCount: 0,
      onboardingComplete: true,
      phoneVerified: true,
      referralCode: null,
      myReferralCode: null,
      referredBy: null,
      referralRewardClaimed: false,
      noShowCount: 0,
      reservationsBanned: false,
      isPlusSubscriber: false,
      plusExpiresAt: null,
      plusActive: false,
      plusActivatedAt: null,
      plusActiveUntil: null,
      plusSource: null,
      tierOverride: false,
      tierOverrideReason: null,
      tierOverrideExpiresAt: null,
      fcmTokens: [],
      fcmTokenDetails: {},
      notificationPreferences: {},
      unreadNotificationCount: 0,
      isBanned: false,
      bannedAt: null,
      banReason: null,
      banExpiresAt: null,
      accountType: "user",
      following: [],
      followers: [],
      lastActiveAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
    });
  }

  await batch.commit();
  console.log(`  Written ${USERS.length} users.`);
}

async function seedEstablishments(): Promise<void> {
  console.log("Seeding establishments...");
  const batch = db.batch();

  for (const e of ESTABLISHMENTS) {
    const ref = db.collection("establishments").doc(e.estId);
    batch.set(ref, {
      ...e,
      overallScore: 0,
      overallScoreUpdatedAt: NOW,
      reviewCount: 0,
      verifiedReviewCount: 0,
      claimedByUid: null,
      claimedAt: null,
      isVerifiedBusiness: false,
      isVerified: false,
      verifiedAt: null,
      verificationNotes: null,
      verifiedBy: null,
      ownerUids: [],
      reportCount: 0,
      coverPhotoUrl: null,
      photoUrls: [],
      isActive: true,
      isOpenForReservations: true,
      websiteUrl: null,
      phoneNumber: null,
      createdAt: NOW,
      updatedAt: NOW,
      schemaVersion: 1,
    });
  }

  await batch.commit();
  console.log(`  Written ${ESTABLISHMENTS.length} establishments.`);
}

async function seedDeals(): Promise<void> {
  console.log("Seeding deals...");
  const batch = db.batch();

  // Deals start now, expire in 90 days
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 90);
  const expiresAt = admin.firestore.Timestamp.fromDate(expiry);

  for (const d of DEALS) {
    // Top-level deals collection
    const globalRef = db.collection("deals").doc(d.dealId);
    const dealData = {
      ...d,
      startsAt: NOW,
      expiresAt,
      createdAt: NOW,
      updatedAt: NOW,
    };
    batch.set(globalRef, dealData);

    // Sub-collection on establishment
    const estDealRef = db
      .collection("establishments")
      .doc(d.estId)
      .collection("deals")
      .doc(d.dealId);
    batch.set(estDealRef, dealData);
  }

  await batch.commit();
  console.log(`  Written ${DEALS.length} deals (global + establishment sub-collections).`);
}

async function seedUserBalances(): Promise<void> {
  console.log("Seeding userBalances...");
  const batch = db.batch();

  for (const u of USERS) {
    const ref = db.collection("userBalances").doc(u.uid);
    batch.set(ref, {
      userId: u.uid,
      balance: u.pointsBalance,
      lifetimeEarned: u.pointsBalance,
      lifetimeSpent: 0,
      updatedAt: NOW,
    });
  }

  await batch.commit();
  console.log(`  Written ${USERS.length} userBalance entries.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\nZupurb staging seed — project: ${STAGING_PROJECT_ID}\n`);

  try {
    await seedUsers();
    await seedEstablishments();
    await seedDeals();
    await seedUserBalances();
    console.log("\nSeed complete.");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

main();
