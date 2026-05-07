/**
 * feed.ts — getFeed callable: ranked feed for the calling user.
 *
 * Sources:
 *   - reviews from followed users (up to 500 followed UIDs; batched `in` queries)
 *   - new establishments in the user's city (created ≤ 30 days ago)
 *   - deals expiring soon (expiresAt ASC)
 *   - featured creators (Plus subscribers with recent posts)
 *
 * Ranking signal:
 *   score = recency × 0.7 + engagementScore × 0.3
 *
 *   recency       = max(0, 1 - ageSeconds / maxAgeSeconds)   where maxAge = 30 days
 *   engagementScore = stub (0.0 until likes/saves are built)
 *
 * Returns paginated FeedItem[] ordered by descending score.
 * Cursor-based pagination via afterScore + afterDocId.
 *
 * Milestone: B10
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
// Types
// ---------------------------------------------------------------------------

export type FeedItemType = "review" | "deal" | "establishment" | "creator";

export interface FeedItem {
  type:            FeedItemType;
  sourceId:        string;
  uid:             string | null;
  createdAt:       string;       // ISO string
  score:           number;       // ranking score [0, 1]
  data:            ReviewDoc | DealDoc | EstablishmentDoc | PostDoc;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE   = 20;
const MAX_PAGE_SIZE       = 50;
const MAX_AGE_SECONDS     = 30 * 24 * 60 * 60; // 30 days
const NEW_EST_DAYS        = 30;
const RECENCY_WEIGHT      = 0.7;
const ENGAGEMENT_WEIGHT   = 0.3;   // stub — engagement scoring TBD when likes/saves built

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetFeedSchema = z.object({
  limit:       z.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
  afterDocId:  z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split array into chunks of at most `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Compute a ranking score in [0, 1]. */
function rankScore(createdAtSeconds: number, engagementScore = 0): number {
  const nowSeconds = Date.now() / 1000;
  const ageSeconds = Math.max(0, nowSeconds - createdAtSeconds);
  const recency = Math.max(0, 1 - ageSeconds / MAX_AGE_SECONDS);
  return recency * RECENCY_WEIGHT + engagementScore * ENGAGEMENT_WEIGHT;
}

/** Fetch published reviews from a set of followed UIDs (batched). */
async function fetchReviewsFromFollowing(
  db: FirebaseFirestore.Firestore,
  followingUids: string[],
  limit: number
): Promise<ReviewDoc[]> {
  if (followingUids.length === 0) return [];
  const batches = chunk(followingUids.slice(0, 500), 30);
  const snaps = await Promise.all(
    batches.map((batch) =>
      db
        .collection(REVIEWS_COLLECTION)
        .where("authorUid", "in", batch)
        .where("status", "==", "published")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get()
    )
  );
  const docs = snaps.flatMap((s) => s.docs.map((d) => d.data() as ReviewDoc));
  docs.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
  return docs.slice(0, limit);
}

/** Fetch featured creators (Plus subscribers with a recent post). */
async function fetchFeaturedCreators(
  db: FirebaseFirestore.Firestore,
  limit: number
): Promise<PostDoc[]> {
  const cutoff = Timestamp.fromMillis(Date.now() - NEW_EST_DAYS * 24 * 60 * 60 * 1000);
  const snap = await db
    .collection(POSTS_COLLECTION)
    .where("isActive", "==", true)
    .where("createdAt", ">=", cutoff)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as PostDoc);
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getFeed = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const uid = request.auth.uid;

  const parsed = GetFeedSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { limit, afterDocId } = parsed.data;

  const db = getFirestore();
  const now = Timestamp.now();
  const newEstCutoff = Timestamp.fromMillis(Date.now() - NEW_EST_DAYS * 24 * 60 * 60 * 1000);

  // Load user profile for city + following list
  const userSnap = await db.doc(Paths.user(uid)).get();
  const userData = userSnap.data() as (UserDoc & { city?: string; following?: string[] }) | undefined;
  const followingUids: string[] = userData?.following ?? [];
  const userCity: string = userData?.city ?? "";

  // -------------------------------------------------------------------------
  // Fetch from all four sources concurrently
  // -------------------------------------------------------------------------

  const perSourceLimit = Math.max(limit, 20);

  const [reviews, deals, establishments, creators] = await Promise.all([
    fetchReviewsFromFollowing(db, followingUids, perSourceLimit),
    db
      .collection(DEALS_COLLECTION)
      .where("isActive", "==", true)
      .where("expiresAt", ">", now)
      .orderBy("expiresAt", "asc")
      .limit(perSourceLimit)
      .get(),
    userCity
      ? db
          .collection(ESTABLISHMENTS_COLLECTION)
          .where("isActive", "==", true)
          .where("city", "==", userCity)
          .where("createdAt", ">=", newEstCutoff)
          .orderBy("createdAt", "desc")
          .limit(perSourceLimit)
          .get()
      : db
          .collection(ESTABLISHMENTS_COLLECTION)
          .where("isActive", "==", true)
          .where("createdAt", ">=", newEstCutoff)
          .orderBy("createdAt", "desc")
          .limit(perSourceLimit)
          .get(),
    fetchFeaturedCreators(db, perSourceLimit),
  ]);

  // -------------------------------------------------------------------------
  // Assemble and score FeedItems
  // -------------------------------------------------------------------------

  const items: FeedItem[] = [];

  for (const r of reviews) {
    items.push({
      type:      "review",
      sourceId:  r.reviewId,
      uid:       r.authorUid,
      createdAt: r.createdAt.toDate().toISOString(),
      score:     rankScore(r.createdAt.seconds),
      data:      r,
    });
  }

  for (const d of deals.docs) {
    const deal = d.data() as DealDoc;
    items.push({
      type:      "deal",
      sourceId:  deal.dealId,
      uid:       null,
      createdAt: deal.createdAt.toDate().toISOString(),
      score:     rankScore(deal.createdAt.seconds),
      data:      deal,
    });
  }

  for (const e of establishments.docs) {
    const est = e.data() as EstablishmentDoc;
    items.push({
      type:      "establishment",
      sourceId:  est.estId,
      uid:       null,
      createdAt: est.createdAt.toDate().toISOString(),
      score:     rankScore(est.createdAt.seconds),
      data:      est,
    });
  }

  for (const p of creators) {
    items.push({
      type:      "creator",
      sourceId:  p.postId,
      uid:       p.authorUid,
      createdAt: p.createdAt.toDate().toISOString(),
      score:     rankScore(p.createdAt.seconds),
      data:      p,
    });
  }

  // Sort by score descending
  items.sort((a, b) => b.score - a.score);

  // -------------------------------------------------------------------------
  // Cursor-based pagination (afterDocId = skip items up to and including this sourceId)
  // -------------------------------------------------------------------------

  let startIndex = 0;
  if (afterDocId) {
    const idx = items.findIndex((item) => item.sourceId === afterDocId);
    if (idx >= 0) startIndex = idx + 1;
  }

  const paged = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;
  const nextCursor = hasMore && paged.length > 0 ? paged[paged.length - 1].sourceId : null;

  log.info("getFeed: complete", {
    traceId, userId: uid, domain: "social", eventId: `feed_${uid}`,
  }, { resultCount: paged.length, hasMore, followingCount: followingUids.length });

  return { items: paged, hasMore, nextCursor };
});
