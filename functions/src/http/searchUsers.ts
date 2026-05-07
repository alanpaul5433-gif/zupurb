/**
 * searchUsers.ts — Authenticated callable: user search by display name.
 *
 * Primary path:  Algolia full-text search on zupurb_users index (I5).
 * Fallback path: Firestore + in-memory text filter (when credentials absent).
 *
 * Returns safe public fields only. Never exposes private_user_data fields.
 *
 * Milestone: B9 + I5
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { UserDoc, USERS_COLLECTION } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";
import { getSearchClient, INDICES } from "../integrations/algolia/client";

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

export const searchUsers = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
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

  let results: UserSearchResult[] = [];
  let hasMore = false;
  let nextCursor: string | null = null;

  // ---------------------------------------------------------------------------
  // Algolia primary path
  // ---------------------------------------------------------------------------
  const algoliaClient = getSearchClient();
  if (algoliaClient) {
    try {
      const index = algoliaClient.initIndex(INDICES.users);
      const algoliaFilters = ""; // city filter reserved; UserDoc city not yet indexed
      const algoliaResult = await index.search<UserSearchResult>(query, {
        filters:     algoliaFilters,
        hitsPerPage: limit,
        page:        0,
      });

      results    = algoliaResult.hits as unknown as UserSearchResult[];
      hasMore    = algoliaResult.nbPages > 1;
      nextCursor = hasMore && results.length > 0 ? results[results.length - 1].uid : null;
    } catch (algoliaErr) {
      log.warn("searchUsers: Algolia search failed — falling back to Firestore", {
        traceId,
        domain: "search",
        eventId: `searchUsers_algoliaFallback_${uid}`,
      }, { error: (algoliaErr as Error).message });
      // results remains empty → fall through below
    }
  }

  // ---------------------------------------------------------------------------
  // Firestore fallback
  // ---------------------------------------------------------------------------
  if (results.length === 0) {
    let q = db
      .collection(USERS_COLLECTION)
      .where("onboardingComplete", "==", true)
      .orderBy("displayName", "asc");

    if (afterDocId) {
      const cursorSnap = await db.doc(`${USERS_COLLECTION}/${afterDocId}`).get();
      if (cursorSnap.exists) {
        q = q.startAfter(cursorSnap);
      }
    }

    const fetchLimit = Math.min(limit * 5, 250);
    q = q.limit(fetchLimit);

    const snap = await q.get();
    const q_lower = query.toLowerCase();

    const matched = snap.docs
      .map((d) => d.data() as UserDoc)
      .filter((u) => u.displayName?.toLowerCase().includes(q_lower));

    const pageDocs = matched.slice(0, limit);
    hasMore    = matched.length > limit;
    nextCursor = hasMore && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].uid : null;

    results = pageDocs.map((u) => ({
      uid:            u.uid,
      displayName:    u.displayName,
      photoUrl:       u.photoUrl,
      reviewCount:    u.reviewCount,
      followersCount: u.followersCount,
      loyaltyTier:    u.loyaltyTier,
    }));
  }

  log.info("searchUsers: complete", {
    traceId,
    userId: uid,
    domain: "search",
    eventId: `searchUsers_${uid}`,
  }, { resultCount: results.length, query, hasMore });

  return { results, hasMore, nextCursor };
});
