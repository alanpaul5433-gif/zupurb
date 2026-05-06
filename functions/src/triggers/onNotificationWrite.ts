/**
 * onNotificationWrite.ts — Firestore trigger on notifications/{uid}/items/{nid}.
 *
 * On create:
 *   - Increment users/{uid}.unreadNotificationCount by 1.
 *
 * Decrement is handled by markNotificationsRead callable.
 *
 * Milestone: B10
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { NotificationDoc, Paths } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

export const onNotificationWrite = onDocumentCreated(
  "notifications/{uid}/items/{nid}",
  async (event) => {
    const traceId = newTraceId();
    const { uid, nid } = event.params;

    const notif = event.data?.data() as NotificationDoc | undefined;

    // If the notification is immediately marked deleted (edge case), skip counter
    if (!notif || notif.isDeleted) {
      return;
    }

    const db = getFirestore();

    try {
      await db.doc(Paths.user(uid)).update({
        unreadNotificationCount: FieldValue.increment(1),
      });

      log.info("onNotificationWrite: unread count incremented", {
        traceId,
        userId: uid,
        domain: "notifications",
        eventId: nid,
      }, { type: notif.type });
    } catch (err) {
      // Non-fatal: unread counter is a convenience cache; never block notification delivery
      log.warn("onNotificationWrite: failed to increment unread count", {
        traceId,
        userId: uid,
        domain: "notifications",
        eventId: nid,
      }, { error: String(err) });
    }
  }
);
