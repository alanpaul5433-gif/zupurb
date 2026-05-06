/**
 * markConversationRead.ts — Callable: mark all messages in a conversation as read.
 *
 * - Sets unreadCounts[callerUid] = 0 on the conversation doc.
 * - Batch-updates up to 500 unread messages from the other participant.
 *
 * Milestone: B8
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, WriteBatch } from "firebase-admin/firestore";
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
// Constants
// ---------------------------------------------------------------------------

const MAX_BATCH_SIZE = 500; // Firestore batch write limit

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const MarkReadSchema = z.object({
  conversationId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const markConversationRead = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = MarkReadSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { conversationId } = parseResult.data;

  const db = getFirestore();

  log.info("markConversationRead: start", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: `read_${conversationId}`,
  });

  // ---------------------------------------------------------------------------
  // Verify participant
  // ---------------------------------------------------------------------------

  const convSnap = await db.doc(Paths.conversation(conversationId)).get();
  if (!convSnap.exists) {
    throw new HttpsError("not-found", "Conversation not found.");
  }
  const conv = convSnap.data() as ConversationDoc;
  if (!conv.participantUids.includes(uid)) {
    throw new HttpsError("permission-denied", "You are not a participant in this conversation.");
  }

  const recipientUid = conv.participantUids.find((p) => p !== uid) as string;
  const now = Timestamp.now();

  // ---------------------------------------------------------------------------
  // Find unread messages from the other participant (max 500 for batch)
  // ---------------------------------------------------------------------------

  const unreadSnap = await db
    .collection(CONVERSATIONS_COLLECTION)
    .doc(conversationId)
    .collection(MESSAGES_SUBCOLLECTION)
    .where("senderUid", "==", recipientUid)
    .where("isRead", "==", false)
    .limit(MAX_BATCH_SIZE)
    .get();

  // ---------------------------------------------------------------------------
  // Batch update: mark messages read + clear unread count
  // ---------------------------------------------------------------------------

  const batch: WriteBatch = db.batch();

  // Clear unread counter on conversation doc
  batch.update(db.doc(Paths.conversation(conversationId)), {
    [`unreadCounts.${uid}`]: 0,
  });

  // Mark each unread message as read
  for (const doc of unreadSnap.docs) {
    batch.update(doc.ref, {
      isRead: true,
      readAt: now,
    } as Partial<MessageDoc>);
  }

  await batch.commit();

  log.info("markConversationRead: complete", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: `read_${conversationId}`,
  }, { messagesMarked: unreadSnap.size });

  return { messagesMarked: unreadSnap.size };
});
