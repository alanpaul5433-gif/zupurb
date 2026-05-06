/**
 * deleteMessage.ts — Callable: soft-delete a chat message.
 *
 * Messages are NEVER hard-deleted — soft delete only (audit trail for moderation).
 * Soft delete replaces text with "[Message deleted]" and clears mediaUrls.
 *
 * Allowed by: message sender OR admin (custom claim).
 *
 * Milestone: B8
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ConversationDoc,
  MessageDoc,
  CONVERSATIONS_COLLECTION,
  MESSAGES_SUBCOLLECTION,
  Paths,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const DeleteMessageSchema = z.object({
  conversationId: z.string().min(1),
  messageId:      z.string().min(1),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const deleteMessage = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;
  const isAdmin = request.auth.token?.admin === true;

  const parseResult = DeleteMessageSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { conversationId, messageId } = parseResult.data;

  const db = getFirestore();

  log.info("deleteMessage: start", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: `del_${messageId}`,
  }, { conversationId });

  // ---------------------------------------------------------------------------
  // Verify caller is participant
  // ---------------------------------------------------------------------------

  const convSnap = await db.doc(Paths.conversation(conversationId)).get();
  if (!convSnap.exists) {
    throw new HttpsError("not-found", "Conversation not found.");
  }
  const conv = convSnap.data() as ConversationDoc;
  if (!conv.participantUids.includes(uid) && !isAdmin) {
    throw new HttpsError("permission-denied", "You are not a participant in this conversation.");
  }

  // ---------------------------------------------------------------------------
  // Load message
  // ---------------------------------------------------------------------------

  const msgRef = db
    .collection(CONVERSATIONS_COLLECTION)
    .doc(conversationId)
    .collection(MESSAGES_SUBCOLLECTION)
    .doc(messageId);

  const msgSnap = await msgRef.get();
  if (!msgSnap.exists) {
    throw new HttpsError("not-found", "Message not found.");
  }
  const msg = msgSnap.data() as MessageDoc;

  // Already deleted — idempotent
  if (msg.isDeleted) {
    return { messageId, deleted: true };
  }

  // ---------------------------------------------------------------------------
  // Authorization: only sender or admin can delete
  // ---------------------------------------------------------------------------

  if (msg.senderUid !== uid && !isAdmin) {
    throw new HttpsError("permission-denied", "You can only delete your own messages.");
  }

  // ---------------------------------------------------------------------------
  // Soft delete
  // ---------------------------------------------------------------------------

  const now = Timestamp.now();
  await msgRef.update({
    isDeleted:  true,
    deletedAt:  now,
    deletedBy:  uid,
    text:       "[Message deleted]",
    mediaUrls:  [],
  } as Partial<MessageDoc>);

  log.info("deleteMessage: complete", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: messageId,
  }, { conversationId, isAdmin });

  return { messageId, deleted: true };
});
