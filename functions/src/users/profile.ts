/**
 * users/profile.ts — Profile-domain callables.
 *
 * Exports:
 *   getProfile      — returns public profile for any uid; full profile for self
 *   deleteAccount   — soft-deletes caller's account + schedules 30-day hard delete
 *   exportUserData  — GDPR data export: profile + reviews + points transactions
 *
 * updateProfile and checkUsernameAvailable live in http/ because they existed
 * before this domain file was introduced (B2 retro-fit). They are re-exported
 * here for convenience; index.ts imports from the original paths.
 *
 * Domain: users
 * Milestone: B2 — Identity & Profile
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  Paths,
  REVIEWS_COLLECTION,
  POINTS_LEDGER_COLLECTION,
  UserDoc,
  ReviewDoc,
  PointsLedgerEntry,
  RESERVATIONS_COLLECTION,
  ReservationDoc,
} from "../lib/schema";
import { requireAuth } from "../lib/auth";
import { log, newTraceId } from "../lib/logging";
import {
  OwnUserProfile,
  PublicUserProfile,
  ScheduledDeleteDoc,
} from "../types/user";

const SCHEDULED_DELETES_COLLECTION = "_scheduled_deletes";
const HARD_DELETE_DAYS = 30; // RC: users.hardDeleteDays (30)

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

const GetProfileSchema = z.object({
  uid: z.string().min(1),
});

/**
 * Returns a public profile for any authenticated user.
 * If the requested uid matches the caller, returns the full OwnUserProfile.
 */
export const getProfile = onCall(
  {
    region: "us-central1",
    memory: "128MiB",
    timeoutSeconds: 30,
    enforceAppCheck: true,
  },
  async (request) => {
    const traceId = newTraceId();
    const callerUid = requireAuth(request);

    const parsed = GetProfileSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", "uid is required.");
    }
    const { uid } = parsed.data;

    log.info("getProfile: start", { traceId, userId: callerUid, domain: "users" });

    const db = getFirestore();
    const snap = await db.doc(Paths.user(uid)).get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }

    const doc = snap.data() as UserDoc;

    // Deleted accounts are not readable by anyone except admin
    if ((doc as unknown as Record<string, unknown>)["isDeleted"] === true) {
      throw new HttpsError("not-found", "User not found.");
    }

    const isSelf = callerUid === uid;

    // ------------------------------------------------------------------
    // Build public profile (safe for any authenticated caller)
    // ------------------------------------------------------------------
    const publicProfile: PublicUserProfile = {
      uid: doc.uid,
      displayName: doc.displayName,
      photoUrl: doc.photoUrl,
      bio: doc.bio,
      followersCount: doc.followersCount,
      followingCount: doc.followingCount,
      reviewCount: doc.reviewCount,
      verifiedReviewCount: doc.verifiedReviewCount,
      loyaltyTier: doc.tierHiddenByUser ? null : doc.loyaltyTier,
      tierHiddenByUser: doc.tierHiddenByUser,
      verificationTier: null,  // derived from verifiedReviewCount in future B3
      createdAt: doc.createdAt,
    };

    if (!isSelf) {
      log.info("getProfile: returning public profile", {
        traceId,
        userId: callerUid,
        domain: "users",
      });
      return publicProfile;
    }

    // ------------------------------------------------------------------
    // Self: augment with owner-only fields
    // ------------------------------------------------------------------
    const raw = doc as unknown as Record<string, unknown>;

    const ownProfile: OwnUserProfile = {
      ...publicProfile,
      username: (raw["username"] as string | null) ?? null,
      birthYear: (raw["birthYear"] as number | null) ?? null,
      gender: (raw["gender"] as string | null) ?? null,
      ethnicity: (raw["ethnicity"] as string | null) ?? null,
      incomeRange: (raw["incomeRange"] as string | null) ?? null,
      city: (raw["city"] as string | null) ?? null,
      neighborhood: (raw["neighborhood"] as string | null) ?? null,
      activityPreferences: (raw["activityPreferences"] as string[]) ?? [],
      diningPreferences: (raw["diningPreferences"] as string[]) ?? [],
      nightlifePreferences: (raw["nightlifePreferences"] as string[]) ?? [],
      pointsBalance: doc.pointsBalance,
      rollingPoints12mo: doc.rollingPoints12mo,
      onboardingComplete: doc.onboardingComplete,
      phoneVerified: doc.phoneVerified,
      myReferralCode: doc.myReferralCode,
      referredBy: doc.referredBy,
      referralRewardClaimed: doc.referralRewardClaimed,
      isPlusSubscriber: doc.isPlusSubscriber,
      plusActive: doc.plusActive,
      plusExpiresAt: doc.plusExpiresAt,
      plusActiveUntil: doc.plusActiveUntil,
      plusSource: doc.plusSource,
      noShowCount: doc.noShowCount,
      reservationsBanned: doc.reservationsBanned,
      accountType: doc.accountType,
      isBanned: doc.isBanned,
      updatedAt: doc.updatedAt,
    };

    log.info("getProfile: returning own profile", {
      traceId,
      userId: callerUid,
      domain: "users",
    });

    return ownProfile;
  }
);

// ---------------------------------------------------------------------------
// deleteAccount
// ---------------------------------------------------------------------------

/**
 * Soft-deletes the caller's account:
 *   1. Anonymizes PII on users/{uid}
 *   2. Hard-deletes private_user_data/{uid}
 *   3. Cancels upcoming reservations
 *   4. Writes a TTL document to _scheduled_deletes/{uid} (30-day hard delete)
 *
 * Idempotent: calling twice returns success without re-processing.
 */
export const deleteAccount = onCall(
  {
    region: "us-central1",
    memory: "256MiB",
    timeoutSeconds: 60,
    enforceAppCheck: true,
  },
  async (request) => {
    const traceId = newTraceId();
    const uid = requireAuth(request);

    log.info("deleteAccount: start", { traceId, userId: uid, domain: "users" });

    const db = getFirestore();
    const userRef = db.doc(Paths.user(uid));
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }

    const userData = userSnap.data() as Record<string, unknown>;

    // Idempotency: already deleted
    if (userData["isDeleted"] === true) {
      log.info("deleteAccount: already deleted, idempotent return", {
        traceId,
        userId: uid,
        domain: "users",
      });
      return { success: true, alreadyDeleted: true };
    }

    const now = Timestamp.now();
    const hardDeleteAt = new Date(now.toMillis() + HARD_DELETE_DAYS * 24 * 60 * 60 * 1000);

    // ------------------------------------------------------------------
    // 1. Anonymize PII on users/{uid} (soft delete)
    // ------------------------------------------------------------------
    await userRef.update({
      isDeleted: true,
      deletedAt: now,
      accountStatus: "deleted",
      // Anonymize PII
      displayName: "[deleted]",
      photoUrl: null,
      bio: null,
      // Clear sensitive demographics
      username: null,
      birthYear: null,
      gender: null,
      ethnicity: null,
      incomeRange: null,
      city: null,
      neighborhood: null,
      activityPreferences: [],
      diningPreferences: [],
      nightlifePreferences: [],
      sensitiveTopics: null,
      // Clear communication fields
      fcmTokens: [],
      fcmTokenDetails: {},
      // Clear referral codes (deactivate)
      myReferralCode: null,
      updatedAt: now,
    } as Record<string, unknown>);

    // ------------------------------------------------------------------
    // 2. Hard-delete private_user_data/{uid} — CCPA right to erasure
    // ------------------------------------------------------------------
    await db.doc(Paths.privateUserData(uid)).delete();

    // ------------------------------------------------------------------
    // 3. Cancel upcoming reservations
    // ------------------------------------------------------------------
    const upcomingSnap = await db
      .collection(RESERVATIONS_COLLECTION)
      .where("guestUid", "==", uid)
      .where("status", "==", "confirmed")
      .where("scheduledAt", ">", now)
      .get();

    if (!upcomingSnap.empty) {
      const batchLimit = 400;
      let batch = db.batch();
      let opCount = 0;

      for (const snap of upcomingSnap.docs) {
        const res = snap.data() as ReservationDoc;
        batch.update(db.doc(Paths.reservation(res.reservationId)), {
          status: "cancelled",
          cancelledAt: now,
          updatedAt: now,
          cancellationReason: "account_deleted",
        } as Record<string, unknown>);
        opCount++;
        if (opCount === batchLimit) {
          await batch.commit();
          batch = db.batch();
          opCount = 0;
        }
      }
      if (opCount > 0) await batch.commit();

      log.info("deleteAccount: upcoming reservations cancelled", {
        traceId,
        userId: uid,
        domain: "users",
        count: upcomingSnap.size,
      });
    }

    // ------------------------------------------------------------------
    // 4. Schedule hard delete via TTL document
    // ------------------------------------------------------------------
    const scheduledDeleteDoc: ScheduledDeleteDoc = {
      uid,
      requestedAt: now,
      scheduledDeleteAt: Timestamp.fromDate(hardDeleteAt),
      reason: "user_requested",
      anonymizedAt: now,
    };

    await db
      .collection(SCHEDULED_DELETES_COLLECTION)
      .doc(uid)
      .set(scheduledDeleteDoc);

    log.info("deleteAccount: complete", {
      traceId,
      userId: uid,
      domain: "users",
      hardDeleteScheduledAt: hardDeleteAt.toISOString(),
    });

    return { success: true, hardDeleteScheduledAt: hardDeleteAt.toISOString() };
  }
);

// ---------------------------------------------------------------------------
// exportUserData (GDPR data export)
// ---------------------------------------------------------------------------

/**
 * Returns a JSON-serialisable object containing all data Zupurb holds for the
 * caller: profile, reviews, points ledger transactions, and reservations.
 *
 * This function is intentionally liberal with what it returns — the caller
 * is the owner. UAR and private_user_data are excluded (admin-only).
 *
 * For large accounts the payload may be several hundred KB. For production,
 * consider writing to Cloud Storage and emailing a download link (async job).
 * The synchronous path is acceptable for MVP; log the payload size.
 */
export const exportUserData = onCall(
  {
    region: "us-central1",
    memory: "512MiB",
    timeoutSeconds: 120,
    enforceAppCheck: true,
  },
  async (request) => {
    const traceId = newTraceId();
    const uid = requireAuth(request);

    log.info("exportUserData: start", { traceId, userId: uid, domain: "users" });

    const db = getFirestore();

    // Parallel fetch: profile + reviews + ledger + reservations
    const [userSnap, reviewsSnap, ledgerSnap, reservationsSnap] =
      await Promise.all([
        db.doc(Paths.user(uid)).get(),
        db
          .collection(REVIEWS_COLLECTION)
          .where("authorUid", "==", uid)
          .orderBy("submittedAt", "desc")
          .get(),
        db
          .collection(POINTS_LEDGER_COLLECTION)
          .where("userId", "==", uid)
          .orderBy("createdAt", "desc")
          .limit(1000) // safety cap for export
          .get(),
        db
          .collection(RESERVATIONS_COLLECTION)
          .where("guestUid", "==", uid)
          .orderBy("scheduledAt", "desc")
          .get(),
      ]);

    if (!userSnap.exists) {
      throw new HttpsError("not-found", "User not found.");
    }

    const profile = userSnap.data() as UserDoc;
    const reviews = reviewsSnap.docs.map((d) => d.data() as ReviewDoc);
    const ledger = ledgerSnap.docs.map((d) => d.data() as PointsLedgerEntry);
    const reservations = reservationsSnap.docs.map(
      (d) => d.data() as ReservationDoc
    );

    // Strip server-only internal fields from profile before returning
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fcmTokenDetails,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fcmTokens,
      ...exportableProfile
    } = profile as UserDoc & Record<string, unknown>;

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      uid,
      profile: exportableProfile,
      reviews,
      pointsLedger: ledger,
      reservations,
    };

    const payloadBytes = JSON.stringify(exportPayload).length;
    log.info("exportUserData: complete", {
      traceId,
      userId: uid,
      domain: "users",
      reviewCount: reviews.length,
      ledgerEntries: ledger.length,
      reservationCount: reservations.length,
      estimatedBytes: payloadBytes,
    });

    return exportPayload;
  }
);
