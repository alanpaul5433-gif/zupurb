/**
 * searchContent.ts — Authenticated callable: content search (posts / reviews).
 *
 * Primary path:  Algolia search on zupurb_posts index (I5).
 * Fallback path: Firestore + in-memory text filter (when credentials absent).
 *
 * Milestone: B9 + I5
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import {
  PostDoc,
  ReviewDoc,
  POSTS_COLLECTION,
  REVIEWS_COLLECTION,
  UserDoc,
  Paths,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";
import { getSearchClient, INDICES } from "../integrations/algolia/client";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const SearchContentSchema = z.object({
  query:       z.string().min(1).max(200),
  contentType: z.enum(["post", "review"]).optional(),
  limit:       z.number().int().min(1).max(50).optional().default(20),
  afterDocId:  z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface ContentSearchResult {
  id: string;
  type: "post" | "review";
  authorUid: string;
  authorDisplayName: string;
  authorPhotoUrl: string | null;
  text: string | null;           // caption (post) or body (review)
  estId: string | null;
  createdAt: { seconds: number; nanoseconds: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthorInfo(db: FirebaseFirestore.Firestore, uid: string): Promise<{
  displayName: string;
  photoUrl: string | null;
}> {
  try {
    const snap = await db.doc(Paths.user(uid)).get();
    if (!snap.exists) return { displayName: "Unknown", photoUrl: null };
    const u = snap.data() as UserDoc;
    return { displayName: u.displayName, photoUrl: u.photoUrl };
  } catch {
    return { displayName: "Unknown", photoUrl: null };
  }
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const searchContent = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = SearchContentSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError("invalid-argument", `Invalid input: ${parseResult.error.message}`);
  }
  const { query, contentType, limit, afterDocId } = parseResult.data;

  const db = getFirestore();
  const q_lower = query.toLowerCase();

  const includePost   = !contentType || contentType === "post";
  const includeReview = !contentType || contentType === "review";
  const FETCH_LIMIT   = Math.min(limit * 4, 200);

  // ---------------------------------------------------------------------------
  // Algolia primary path — searches the zupurb_posts index.
  // Note: reviews are not yet a separate Algolia index; they fall through to
  // Firestore. If contentType === "post" or undefined, try Algolia first.
  // ---------------------------------------------------------------------------
  const algoliaClient = getSearchClient();

  let page: ContentSearchResult[] = [];
  let hasMore    = false;
  let nextCursor: string | null = null;

  if (algoliaClient && includePost) {
    try {
      const index = algoliaClient.initIndex(INDICES.posts);
      const filters = contentType === "post" ? "isActive:true" : "isActive:true";
      const algoliaResult = await index.search<ContentSearchResult>(query, {
        filters,
        hitsPerPage: limit,
        page:        0,
      });

      const hits = algoliaResult.hits as unknown as ContentSearchResult[];

      // If contentType restricted to post only, return Algolia results directly.
      if (contentType === "post") {
        page       = hits;
        hasMore    = algoliaResult.nbPages > 1;
        nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

        log.info("searchContent: complete (Algolia posts)", {
          traceId,
          userId: uid,
          domain: "search",
          eventId: `searchContent_${uid}`,
        }, { resultCount: page.length, query, contentType, hasMore });

        return { results: page, hasMore, nextCursor };
      }
    } catch (algoliaErr) {
      log.warn("searchContent: Algolia search failed — falling back to Firestore", {
        traceId,
        domain: "search",
        eventId: `searchContent_algoliaFallback_${uid}`,
      }, { error: (algoliaErr as Error).message });
      // fall through to Firestore below
    }
  }

  // ---------------------------------------------------------------------------
  // Firestore fallback (also used for reviews, and when Algolia unavailable)
  // ---------------------------------------------------------------------------

  async function searchPosts(): Promise<ContentSearchResult[]> {
    if (!includePost) return [];

    let q = db
      .collection(POSTS_COLLECTION)
      .where("isActive", "==", true)
      .orderBy("createdAt", "desc");

    if (afterDocId && contentType === "post") {
      const cursorSnap = await db.doc(`${POSTS_COLLECTION}/${afterDocId}`).get();
      if (cursorSnap.exists) q = q.startAfter(cursorSnap);
    }
    q = q.limit(FETCH_LIMIT);

    const snap = await q.get();
    const docs = snap.docs
      .map((d) => d.data() as PostDoc)
      .filter((p) => p.caption?.toLowerCase().includes(q_lower));

    return await Promise.all(
      docs.map(async (p) => {
        const author = await getAuthorInfo(db, p.authorUid);
        return {
          id:                p.postId,
          type:              "post" as const,
          authorUid:         p.authorUid,
          authorDisplayName: author.displayName,
          authorPhotoUrl:    author.photoUrl,
          text:              p.caption ?? null,
          estId:             p.estId ?? null,
          createdAt:         { seconds: p.createdAt.seconds, nanoseconds: p.createdAt.nanoseconds },
        };
      })
    );
  }

  async function searchReviews(): Promise<ContentSearchResult[]> {
    if (!includeReview) return [];

    let q = db
      .collection(REVIEWS_COLLECTION)
      .where("status", "in", ["published"])
      .orderBy("createdAt", "desc");

    if (afterDocId && contentType === "review") {
      const cursorSnap = await db.doc(`${REVIEWS_COLLECTION}/${afterDocId}`).get();
      if (cursorSnap.exists) q = q.startAfter(cursorSnap);
    }
    q = q.limit(FETCH_LIMIT);

    const snap = await q.get();
    const docs = snap.docs
      .map((d) => d.data() as ReviewDoc)
      .filter((r) =>
        r.body?.toLowerCase().includes(q_lower) ||
        r.title?.toLowerCase().includes(q_lower)
      );

    return await Promise.all(
      docs.map(async (r) => {
        const author = await getAuthorInfo(db, r.authorUid);
        return {
          id:                r.reviewId,
          type:              "review" as const,
          authorUid:         r.authorUid,
          authorDisplayName: author.displayName,
          authorPhotoUrl:    author.photoUrl,
          text:              r.body ?? r.title ?? null,
          estId:             r.estId,
          createdAt:         { seconds: r.createdAt.seconds, nanoseconds: r.createdAt.nanoseconds },
        };
      })
    );
  }

  const [postResults, reviewResults] = await Promise.all([searchPosts(), searchReviews()]);

  let combined = [...postResults, ...reviewResults];
  combined.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

  page       = combined.slice(0, limit);
  hasMore    = combined.length > limit;
  nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;

  log.info("searchContent: complete", {
    traceId,
    userId: uid,
    domain: "search",
    eventId: `searchContent_${uid}`,
  }, { resultCount: page.length, query, contentType, hasMore });

  return { results: page, hasMore, nextCursor };
});
