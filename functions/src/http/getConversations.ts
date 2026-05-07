/**
 * getConversations.ts — Callable: paginated inbox of the caller's conversations.
 *
 * Ordered by lastMessageAt DESC.
 * Optional filter by conversationType bucket.
 *
 * Milestone: B8
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ConversationDoc,
  ConversationType,
  CONVERSATIONS_COLLECTION,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20; // RC: conversations_page_size
const MAX_PAGE_SIZE     = 50;

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const FilterLiteral = z.enum(["all", "users", "businesses", "entertainers"]);

const GetConversationsSchema = z.object({
  limit:   z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  afterId: z.string().optional(),
  filter:  FilterLiteral.default("all"),
});

// ---------------------------------------------------------------------------
// Map filter value to ConversationType array
// ---------------------------------------------------------------------------

function filterToTypes(filter: string): ConversationType[] | null {
  switch (filter) {
    case "users":        return ["user_user"];
    case "businesses":   return ["user_business", "business_user"];
    case "entertainers": return ["entertainer_user"];
    default:             return null; // "all" — no type filter
  }
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getConversations = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = GetConversationsSchema.safeParse(request.data ?? {});
  if (!parseResult.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parseResult.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { limit, afterId, filter } = parseResult.data;

  const db = getFirestore();

  log.info("getConversations: start", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: `list_${uid}`,
  }, { filter, limit });

  // ---------------------------------------------------------------------------
  // Build base query — participantUids array-contains uid
  // ---------------------------------------------------------------------------

  // Note: Firestore does not support array-contains combined with an additional
  // where clause on the same field in the same query. Filter by conversationType
  // is applied in-memory when types is non-null and the result set is small.
  // For scale, add composite index: participantUids + conversationType + lastMessageAt.

  let query = db
    .collection(CONVERSATIONS_COLLECTION)
    .where("participantUids", "array-contains", uid)
    .orderBy("lastMessageAt", "desc")
    .limit(limit);

  // Cursor-based pagination
  if (afterId) {
    const cursorSnap = await db
      .collection(CONVERSATIONS_COLLECTION)
      .doc(afterId)
      .get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  let conversations = snap.docs.map((d) => d.data() as ConversationDoc);

  // Apply conversationType filter in-memory
  const types = filterToTypes(filter);
  if (types) {
    conversations = conversations.filter((c) => types.includes(c.conversationType));
  }

  // ---------------------------------------------------------------------------
  // Shape the response
  // ---------------------------------------------------------------------------

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

  log.info("getConversations: complete", {
    traceId,
    userId: uid,
    domain: "messaging",
    eventId: `list_${uid}`,
  }, { count: result.length });

  return { conversations: result, count: result.length };
});
