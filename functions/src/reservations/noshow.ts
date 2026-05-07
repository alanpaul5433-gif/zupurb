/**
 * reservations/noshow.ts — Daily scheduled job: mark missed reservations as no-shows.
 *
 * Runs daily at 06:00 UTC.
 * Query: all "confirmed" reservations where scheduledAt < now - 2 hours.
 * Per reservation:
 *   1. Mark status = "no_show", noShowAt + noShowRecordedAt = now.
 *   2. Deduct penalty points (spend_noshow_penalty).
 *   3. Notify guest.
 *   4. Increment users/{uid}.noShowCount.
 *   5. If noShowCount >= ban threshold: set reservationsBanned = true, send ban notification.
 *   6. Decrement slot bookedCount (releaseSlot — best-effort).
 *   7. Stub: reliability score hook (B12 future).
 *
 * RC keys:
 *   noshow.gracePeriodMinutes  (default 120)
 *   noshow.penaltyPoints       (default 25)
 *   noshow.banThreshold        (default 3)
 *
 * Milestone: B8
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
import { releaseSlot } from "./slots";
import { log } from "../lib/logging";

setGlobalOptions({ timeoutSeconds: 540, memory: "256MiB" });

// ---------------------------------------------------------------------------
// Constants (Remote Config governed)
// ---------------------------------------------------------------------------

const GRACE_PERIOD_MINUTES = 120;   // RC: noshow.gracePeriodMinutes
const NOSHOW_PENALTY_PTS   = 25;    // RC: noshow.penaltyPoints
const BAN_THRESHOLD        = 3;     // RC: noshow.banThreshold
const BATCH_SIZE           = 100;

// ---------------------------------------------------------------------------
// Scheduled: daily 06:00 UTC
// ---------------------------------------------------------------------------

export const markNoShows = onSchedule(
  { schedule: "0 6 * * *", timeoutSeconds: 540, memory: "256MiB" },
  async () => {
    const db  = getFirestore();
    const now = Date.now();
    const graceCutoff = Timestamp.fromMillis(now - GRACE_PERIOD_MINUTES * 60_000);

    log.info("reservations_markNoShows: start", {
      traceId: "cron_noshow_b8",
      domain:  "reservations",
      eventId: `noshow_${now}`,
    }, { graceCutoffIso: graceCutoff.toDate().toISOString() });

    const snap = await db
      .collection(RESERVATIONS_COLLECTION)
      .where("status", "==", "confirmed")
      .where("scheduledAt", "<", graceCutoff)
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) {
      log.info("reservations_markNoShows: no no-shows found", {
        traceId: "cron_noshow_b8",
        domain:  "reservations",
        eventId: `noshow_${now}`,
      });
      return;
    }

    log.info("reservations_markNoShows: processing", {
      traceId: "cron_noshow_b8",
      domain:  "reservations",
      eventId: `noshow_${now}`,
    }, { count: snap.size });

    const nowTs    = Timestamp.now();
    let processed  = 0;
    let errors     = 0;

    for (const doc of snap.docs) {
      const res = doc.data() as ReservationDoc;
      const uid = res.guestUid;

      try {
        // 1. Mark no_show
        await doc.ref.update({
          status:              "no_show",
          noShowAt:            nowTs,
          noShowRecordedAt:    nowTs,
          noShowPenaltyApplied: true,
          updatedAt:           nowTs,
        });

        // 2. Deduct penalty (best-effort)
        try {
          await spendPoints(uid, {
            amount:            NOSHOW_PENALTY_PTS,
            type:              "spend_noshow_penalty",
            description:       `No-show penalty — missed reservation at ${res.estName}`,
            relatedEntityId:   res.reservationId,
            relatedEntityType: "reservation",
          });
        } catch (pointsErr) {
          log.warn("reservations_markNoShows: penalty deduction failed (non-fatal)", {
            traceId: "cron_noshow_b8",
            userId:  uid,
            domain:  "reservations",
            eventId: res.reservationId,
          }, { error: String(pointsErr) });
        }

        // 3. No-show notification
        const noShowNotif: NotificationDoc = {
          notifId:      `noshow_${res.reservationId}`,
          userId:       uid,
          type:         "reservation_no_show",
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
          .doc(noShowNotif.notifId)
          .set(noShowNotif);

        // 4 & 5. Increment noShowCount; auto-ban at threshold
        const userRef  = db.doc(Paths.user(uid));
        const userSnap = await userRef.get();

        if (userSnap.exists) {
          const currentNoShows  = (userSnap.data() as { noShowCount?: number }).noShowCount ?? 0;
          const newNoShowCount  = currentNoShows + 1;

          const userUpdate: Record<string, unknown> = {
            noShowCount: FieldValue.increment(1),
            updatedAt:   nowTs,
          };

          if (newNoShowCount >= BAN_THRESHOLD) {
            userUpdate.reservationsBanned = true;

            const banNotif: NotificationDoc = {
              notifId:      `res_ban_${uid}_${nowTs.seconds}`,
              userId:       uid,
              type:         "reservation_no_show",
              title:        "Reservation Privilege Suspended",
              body:         "You have been suspended from making reservations due to repeated no-shows. Contact support to appeal.",
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
              .doc(banNotif.notifId)
              .set(banNotif);

            log.warn("reservations_markNoShows: user banned from reservations", {
              traceId: "cron_noshow_b8",
              userId:  uid,
              domain:  "reservations",
              eventId: res.reservationId,
            }, { noShowCount: newNoShowCount });
          }

          await userRef.update(userUpdate);
        }

        // 6. Release slot capacity (best-effort)
        if (res.slotId) {
          try {
            await releaseSlot(res.slotId, res.estId, db);
          } catch (slotErr) {
            log.warn("reservations_markNoShows: releaseSlot failed (non-fatal)", {
              traceId: "cron_noshow_b8",
              userId:  uid,
              domain:  "reservations",
              eventId: res.reservationId,
            }, { error: String(slotErr) });
          }
        }

        // 7. Reliability score stub — B12 hook
        // TODO: call decrementReliabilityScore(uid) when B12 UserTrustEngine is ready.

        processed++;
      } catch (err) {
        errors++;
        log.error("reservations_markNoShows: failed to process reservation", {
          traceId: "cron_noshow_b8",
          userId:  uid,
          domain:  "reservations",
          eventId: res.reservationId,
        }, { error: String(err) });
      }
    }

    log.info("reservations_markNoShows: complete", {
      traceId: "cron_noshow_b8",
      domain:  "reservations",
      eventId: `noshow_${now}`,
    }, { processed, errors });
  }
);
