/**
 * messaging.ts — Messaging gate, send, and conversation list.
 *
 * Gate rules (SOW §3.1 / ARCHITECTURE.md):
 *   User→User:      mutual follow required (uses isMutualFollow helper from follow.ts)
 *   Business→User:  allowed once (intro) without follow; user must reply to continue
 *   User→Business:  always allowed
 *
 * Callables:
 *   canSendMessage   — returns { allowed, reason? }
 *   getConversations — paginated conversation list for calling user (supersedes B8 stub)
 *   sendMessage      — validates gate, writes message + updates conversation
 *
 * Milestone: B10
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ConversationDoc,
  MessageDoc,
  UserDoc,
  PrivateUserDataDoc,
  CONVERSATIONS_COLLECTION,
  MESSAGES_SUBCOLLECTION,
  Paths,
} from "../lib/schema";
import { isMutualFollow } from "./follow";
import { sendNotification } from "./notifications";
import { moderateContent } from "../lib/moderation";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUSINESS_INTRO_LIMIT = 1;    // RC: messaging.businessIntroLimit
const MESSAGE_MAX_LENGTH   = 2000; // RC: message_max_length
const DEFAULT_PAGE_SIZE    = 20;
const MAX_PAGE_SIZE        = 50;

// ---------------------------------------------------------------------------
// canSendMessage — exported helper + callable
// ---------------------------------------------------------------------------

/**
 * Core gate logic — usable as an imported helper or exposed as a callable.
 *
 * @param senderUid     UID of the message sender
 * @param recipientUid  UID of the intended recipient
 * @param db            Firestore instance
 * @param conv          Existing conversation doc (if any) — used for business gate replay
 */
export async function canSendMessage(
  senderUid: string,
  recipientUid: string,
  db: FirebaseFirestore.Firestore,
  conv?: ConversationDoc
): Promise<{ allowed: boolean; reason?: string }> {
  // Load both user docs (for accountType)
  const [senderSnap, recipientSnap] = await Promise.all([
    db.doc(Paths.user(senderUid)).get(),
    db.doc(Paths.user(recipientUid)).get(),
  ]);

  if (!senderSnap.exists)    return { allowed: false, reason: "Sender not found." };
  if (!recipientSnap.exists) return { allowed: false, reason: "Recipient not found." };

  const sender    = senderSnap.data() as UserDoc;
  const recipient = recipientSnap.data() as UserDoc;

  const senderType    = sender.accountType ?? "user";
  const recipientType = recipient.accountType ?? "user";

  // User → Business: always allowed
  if (senderType === "user" && recipientType === "business") {
    return { allowed: true };
  }

  // Business → User: 1 intro message; gate lifts once user replies
  if (senderType === "business") {
    if (!conv) return { allowed: true }; // first message = creating thread; allowed
    const noReply = conv.lastRepliedByUid === null || conv.lastRepliedByUid === senderUid;
    if (conv.businessInitiatedMessageCount >= BUSINESS_INTRO_LIMIT && noReply) {
      return { allowed: false, reason: "Businesses can only send one intro message until the recipient replies." };
    }
    return { allowed: true };
  }

  // User → User (and entertainer variants): mutual follow required
  const mutual = await isMutualFollow(senderUid, recipientUid, db);
  if (!mutual) {
    return { allowed: false, reason: "You must follow each other to send a message." };
  }
  return { allowed: true };
}

// Callable version of canSendMessage
const CanSendMessageSchema = z.object({
  recipientUid: z.string().min(1),
});

export const canSendMessageCallable = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const senderUid = request.auth.uid;

  const parsed = CanSendMessageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { recipientUid } = parsed.data;
  const db = getFirestore();

  const result = await canSendMessage(senderUid, recipientUid, db);

  log.info("canSendMessage: checked", {
    traceId, userId: senderUid, domain: "messaging", eventId: `gate_${senderUid}_${recipientUid}`,
  }, { allowed: result.allowed, reason: result.reason });

  return result;
});

// ---------------------------------------------------------------------------
// getConversations (B10 canonical; supersedes http/getConversations B8 stub)
// ---------------------------------------------------------------------------

const GetConversationsSchema = z.object({
  limit:   z.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
  afterId: z.string().optional(),
  filter:  z.enum(["all", "users", "businesses", "entertainers"]).optional().default("all"),
});

function filterToTypes(filter: string): string[] | null {
  switch (filter) {
    case "users":        return ["user_user"];
    case "businesses":   return ["user_business", "business_user"];
    case "entertainers": return ["entertainer_user"];
    default:             return null;
  }
}

export const getConversationsSocial = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const uid = request.auth.uid;

  const parsed = GetConversationsSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { limit, afterId, filter } = parsed.data;
  const db = getFirestore();

  let q = db
    .collection(CONVERSATIONS_COLLECTION)
    .where("participantUids", "array-contains", uid)
    .orderBy("lastMessageAt", "desc")
    .limit(limit);

  if (afterId) {
    const cursor = await db.collection(CONVERSATIONS_COLLECTION).doc(afterId).get();
    if (cursor.exists) q = q.startAfter(cursor);
  }

  const snap = await q.get();
  let conversations = snap.docs.map((d) => d.data() as ConversationDoc);

  // In-memory type filter (Firestore array-contains + where on same field not supported)
  const types = filterToTypes(filter);
  if (types) {
    conversations = conversations.filter((c) => types.includes(c.conversationType));
  }

  const result = conversations.map((c) => ({
    conversationId:       c.conversationId,
    conversationType:     c.conversationType,
    participantInfo:      c.participantInfo,
    lastMessageText:      c.lastMessageText,
    lastMessageAt:        c.lastMessageAt?.toDate().toISOString() ?? null,
    lastMessageSenderUid: c.lastMessageSenderUid,
    unreadCount:          c.unreadCounts[uid] ?? 0,
    createdAt:            c.createdAt.toDate().toISOString(),
  }));

  log.info("getConversationsSocial: complete", {
    traceId, userId: uid, domain: "messaging", eventId: `convs_${uid}`,
  }, { count: result.length });

  return { conversations: result, count: result.length };
});

// ---------------------------------------------------------------------------
// sendMessageSocial — gate-validated send (B10 canonical; supersedes B8 stub)
// ---------------------------------------------------------------------------

const SendMessageSchema = z.object({
  conversationId: z.string().min(1),
  text:           z.string().min(1).max(MESSAGE_MAX_LENGTH),
  mediaUrls:      z.array(z.string().url()).max(10).optional(),
  idempotencyKey: z.string().min(1).max(128),
});

export const sendMessageSocial = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const uid = request.auth.uid;

  const parsed = SendMessageSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { conversationId, text, mediaUrls, idempotencyKey } = parsed.data;

  const db = getFirestore();

  log.info("sendMessageSocial: start", {
    traceId, userId: uid, domain: "messaging", eventId: `send_${uid}_${conversationId}`,
  }, { conversationId });

  // Ban check
  const privSnap = await db.doc(Paths.privateUserData(uid)).get();
  if (privSnap.exists && (privSnap.data() as PrivateUserDataDoc).isBanned) {
    throw new HttpsError("permission-denied", "Your account has been suspended.");
  }

  // Load conversation
  const convSnap = await db.doc(Paths.conversation(conversationId)).get();
  if (!convSnap.exists) throw new HttpsError("not-found", "Conversation not found.");
  const conv = convSnap.data() as ConversationDoc;

  if (!conv.participantUids.includes(uid)) {
    throw new HttpsError("permission-denied", "You are not a participant in this conversation.");
  }

  // Idempotency
  const existingSnap = await db
    .collection(CONVERSATIONS_COLLECTION)
    .doc(conversationId)
    .collection(MESSAGES_SUBCOLLECTION)
    .where("idempotencyKey", "==", idempotencyKey)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0].data() as MessageDoc;
    return { messageId: existing.messageId, sentAt: existing.sentAt.toDate().toISOString() };
  }

  // Messaging gate
  const recipientUid = conv.participantUids.find((p) => p !== uid) as string;
  const gate = await canSendMessage(uid, recipientUid, db, conv);
  if (!gate.allowed) {
    throw new HttpsError("failed-precondition", gate.reason ?? "Cannot send message.");
  }

  // Content moderation
  const modResult = await moderateContent(text, traceId);

  // Write message
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

  // Update conversation metadata
  const senderSnap = await db.doc(Paths.user(uid)).get();
  const senderData = senderSnap.data() as UserDoc | undefined;
  const isBusinessSender = senderData?.accountType === "business";

  const convUpdate: Record<string, unknown> = {
    lastMessageText:                     text.substring(0, 100),
    lastMessageAt:                       now,
    lastMessageSenderUid:                uid,
    updatedAt:                           now,
    [`unreadCounts.${recipientUid}`]:    FieldValue.increment(1),
  };

  if (isBusinessSender && conv.conversationType === "business_user") {
    convUpdate["businessInitiatedMessageCount"] = FieldValue.increment(1);
  }
  if (conv.conversationType === "business_user" && !isBusinessSender) {
    convUpdate["lastRepliedByUid"] = uid;
  }

  await db.doc(Paths.conversation(conversationId)).update(convUpdate);

  // Notification via sendNotification (B10 canonical)
  const senderName = senderData?.displayName ?? "Someone";
  try {
    await sendNotification(recipientUid, {
      type: "new_message",
      title: `New message from ${senderName}`,
      body: text.substring(0, 80),
      relatedEntityId: conversationId,
      relatedEntityType: "conversation",
      data: { conversationId, senderUid: uid },
    });
  } catch (err) {
    log.warn("sendMessageSocial: notification failed (non-fatal)", {
      traceId, userId: uid, domain: "messaging", eventId: messageId,
    }, { error: String(err) });
  }

  log.info("sendMessageSocial: complete", {
    traceId, userId: uid, domain: "messaging", eventId: messageId,
  }, { conversationId, moderated: modResult.flagged });

  return { messageId, sentAt: now.toDate().toISOString() };
});
