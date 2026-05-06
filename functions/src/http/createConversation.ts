/**
 * createConversation.ts — Callable: create or retrieve a 1:1 conversation thread.
 *
 * Gating rules (SOW §3.1):
 *   User ↔ User:       Mutual follow required.
 *   User → Business:   Always allowed (user can always contact a business).
 *   Business → User:   Allowed but limited to 1 intro message until user replies.
 *   Entertainer ↔ *:  Treated as User ↔ User (mutual follow required).
 *
 * participantUids are always stored sorted (lexicographic) to enable canonical dedup.
 *
 * Milestone: B8
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ConversationDoc,
  ConversationType,
  ParticipantInfo,
  UserDoc,
  CONVERSATIONS_COLLECTION,
  Paths,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUSINESS_INTRO_LIMIT = 1; // RC: messaging.businessIntroLimit

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const CreateConversationSchema = z.object({
  recipientUid: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Determine conversation type based on caller and recipient account types. */
function resolveConversationType(
  callerAccountType: string | undefined,
  recipientAccountType: string | undefined
): ConversationType {
  const isBusiness = (t?: string) => t === "business";
  const isEntertainer = (t?: string) => t === "entertainer";

  if (isBusiness(callerAccountType)) return "business_user";
  if (isBusiness(recipientAccountType)) return "user_business";
  if (isEntertainer(callerAccountType) || isEntertainer(recipientAccountType)) return "entertainer_user";
  return "user_user";
}

/** Canonical conversation ID derived from sorted participant UIDs. */
function canonicalConversationId(uidA: string, uidB: string): string {
  const sorted = [uidA, uidB].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const createConversation = onCall(async (request) => {
  const traceId = newTraceId();

  // Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  // Input validation
  const parseResult = CreateConversationSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { recipientUid } = parseResult.data;

  if (recipientUid === uid) {
    throw new HttpsError("invalid-argument", "Cannot start a conversation with yourself.");
  }

  const db = getFirestore();

  log.info("createConversation: start", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: `create_${uid}_${recipientUid}`,
  });

  // ---------------------------------------------------------------------------
  // Load both user docs
  // ---------------------------------------------------------------------------

  const [callerSnap, recipientSnap] = await Promise.all([
    db.doc(Paths.user(uid)).get(),
    db.doc(Paths.user(recipientUid)).get(),
  ]);

  if (!callerSnap.exists) {
    throw new HttpsError("not-found", "Caller profile not found.");
  }
  if (!recipientSnap.exists) {
    throw new HttpsError("not-found", "Recipient not found.");
  }

  const caller = callerSnap.data() as UserDoc & { accountType?: string; following?: string[] };
  const recipient = recipientSnap.data() as UserDoc & { accountType?: string; following?: string[] };

  // ---------------------------------------------------------------------------
  // Determine conversation type and apply gating rules
  // ---------------------------------------------------------------------------

  const conversationType = resolveConversationType(caller.accountType, recipient.accountType);

  if (conversationType === "user_user" || conversationType === "entertainer_user") {
    // Mutual follow required
    const callerFollowsRecipient = Array.isArray(caller.following) && caller.following.includes(recipientUid);
    const recipientFollowsCaller = Array.isArray(recipient.following) && recipient.following.includes(uid);

    if (!callerFollowsRecipient || !recipientFollowsCaller) {
      throw new HttpsError(
        "failed-precondition",
        "You must follow each other to start a conversation."
      );
    }
  }

  // Business → User: no mutual follow required at creation;
  // the 1-msg gate is enforced in sendMessage.
  // User → Business: always allowed — no gate here.

  // ---------------------------------------------------------------------------
  // Check if conversation already exists (canonical sorted UID pair)
  // ---------------------------------------------------------------------------

  const sortedUids = [uid, recipientUid].sort();
  const conversationId = canonicalConversationId(uid, recipientUid);

  const existingSnap = await db
    .collection(CONVERSATIONS_COLLECTION)
    .where("participantUids", "==", sortedUids)
    .limit(1)
    .get();

  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0].data() as ConversationDoc;
    log.info("createConversation: existing thread returned", {
      traceId,
      userId: uid,
      domain: "messaging",
      eventId: existing.conversationId,
    });
    return { conversationId: existing.conversationId, isNew: false };
  }

  // ---------------------------------------------------------------------------
  // Create new conversation
  // ---------------------------------------------------------------------------

  const now = Timestamp.now();

  const participantInfo: Record<string, ParticipantInfo> = {
    [uid]: {
      displayName: caller.displayName,
      photoUrl: caller.photoUrl ?? null,
    },
    [recipientUid]: {
      displayName: recipient.displayName,
      photoUrl: recipient.photoUrl ?? null,
    },
  };

  const conversationDoc: ConversationDoc = {
    conversationId,
    participantUids: sortedUids,
    participantInfo,
    conversationType,
    lastMessageText: null,
    lastMessageAt: null,
    lastMessageSenderUid: null,
    unreadCounts: { [uid]: 0, [recipientUid]: 0 },
    businessInitiatedMessageCount: 0,
    lastRepliedByUid: null,
    createdAt: now,
    updatedAt: now,
  };

  // Business intro limit sanity: if business is initiating, note so the gate in sendMessage fires
  if (conversationType === "business_user") {
    // Check if business has already sent the intro message limit before a reply.
    // At creation time the count is 0 — the gate triggers on send, not create.
    // Informational: log if the limit is about to apply.
    log.info("createConversation: business-initiated thread created", {
      traceId,
      userId: uid,
      domain: "messaging",
      eventId: conversationId,
    }, { introLimit: BUSINESS_INTRO_LIMIT });
  }

  await db.doc(Paths.conversation(conversationId)).set(conversationDoc);

  log.info("createConversation: new thread created", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: conversationId,
  }, { conversationType });

  return { conversationId, isNew: true };
});
