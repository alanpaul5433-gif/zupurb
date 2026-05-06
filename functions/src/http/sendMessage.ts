/**
 * sendMessage.ts — Callable: send a message in an existing conversation thread.
 *
 * Business 1-msg gate (SOW §3.1):
 *   Business may send only 1 intro message until the recipient replies.
 *   Once the recipient replies (lastRepliedByUid is set), the gate is lifted.
 *
 * Idempotent: duplicate calls with the same idempotencyKey return the existing message.
 *
 * Milestone: B8
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ConversationDoc,
  MessageDoc,
  NotificationDoc,
  UserDoc,
  PrivateUserDataDoc,
  CONVERSATIONS_COLLECTION,
  MESSAGES_SUBCOLLECTION,
  NOTIFICATIONS_COLLECTION,
  NOTIFICATIONS_ITEMS_SUBCOLLECTION,
  Paths,
} from "../lib/schema";
import { moderateContent } from "../lib/moderation";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MESSAGE_MAX_LENGTH    = 2000; // RC: message_max_length
const BUSINESS_INTRO_LIMIT  = 1;    // RC: messaging.businessIntroLimit

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const SendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text:           z.string().min(1).max(MESSAGE_MAX_LENGTH),
  mediaUrls:      z.array(z.string().url()).max(10).optional(),
  idempotencyKey: z.string().min(1).max(128),
});

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const sendMessage = onCall(async (request) => {
  const traceId = newTraceId();

  // Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  // Input validation
  const parseResult = SendMessageSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { conversationId, text, mediaUrls, idempotencyKey } = parseResult.data;

  const db = getFirestore();

  log.info("sendMessage: start", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: `send_${uid}_${conversationId}`,
  }, { conversationId });

  // Ban check — banned users cannot send messages (B12)
  const privSnap = await db.doc(Paths.privateUserData(uid)).get();
  if (privSnap.exists) {
    const priv = privSnap.data() as PrivateUserDataDoc;
    if (priv.isBanned) {
      throw new HttpsError("permission-denied", "Your account has been suspended.");
    }
  }

  // ---------------------------------------------------------------------------
  // Load conversation — verify caller is a participant
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
  // Idempotency check
  // ---------------------------------------------------------------------------

  const idempotentSnap = await db
    .collection(CONVERSATIONS_COLLECTION)
    .doc(conversationId)
    .collection(MESSAGES_SUBCOLLECTION)
    .where("idempotencyKey", "==", idempotencyKey)
    .limit(1)
    .get();

  if (!idempotentSnap.empty) {
    const existingMsg = idempotentSnap.docs[0].data() as MessageDoc;
    log.info("sendMessage: idempotent return", {
      traceId,
      userId: uid,
      domain: "messaging",
      eventId: existingMsg.messageId,
    });
    return {
      messageId: existingMsg.messageId,
      sentAt: existingMsg.sentAt.toDate().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Determine sender account type (for business 1-msg gate)
  // ---------------------------------------------------------------------------

  const senderSnap = await db.doc(Paths.user(uid)).get();
  const senderData = senderSnap.data() as (UserDoc & { accountType?: string }) | undefined;
  const isBusinessSender = senderData?.accountType === "business";

  // ---------------------------------------------------------------------------
  // Business 1-msg gate re-check (SOW §3.1)
  // ---------------------------------------------------------------------------

  if (isBusinessSender && conv.conversationType === "business_user") {
    const noReplyYet = conv.lastRepliedByUid === null || conv.lastRepliedByUid === uid;
    if (conv.businessInitiatedMessageCount >= BUSINESS_INTRO_LIMIT && noReplyYet) {
      throw new HttpsError(
        "resource-exhausted",
        "Businesses can only send one introduction message until the recipient replies."
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Content moderation stub (real implementation in I9)
  // ---------------------------------------------------------------------------

  const modResult = await moderateContent(text, traceId);
  // If flagged, we still write the message but mark it as moderated.
  // Admin is alerted via the onMessageWrite trigger.

  // ---------------------------------------------------------------------------
  // Determine recipient uid
  // ---------------------------------------------------------------------------

  const recipientUid = conv.participantUids.find((p) => p !== uid) as string;

  // ---------------------------------------------------------------------------
  // Write message document
  // ---------------------------------------------------------------------------

  const now = Timestamp.now();
  const messageRef = db
    .collection(CONVERSATIONS_COLLECTION)
    .doc(conversationId)
    .collection(MESSAGES_SUBCOLLECTION)
    .doc();
  const messageId = messageRef.id;

  const messageDoc: MessageDoc = {
    messageId,
    conversationId,
    senderUid:        uid,
    text,
    mediaUrls:        mediaUrls ?? [],
    isRead:           false,
    readAt:           null,
    sentAt:           now,
    idempotencyKey,
    isModerated:      modResult.flagged,
    moderationResult: modResult.flagged ? modResult : null,
    isDeleted:        false,
    deletedAt:        null,
    deletedBy:        null,
  };

  await messageRef.set(messageDoc);

  // ---------------------------------------------------------------------------
  // Update conversation metadata (batch for atomicity)
  // ---------------------------------------------------------------------------

  const convUpdate: Record<string, unknown> = {
    lastMessageText:        text.substring(0, 100),
    lastMessageAt:          now,
    lastMessageSenderUid:   uid,
    updatedAt:              now,
    [`unreadCounts.${recipientUid}`]: FieldValue.increment(1),
  };

  if (isBusinessSender && conv.conversationType === "business_user") {
    convUpdate["businessInitiatedMessageCount"] = FieldValue.increment(1);
  }

  // If the sender is the non-business user replying to a business-initiated thread
  const isUserReplyingToBusiness =
    conv.conversationType === "business_user" && !isBusinessSender;
  if (isUserReplyingToBusiness) {
    convUpdate["lastRepliedByUid"] = uid;
  }

  await db.doc(Paths.conversation(conversationId)).update(convUpdate);

  // ---------------------------------------------------------------------------
  // Notification for recipient
  // ---------------------------------------------------------------------------

  const notifId = `msg_${messageId}`;
  const senderName = senderData?.displayName ?? "Someone";
  const notif: NotificationDoc = {
    notifId,
    userId:       recipientUid,
    type:         "new_message",
    title:        `New message from ${senderName}`,
    body:         text.substring(0, 50),
    deepLinkPath: `/messages/${conversationId}`,
    imageUrl:     senderData?.photoUrl ?? null,
    payload:      { conversationId, senderUid: uid },
    isRead:       false,
    readAt:       null,
    createdAt:    now,
  };

  await db
    .collection(NOTIFICATIONS_COLLECTION)
    .doc(recipientUid)
    .collection(NOTIFICATIONS_ITEMS_SUBCOLLECTION)
    .doc(notifId)
    .set(notif);

  log.info("sendMessage: complete", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: messageId,
  }, { conversationId, moderated: modResult.flagged });

  return {
    messageId,
    sentAt: now.toDate().toISOString(),
  };
});
