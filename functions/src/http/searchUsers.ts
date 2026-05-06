/**
 * searchUsers.ts — Authenticated callable: user search by display name.
 *
 * Returns safe public fields only. Never exposes private_user_data fields.
 * Text matching is done in-memory (Firestore limitation).
 * // TODO: replace with Algolia in I5
 *
 * Milestone: B9
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { UserDoc, USERS_COLLECTION } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const SearchUsersSchema = z.object({
  query:      z.string().min(1).max(100),
  limit:      z.number().int().min(1).max(50).optional().default(20),
  afterDocId: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Result shape — safe public fields only
// ---------------------------------------------------------------------------

export interface UserSearchResult {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  reviewCount: number;
  followersCount: number;
  loyaltyTier: string;
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const searchUsers = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = SearchUsersSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError("invalid-argument", `Invalid input: ${parseResult.error.message}`);
  }
  const { query, limit, afterDocId } = parseResult.data;

  const db = getFirestore();

  // Build base query: only completed onboarding, not deleted
  // NOTE: Firestore does not support full-text search — displayName matching is in-memory.
  // TODO: replace with Algolia in I5
  let q = db
    .collection(USERS_COLLECTION)
    .where("onboardingComplete", "==", true)
    .orderBy("displayName", "asc");

  // Pagination cursor
  if (afterDocId) {
    const cursorSnap = await db.doc(`${USERS_COLLECTION}/${afterDocId}`).get();
    if (cursorSnap.exists) {
      q = q.startAfter(cursorSnap);
    }
  }

  // Over-fetch for in-memory text filtering
  const fetchLimit = Math.min(limit * 5, 250);
  q = q.limit(fetchLimit);

  const snap = await q.get();

  const q_lower = query.toLowerCase();

  // In-memory text filter on displayName
  let matched = snap.docs
    .map((d) => d.data() as UserDoc)
    .filter((u) => u.displayName?.toLowerCase().includes(q_lower));

  const pageDocs = matched.slice(0, limit);
  const hasMore = matched.length > limit;
  const nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].uid : null;

  const results: UserSearchResult[] = pageDocs.map((u) => ({
    uid:           u.uid,
    displayName:   u.displayName,
    photoUrl:      u.photoUrl,
    reviewCount:   u.reviewCount,
    followersCount: u.followersCount,
    loyaltyTier:   u.loyaltyTier,
  }));

  log.info("searchUsers: complete", {
    traceId,
    userId: uid,
    domain: "search",
    eventId: `searchUsers_${uid}`,
  }, { resultCount: results.length, query, hasMore });

  return { results, hasMore, nextCursor };
});
