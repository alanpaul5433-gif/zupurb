/**
 * onMessageWrite.ts — Firestore trigger on conversations/{id}/messages/{id}.
 *
 * On create:
 *   1. Run async content moderation stub; if flagged → mark isModerated, alert admin queue.
 *   2. Update users/{senderUid}.lastActiveAt.
 *
 * On soft-delete (isDeleted transitions to true): log for audit.
 *
 * Milestone: B8
 */

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  MessageDoc,
  AdminQueueItemDoc,
  ADMIN_QUEUE_COLLECTION,
  Paths,
} from "../lib/schema";
import { moderateContent } from "../lib/moderation";
import { log, newTraceId } from "../lib/logging";

export const onMessageWrite = onDocumentWritten(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const traceId = newTraceId();
    const { conversationId, messageId } = event.params;

    const before = event.data?.before?.data() as MessageDoc | undefined;
    const after  = event.data?.after?.data()  as MessageDoc | undefined;

    // Message was hard-deleted (should never happen; log as anomaly)
    if (!after) {
      log.warn("onMessageWrite: message hard-deleted (should not occur)", {
        traceId,
        domain: "messaging",
        eventId: messageId,
      }, { conversationId });
      return;
    }

    const db = getFirestore();

    // -------------------------------------------------------------------------
    // CREATE path
    // -------------------------------------------------------------------------

    const isCreate = !before;
    if (isCreate) {
      const senderUid = after.senderUid;

      // Update lastActiveAt on sender profile
      try {
        await db.doc(Paths.user(senderUid)).update({
          lastActiveAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        // Non-fatal: field may not exist yet on older docs
        log.warn("onMessageWrite: failed to update lastActiveAt", {
          traceId,
          userId: senderUid,
          domain: "messaging",
          eventId: messageId,
        }, { err: String(err) });
      }

      // Content moderation (async, non-blocking for message delivery)
      if (!after.isDeleted && !after.isModerated) {
        try {
          const modResult = await moderateContent(after.text);
          if (modResult.flagged) {
            const msgRef = db
              .collection("conversations")
              .doc(conversationId)
              .collection("messages")
              .doc(messageId);

            await msgRef.update({
              isModerated:      true,
              moderationResult: modResult,
            } as Partial<MessageDoc>);

            // Alert admin queue
            const queueItemId = `mod_msg_${messageId}`;
            const queueItem: AdminQueueItemDoc = {
              queueItemId,
              type:        "content_flag",
              priority:    "p1",
              targetId:    messageId,
              targetType:  "message",
              summary:     `Message flagged by auto-moderation. Reason: ${modResult.reason ?? "unspecified"}. Conversation: ${conversationId}`,
              assignedTo:  null,
              status:      "pending",
              resolvedAt:  null,
              createdAt:   Timestamp.now(),
            };
            await db
              .collection(ADMIN_QUEUE_COLLECTION)
              .doc(queueItemId)
              .set(queueItem);

            log.warn("onMessageWrite: message flagged by moderation", {
              traceId,
              userId: senderUid,
              domain: "messaging",
              eventId: messageId,
            }, { conversationId, reason: modResult.reason });
          }
        } catch (err) {
          log.error("onMessageWrite: moderation check failed", {
            traceId,
            userId: senderUid,
            domain: "messaging",
            eventId: messageId,
          }, { err: String(err) });
        }
      }

      log.info("onMessageWrite: message created", {
        traceId,
        userId: senderUid,
        domain: "messaging",
        eventId: messageId,
      }, { conversationId });
      return;
    }

    // -------------------------------------------------------------------------
    // SOFT DELETE path
    // -------------------------------------------------------------------------

    const softDeleted = !before?.isDeleted && after.isDeleted;
    if (softDeleted) {
      log.info("onMessageWrite: message soft-deleted (audit)", {
        traceId,
        userId: after.deletedBy ?? "unknown",
        domain: "messaging",
        eventId: messageId,
      }, { conversationId, deletedBy: after.deletedBy });
    }
  }
);
