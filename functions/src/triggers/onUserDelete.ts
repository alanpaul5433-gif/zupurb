/**
 * onUserDelete.ts — Firebase Auth v1 onDelete trigger.
 *
 * Fires when a Firebase Auth user account is deleted.
 * Soft-deletes users/{uid} (sets deletedAt + isDeleted).
 * Hard-deletes private_user_data/{uid} (CCPA right to erasure).
 * Cancels any upcoming reservations (status → 'cancelled').
 * Reviews, posts, and points history are retained for data integrity.
 *
 * Uses firebase-functions/v1 auth (v2 identity does not expose onDelete).
 *
 * Domain: auth / users
 * Milestone: B2
 */

import * as functionsV1 from "firebase-functions/v1";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  RESERVATIONS_COLLECTION,
  ReservationDoc,
  Paths,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

export const onUserDelete = functionsV1
  .region("us-central1")
  .runWith({ memory: "256MB" })
  .auth.user()
  .onDelete(async (user) => {
    const traceId = newTraceId();
    const { uid } = user;

    log.info("onUserDelete: start", { traceId, userId: uid, domain: "auth" });

    const db = getFirestore();
    const now = Timestamp.now();

    // ------------------------------------------------------------------
    // 1. Soft-delete users/{uid}
    // ------------------------------------------------------------------
    await db.doc(Paths.user(uid)).update({
      isDeleted: true,
      deletedAt: now,
      displayName: "[deleted]",
      photoUrl: null,
      bio: null,
      updatedAt: now,
    } as Record<string, unknown>);

    // ------------------------------------------------------------------
    // 2. Hard-delete private_user_data/{uid}
    //    PII + fraud signals — CCPA right to erasure.
    // ------------------------------------------------------------------
    await db.doc(Paths.privateUserData(uid)).delete();

    // ------------------------------------------------------------------
    // 3. Cancel upcoming reservations
    //    Query: guestUid == uid AND status == 'confirmed' AND scheduledAt > now
    // ------------------------------------------------------------------
    const upcomingSnap = await db
      .collection(RESERVATIONS_COLLECTION)
      .where("guestUid", "==", uid)
      .where("status", "==", "confirmed")
      .where("scheduledAt", ">", now)
      .get();

    if (!upcomingSnap.empty) {
      const batchLimit = 400; // Firestore max is 500; use 400 for safety
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
      if (opCount > 0) {
        await batch.commit();
      }

      log.info("onUserDelete: reservations cancelled", {
        traceId,
        userId: uid,
        domain: "auth",
        count: upcomingSnap.size,
      });
    }

    log.info("onUserDelete: complete", { traceId, userId: uid, domain: "auth" });
  });
