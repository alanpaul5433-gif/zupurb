/**
 * sendReservationReminders.ts — Scheduled job (every 30 minutes) to send
 * 24-hour and 2-hour advance reminders for confirmed reservations.
 *
 * 24h window:  scheduledAt between now + 23h and now + 25h, reminder24hSent != true.
 * 2h  window:  scheduledAt between now + 1h45m and now + 2h15m, reminder2hSent != true.
 *
 * Milestone: B7
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  ReservationDoc,
  NotificationDoc,
  RESERVATIONS_COLLECTION,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
} from "../lib/schema";
import { log } from "../lib/logging";

setGlobalOptions({ timeoutSeconds: 540, memory: "256MiB" });

// ---------------------------------------------------------------------------
// Scheduled function — runs every 30 minutes
// ---------------------------------------------------------------------------

export const sendReservationReminders = onSchedule(
  { schedule: "every 30 minutes", timeoutSeconds: 540, memory: "256MiB" },
  async () => {
    const db  = getFirestore();
    const now = Date.now();

    log.info("sendReservationReminders: start", {
      traceId: "cron_reminders",
      domain:  "reservations",
      eventId: `reminders_${now}`,
    });

    const HOUR  = 60 * 60 * 1000;
    const nowTs = Timestamp.now();

    let total24h = 0;
    let total2h  = 0;

    // -------------------------------------------------------------------------
    // 24-hour reminder window: now + 23h → now + 25h
    // -------------------------------------------------------------------------

    const window24hStart = Timestamp.fromMillis(now + 23 * HOUR);
    const window24hEnd   = Timestamp.fromMillis(now + 25 * HOUR);

    const snap24h = await db
      .collection(RESERVATIONS_COLLECTION)
      .where("status", "==", "confirmed")
      .where("scheduledAt", ">=", window24hStart)
      .where("scheduledAt", "<=", window24hEnd)
      .where("reminder24hSent", "==", false)
      .get();

    for (const doc of snap24h.docs) {
      const res = doc.data() as ReservationDoc;
      const uid = res.guestUid;

      try {
        const timeStr = res.scheduledAt.toDate().toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit",
        });

        const notifId = `reminder24h_${res.reservationId}`;
        const notif: NotificationDoc = {
          notifId,
          userId:       uid,
          type:         "reservation_reminder_24h",
          title:        "Reservation Tomorrow",
          body:         `Reminder: You have a reservation at ${res.estName} tomorrow at ${timeStr}.`,
          deepLinkPath: `/reservations/${res.reservationId}`,
          imageUrl:     null,
          payload:      { reservationId: res.reservationId, estId: res.estId },
          isRead:       false,
          readAt:       null,
          createdAt:    nowTs,
        };

        await db
          .collection(NOTIFICATIONS_COLLECTION)
          .doc(uid)
          .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
          .doc(notifId)
          .set(notif);

        await doc.ref.update({
          reminder24hSent: true,
          updatedAt:       nowTs,
        });

        total24h++;
      } catch (err) {
        log.error("sendReservationReminders: 24h reminder failed", {
          traceId: "cron_reminders",
          userId:  uid,
          domain:  "reservations",
          eventId: res.reservationId,
        }, { error: String(err) });
      }
    }

    // -------------------------------------------------------------------------
    // 2-hour reminder window: now + 1h45m → now + 2h15m
    // -------------------------------------------------------------------------

    const window2hStart = Timestamp.fromMillis(now + 1 * HOUR + 45 * 60 * 1000);
    const window2hEnd   = Timestamp.fromMillis(now + 2 * HOUR + 15 * 60 * 1000);

    const snap2h = await db
      .collection(RESERVATIONS_COLLECTION)
      .where("status", "==", "confirmed")
      .where("scheduledAt", ">=", window2hStart)
      .where("scheduledAt", "<=", window2hEnd)
      .where("reminder2hSent", "==", false)
      .get();

    for (const doc of snap2h.docs) {
      const res = doc.data() as ReservationDoc;
      const uid = res.guestUid;

      try {
        const timeStr = res.scheduledAt.toDate().toLocaleTimeString("en-US", {
          hour: "numeric", minute: "2-digit",
        });

        const notifId = `reminder2h_${res.reservationId}`;
        const notif: NotificationDoc = {
          notifId,
          userId:       uid,
          type:         "reservation_reminder_2h",
          title:        "Reservation Coming Up",
          body:         `Reminder: Your reservation at ${res.estName} is at ${timeStr} — coming up in about 2 hours.`,
          deepLinkPath: `/reservations/${res.reservationId}`,
          imageUrl:     null,
          payload:      { reservationId: res.reservationId, estId: res.estId },
          isRead:       false,
          readAt:       null,
          createdAt:    nowTs,
        };

        await db
          .collection(NOTIFICATIONS_COLLECTION)
          .doc(uid)
          .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
          .doc(notifId)
          .set(notif);

        await doc.ref.update({
          reminder2hSent: true,
          updatedAt:      nowTs,
        });

        total2h++;
      } catch (err) {
        log.error("sendReservationReminders: 2h reminder failed", {
          traceId: "cron_reminders",
          userId:  uid,
          domain:  "reservations",
          eventId: res.reservationId,
        }, { error: String(err) });
      }
    }

    log.info("sendReservationReminders: complete", {
      traceId: "cron_reminders",
      domain:  "reservations",
      eventId: `reminders_${now}`,
    }, { total24h, total2h });
  }
);
