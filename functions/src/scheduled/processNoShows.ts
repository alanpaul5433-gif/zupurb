/**
 * processNoShows.ts — Hourly scheduled job to mark missed reservations as no-shows
 * and apply the no-show penalty.
 *
 * Query: confirmed reservations where scheduledAt < now - 90 minutes.
 * Steps per reservation:
 *   1. Mark status = "no_show", noShowAt = now.
 *   2. Deduct 25 pts from guest via spendPoints (type: spend_noshow_penalty).
 *   3. Notify guest: "Missed reservation — 25 pts deducted".
 *   4. Increment users/{uid}.noShowCount.
 *   5. If noShowCount >= 3: set reservationsBanned = true, notify guest.
 *
 * RC keys:
 *   noshow_grace_period_minutes  (default 90)
 *   points_noshow_penalty        (default 25)
 *   noshow_ban_threshold         (default 3)
 *
 * Milestone: B7
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  ReservationDoc,
  NotificationDoc,
  RESERVATIONS_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  Paths,
} from "../lib/schema";
import { spendPoints } from "../lib/ledger";
import { log } from "../lib/logging";

setGlobalOptions({ timeoutSeconds: 540, memory: "256MiB" });

// ---------------------------------------------------------------------------
// Constants (Remote Config governed)
// ---------------------------------------------------------------------------

const GRACE_PERIOD_MINUTES = 90;  // RC: noshow_grace_period_minutes
const NOSHOW_PENALTY_PTS   = 25;  // RC: points_noshow_penalty
const BAN_THRESHOLD        = 3;   // RC: noshow_ban_threshold
const BATCH_SIZE           = 100; // Process at most 100 per run to stay within timeout

// ---------------------------------------------------------------------------
// Scheduled function — runs every hour
// ---------------------------------------------------------------------------

export const processNoShows = onSchedule(
  { schedule: "every 60 minutes", timeoutSeconds: 540, memory: "256MiB" },
  async () => {
    const db  = getFirestore();
    const now = Date.now();
    const graceCutoff = Timestamp.fromMillis(now - GRACE_PERIOD_MINUTES * 60 * 1000); // RC: noshow_grace_period_minutes

    log.info("processNoShows: start", {
      traceId: "cron_noshow",
      domain:  "reservations",
      eventId: `noshow_${now}`,
    }, { graceCutoffIso: graceCutoff.toDate().toISOString() });

    // Query confirmed reservations past the grace period
    const snap = await db
      .collection(RESERVATIONS_COLLECTION)
      .where("status", "==", "confirmed")
      .where("scheduledAt", "<", graceCutoff)
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) {
      log.info("processNoShows: no no-shows found", {
        traceId: "cron_noshow",
        domain:  "reservations",
        eventId: `noshow_${now}`,
      });
      return;
    }

    log.info("processNoShows: processing", {
      traceId: "cron_noshow",
      domain:  "reservations",
      eventId: `noshow_${now}`,
    }, { count: snap.size });

    const nowTs = Timestamp.now();
    let processed = 0;
    let errors    = 0;

    for (const doc of snap.docs) {
      const res = doc.data() as ReservationDoc;
      const uid = res.guestUid;

      try {
        // -----------------------------------------------------------------------
        // 1. Mark as no_show
        // -----------------------------------------------------------------------

        await doc.ref.update({
          status:         "no_show",
          noShowAt:       nowTs,
          noShowRecordedAt: nowTs,
          noShowPenaltyApplied: true,
          updatedAt:      nowTs,
        });

        // -----------------------------------------------------------------------
        // 2. Deduct penalty points (best-effort — user may have 0 balance)
        // -----------------------------------------------------------------------

        try {
          await spendPoints(uid, {
            amount:            NOSHOW_PENALTY_PTS, // RC: points_noshow_penalty
            type:              "spend_noshow_penalty",
            description:       `No-show penalty — missed reservation at ${res.estName}`,
            relatedEntityId:   res.reservationId,
            relatedEntityType: "reservation",
          });
        } catch (pointsErr) {
          // Insufficient balance is non-fatal; log and continue
          log.warn("processNoShows: could not deduct penalty (insufficient balance)", {
            traceId: "cron_noshow",
            userId:  uid,
            domain:  "reservations",
            eventId: res.reservationId,
          }, { error: String(pointsErr) });
        }

        // -----------------------------------------------------------------------
        // 3. No-show notification
        // -----------------------------------------------------------------------

        const notifId = `noshow_${res.reservationId}`;
        const notif: NotificationDoc = {
          notifId,
          userId:       uid,
          type:         "reservation_noshow",
          title:        "Missed Reservation",
          body:         `You missed your reservation at ${res.estName}. ${NOSHOW_PENALTY_PTS} pts have been deducted.`,
          deepLinkPath: `/reservations`,
          imageUrl:     null,
          payload:      {
            reservationId: res.reservationId,
            estId:         res.estId,
            penaltyPts:    NOSHOW_PENALTY_PTS,
          },
          isRead:   false,
          readAt:   null,
          createdAt: nowTs,
        };

        await db
          .collection(NOTIFICATIONS_COLLECTION)
          .doc(uid)
          .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
          .doc(notifId)
          .set(notif);

        // -----------------------------------------------------------------------
        // 4 & 5. Increment noShowCount; check ban threshold
        // -----------------------------------------------------------------------

        const userRef  = db.doc(Paths.user(uid));
        const userSnap = await userRef.get();

        if (userSnap.exists) {
          const currentNoShows = (userSnap.data() as { noShowCount?: number }).noShowCount ?? 0;
          const newNoShowCount = currentNoShows + 1;

          const userUpdate: Record<string, unknown> = {
            noShowCount: FieldValue.increment(1),
            updatedAt:   nowTs,
          };

          if (newNoShowCount >= BAN_THRESHOLD) { // RC: noshow_ban_threshold
            userUpdate.reservationsBanned = true;

            // Ban notification
            const banNotifId = `res_ban_${uid}_${nowTs.seconds}`;
            const banNotif: NotificationDoc = {
              notifId:      banNotifId,
              userId:       uid,
              type:         "reservation_banned",
              title:        "Reservation Privilege Suspended",
              body:         "You have been suspended from making reservations due to repeated no-shows. Contact support for assistance.",
              deepLinkPath: `/settings/support`,
              imageUrl:     null,
              payload:      { noShowCount: newNoShowCount },
              isRead:       false,
              readAt:       null,
              createdAt:    nowTs,
            };

            await db
              .collection(NOTIFICATIONS_COLLECTION)
              .doc(uid)
              .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
              .doc(banNotifId)
              .set(banNotif);

            log.warn("processNoShows: user banned from reservations", {
              traceId: "cron_noshow",
              userId:  uid,
              domain:  "reservations",
              eventId: res.reservationId,
            }, { noShowCount: newNoShowCount });
          }

          await userRef.update(userUpdate);
        }

        processed++;
      } catch (err) {
        errors++;
        log.error("processNoShows: failed to process reservation", {
          traceId: "cron_noshow",
          userId:  uid,
          domain:  "reservations",
          eventId: res.reservationId,
        }, { error: String(err) });
      }
    }

    log.info("processNoShows: complete", {
      traceId: "cron_noshow",
      domain:  "reservations",
      eventId: `noshow_${now}`,
    }, { processed, errors });
  }
);
