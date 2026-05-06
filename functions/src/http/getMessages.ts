/**
 * getMessages.ts — Callable: paginated message history for a conversation thread.
 *
 * - Cursor-based pagination via beforeMessageId (load-older pattern).
 * - Returns messages in ascending sentAt order (oldest first) for display.
 * - Marks the conversation as read for the caller (unreadCounts[uid] = 0).
 *
 * Milestone: B8
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
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

const DEFAULT_PAGE_SIZE = 30;   // RC: messages_page_size
const MAX_PAGE_SIZE     = 100;  // RC: messages_page_size_max

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetMessagesSchema = z.object({
  conversationId:  z.string().min(1),
  limit:           z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  beforeMessageId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getMessages = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = GetMessagesSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { conversationId, limit, beforeMessageId } = parseResult.data;

  const db = getFirestore();

  log.info("getMessages: start", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: `msgs_${conversationId}`,
  }, { conversationId, limit });

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

  // ---------------------------------------------------------------------------
  // Build query (DESC for cursor efficiency; reversed for display)
  // ---------------------------------------------------------------------------

  const messagesRef = db
    .collection(CONVERSATIONS_COLLECTION)
    .doc(conversationId)
    .collection(MESSAGES_SUBCOLLECTION);

  let query = messagesRef
    .orderBy("sentAt", "desc")
    .limit(limit);

  if (beforeMessageId) {
    const cursorSnap = await messagesRef.doc(beforeMessageId).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();

  // Reverse to ascending order for display (oldest → newest)
  const messages = snap.docs
    .map((d) => d.data() as MessageDoc)
    .reverse()
    .map((m) => ({
      messageId:        m.messageId,
      senderUid:        m.senderUid,
      text:             m.isDeleted ? "[Message deleted]" : m.text,
      mediaUrls:        m.isDeleted ? [] : m.mediaUrls,
      isRead:           m.isRead,
      readAt:           m.readAt?.toDate().toISOString() ?? null,
      sentAt:           m.sentAt.toDate().toISOString(),
      isDeleted:        m.isDeleted,
      isModerated:      m.isModerated,
    }));

  // ---------------------------------------------------------------------------
  // Mark conversation as read for caller
  // ---------------------------------------------------------------------------

  await db.doc(Paths.conversation(conversationId)).update({
    [`unreadCounts.${uid}`]: 0,
  });

  log.info("getMessages: complete", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: `msgs_${conversationId}`,
  }, { count: messages.length });

  return { messages, count: messages.length };
});
