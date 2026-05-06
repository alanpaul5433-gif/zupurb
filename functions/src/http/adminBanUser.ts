/**
 * adminBanUser.ts — Admin-only callable to ban a user.
 *
 * Sets isBanned on both users/{uid} and private_user_data/{uid}.
 * Cancels all upcoming reservations.
 * Deactivates all active deals for this user (marks redemptions as failed).
 * For temporary bans: sends a suspension notification to the user.
 * Logs ban in private_user_data/{uid}.fraudFlags.
 *
 * Requires: admin custom claim.
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  Paths,
  RESERVATIONS_COLLECTION,
  DEAL_REDEMPTIONS_COLLECTION,
  FraudFlag,
} from "../lib/schema";
import { requireAdmin } from "../lib/adminGuard";
import { sendNotification } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const AdminBanUserSchema = z.object({
  uid:          z.string().min(1),
  reason:       z.string().min(1).max(500),
  durationDays: z.number().int().positive().optional(), // null/undefined = permanent
});

// ---------------------------------------------------------------------------
// Exported callable
// ---------------------------------------------------------------------------

export const adminBanUser = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = AdminBanUserSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { uid, reason, durationDays } = parsed.data;

    log.info("adminBanUser: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `ban_${uid}`,
    }, { reason, durationDays });

    const db = getFirestore();
    const now = Timestamp.now();
    const isPermanent = !durationDays;
    const banExpiresAt = durationDays
      ? Timestamp.fromMillis(now.toMillis() + durationDays * 86400 * 1000)
      : null;

    // 1. Update users/{uid}
    await db.doc(Paths.user(uid)).update({
      isBanned:    true,
      bannedAt:    now,
      banReason:   reason,
      banExpiresAt: banExpiresAt,
      updatedAt:   now,
    });

    // 2. Update private_user_data/{uid}
    const privRef = db.doc(Paths.privateUserData(uid));
    const flag: FraudFlag = {
      flagId:     `ban_${adminUid}_${uid}_${now.seconds}`,
      reason:     "admin_flag",
      reviewId:   null,
      detectedAt: now,
      resolvedAt: null,
      resolvedBy: null,
    };
    const auditLine = `[${now.toDate().toISOString()}] admin:${adminUid} banned uid:${uid} reason:"${reason}" duration:${durationDays ?? "permanent"}`;

    await privRef.update({
      isBanned:    true,
      bannedAt:    now,
      banReason:   reason,
      fraudFlags:  FieldValue.arrayUnion(flag),
      internalNotes: FieldValue.arrayUnion(auditLine) as unknown as string,
    });

    // 3. Cancel all upcoming reservations
    try {
      const upcomingSnap = await db
        .collection(RESERVATIONS_COLLECTION)
        .where("guestUid", "==", uid)
        .where("status", "==", "confirmed")
        .get();

      const cancelBatch = db.batch();
      upcomingSnap.docs.forEach((d) => {
        cancelBatch.update(d.ref, {
          status:             "cancelled",
          cancelledAt:        now,
          cancelledBy:        "admin",
          cancellationReason: `Account banned: ${reason}`,
          updatedAt:          now,
        });
      });
      if (!upcomingSnap.empty) await cancelBatch.commit();
    } catch (err) {
      log.error("adminBanUser: reservation cancellation failed", {
        traceId, userId: adminUid, domain: "admin", eventId: uid,
      }, { error: String(err) });
    }

    // 4. Deactivate pending deal redemptions
    try {
      const redemptionSnap = await db
        .collection(DEAL_REDEMPTIONS_COLLECTION)
        .where("userId", "==", uid)
        .where("status", "==", "pending")
        .get();

      const redemptionBatch = db.batch();
      redemptionSnap.docs.forEach((d) => {
        redemptionBatch.update(d.ref, {
          status:    "failed",
          updatedAt: now,
        });
      });
      if (!redemptionSnap.empty) await redemptionBatch.commit();
    } catch (err) {
      log.error("adminBanUser: deal deactivation failed", {
        traceId, userId: adminUid, domain: "admin", eventId: uid,
      }, { error: String(err) });
    }

    // 5. Notify user (only for temporary bans)
    if (!isPermanent) {
      await sendNotification(uid, {
        type:  "system",
        title: "Account temporarily suspended",
        body:  `Your account has been temporarily suspended for ${durationDays} day(s). Reason: ${reason}`,
        data:  { durationDays: String(durationDays) },
      });
    }

    log.info("adminBanUser: complete", {
      traceId, userId: adminUid, domain: "admin", eventId: uid,
    }, { reason, isPermanent, banExpiresAt: banExpiresAt?.toDate().toISOString() });

    return { uid, isBanned: true, isPermanent, banExpiresAt };
  }
);
