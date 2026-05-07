/**
 * getHomeFeed.ts — Authenticated callable: home feed with tabbed content.
 *
 * Tabs:
 *   all      — recent reviews from followed users + active deals + new establishments
 *   venues   — recent high-score + new establishments in user's city
 *   creators — recent posts from followed creators
 *   deals    — active deals sorted by expiresAt ASC
 *
 * Followed-user content: reads users/{uid}.following (up to 500).
 * Uses Firestore `in` operator (max 30 per query) via batched queries.
 *
 * Milestone: B9
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  ReviewDoc,
  EstablishmentDoc,
  DealDoc,
  PostDoc,
  UserDoc,
  REVIEWS_COLLECTION,
  ESTABLISHMENTS_COLLECTION,
  DEALS_COLLECTION,
  POSTS_COLLECTION,
  Paths,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetHomeFeedSchema = z.object({
  limit:      z.number().int().min(1).max(50).optional().default(20),
  afterDocId: z.string().min(1).optional(),
  tab:        z.enum(["all", "venues", "creators", "deals"]).optional().default("all"),
});

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export type FeedItemType = "review" | "establishment" | "deal" | "post";

export interface FeedItem {
  type:             FeedItemType;
  id:               string;
  data:             ReviewDoc | EstablishmentDoc | DealDoc | PostDoc;
  relevanceScore?:  number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NEW_EST_DAYS = 30; // RC: discover_new_days (30)

/** Split an array into chunks of at most `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Batch-fetch reviews authored by a set of UIDs using Firestore `in` (max 30 per query). */
async function fetchReviewsFromFollowing(
  db: FirebaseFirestore.Firestore,
  followingUids: string[],
  limit: number
): Promise<ReviewDoc[]> {
  if (followingUids.length === 0) return [];

  const batches = chunk(followingUids.slice(0, 500), 30);
  const promises = batches.map((batch) =>
    db
      .collection(REVIEWS_COLLECTION)
      .where("authorUid", "in", batch)
      .where("status", "==", "published")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get()
  );

  const snaps = await Promise.all(promises);
  const docs: ReviewDoc[] = snaps.flatMap((s) => s.docs.map((d) => d.data() as ReviewDoc));
  docs.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
  return docs.slice(0, limit);
}

/** Batch-fetch posts authored by a set of UIDs. */
async function fetchPostsFromFollowing(
  db: FirebaseFirestore.Firestore,
  followingUids: string[],
  limit: number
): Promise<PostDoc[]> {
  if (followingUids.length === 0) return [];

  const batches = chunk(followingUids.slice(0, 500), 30);
  const promises = batches.map((batch) =>
    db
      .collection(POSTS_COLLECTION)
      .where("authorUid", "in", batch)
      .where("isActive", "==", true)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get()
  );

  const snaps = await Promise.all(promises);
  const docs: PostDoc[] = snaps.flatMap((s) => s.docs.map((d) => d.data() as PostDoc));
  docs.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
  return docs.slice(0, limit);
}

/** Read user's following list. */
async function getFollowing(db: FirebaseFirestore.Firestore, uid: string): Promise<string[]> {
  try {
    const snap = await db.doc(Paths.user(uid)).get();
    if (!snap.exists) return [];
    // following is stored as an array field on UserDoc (added in B10/social)
    // If not yet present (pre-B10), default to empty array.
    const data = snap.data() as UserDoc & { following?: string[] };
    return data.following ?? [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getHomeFeed = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = GetHomeFeedSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError("invalid-argument", `Invalid input: ${parseResult.error.message}`);
  }
  const { limit, tab } = parseResult.data;

  const db = getFirestore();
  const now = Timestamp.now();
  const newEstCutoff = Timestamp.fromMillis(Date.now() - NEW_EST_DAYS * 24 * 60 * 60 * 1000);

  let items: FeedItem[] = [];

  // -------------------------------------------------------------------------
  // TAB: deals
  // -------------------------------------------------------------------------
  if (tab === "deals") {
    const snap = await db
      .collection(DEALS_COLLECTION)
      .where("isActive", "==", true)
      .where("expiresAt", ">", now)
      .orderBy("expiresAt", "asc")
      .limit(limit)
      .get();

    items = snap.docs.map((d) => ({
      type: "deal" as FeedItemType,
      id:   d.id,
      data: d.data() as DealDoc,
    }));
  }

  // -------------------------------------------------------------------------
  // TAB: creators
  // -------------------------------------------------------------------------
  else if (tab === "creators") {
    const following = await getFollowing(db, uid);
    const posts = await fetchPostsFromFollowing(db, following, limit);
    items = posts.map((p) => ({
      type: "post" as FeedItemType,
      id:   p.postId,
      data: p,
    }));
  }

  // -------------------------------------------------------------------------
  // TAB: venues
  // -------------------------------------------------------------------------
  else if (tab === "venues") {
    // Fetch user city
    const userSnap = await db.doc(Paths.user(uid)).get();
    const userCity: string = userSnap.exists
      ? (userSnap.data() as UserDoc & { city?: string }).city ?? ""
      : "";

    let estQuery = db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("isActive", "==", true)
      .where("createdAt", ">=", newEstCutoff)
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (userCity) {
      estQuery = db
        .collection(ESTABLISHMENTS_COLLECTION)
        .where("isActive", "==", true)
        .where("city", "==", userCity)
        .orderBy("overallScore", "desc")
        .limit(limit);
    }

    const snap = await estQuery.get();
    items = snap.docs.map((d) => ({
      type: "establishment" as FeedItemType,
      id:   d.id,
      data: d.data() as EstablishmentDoc,
    }));
  }

  // -------------------------------------------------------------------------
  // TAB: all (default) — mix of reviews from followed users + deals + new establishments
  // -------------------------------------------------------------------------
  else {
    const following = await getFollowing(db, uid);

    const [reviews, deals, newEsts] = await Promise.all([
      fetchReviewsFromFollowing(db, following, Math.ceil(limit * 0.5)),
      db
        .collection(DEALS_COLLECTION)
        .where("isActive", "==", true)
        .where("expiresAt", ">", now)
        .orderBy("expiresAt", "asc")
        .limit(Math.ceil(limit * 0.25))
        .get(),
      db
        .collection(ESTABLISHMENTS_COLLECTION)
        .where("isActive", "==", true)
        .where("createdAt", ">=", newEstCutoff)
        .orderBy("createdAt", "desc")
        .limit(Math.ceil(limit * 0.25))
        .get(),
    ]);

    const reviewItems: FeedItem[] = reviews.map((r) => ({
      type: "review" as FeedItemType,
      id:   r.reviewId,
      data: r,
    }));

    const dealItems: FeedItem[] = deals.docs.map((d) => ({
      type: "deal" as FeedItemType,
      id:   d.id,
      data: d.data() as DealDoc,
    }));

    const estItems: FeedItem[] = newEsts.docs.map((d) => ({
      type: "establishment" as FeedItemType,
      id:   d.id,
      data: d.data() as EstablishmentDoc,
    }));

    // Interleave by merging arrays and sorting by recency
    const all = [...reviewItems, ...dealItems, ...estItems];

    function getSeconds(item: FeedItem): number {
      const d = item.data as { createdAt?: Timestamp; startsAt?: Timestamp; expiresAt?: Timestamp };
      return (d.createdAt ?? d.startsAt ?? d.expiresAt)?.seconds ?? 0;
    }
    all.sort((a, b) => getSeconds(b) - getSeconds(a));
    items = all.slice(0, limit);
  }

  const hasMore = items.length === limit;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  log.info("getHomeFeed: complete", {
    traceId,
    userId: uid,
    domain: "discovery",
    eventId: `homeFeed_${uid}`,
  }, { tab, resultCount: items.length, hasMore });

  return { items, hasMore, nextCursor };
});
