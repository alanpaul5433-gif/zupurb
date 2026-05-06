/**
 * getDiscoverFeed.ts — Authenticated callable: multi-rail discover feed.
 *
 * Returns 5 rails in parallel:
 *   - newOnZupurb:        createdAt DESC, last 30 days     RC: discover_new_days (30)
 *   - topRatedNearby:     overallScore DESC, city filter
 *   - fromPeopleLikeYou:  highest FPYL score for viewer
 *   - trending:           most reviews in last 7 days       RC: discover_trending_days (7)
 *   - withReservations:   isOpenForReservations, score DESC
 *
 * Each rail returns max 10 items.                           RC: discover_rail_size (10)
 *
 * Pre-computed cache for popular cities is stored in establishmentScores/{city}_discover
 * and refreshed by the refreshDiscoverCache scheduled function every 6 hours.
 *
 * Milestone: B9
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  EstablishmentDoc,
  ESTABLISHMENTS_COLLECTION,
  REVIEWS_COLLECTION,
  ReviewDoc,
} from "../lib/schema";
import { getCachedFPYLScore } from "../algorithms/scoring";
import { EstablishmentSearchResult } from "./searchVenues";
import { log, newTraceId } from "../lib/logging";
import { redis } from "../lib/redis";
import { CacheKeys, CacheTTL } from "../lib/cacheKeys";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const GetDiscoverFeedSchema = z.object({
  city:  z.string().min(1).max(100),
  limit: z.number().int().min(1).max(20).optional().default(10), // RC: discover_rail_size (10)
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DISCOVER_NEW_DAYS    = 30;  // RC: discover_new_days
const DISCOVER_TRENDING_DAYS = 7; // RC: discover_trending_days
const RAIL_SIZE            = 10;  // RC: discover_rail_size

function toResult(doc: EstablishmentDoc, fpylScore?: number): EstablishmentSearchResult {
  return {
    id:             doc.estId,
    name:           doc.name,
    categories:     doc.categories,
    city:           doc.city,
    overallScore:   doc.overallScore,
    fpylScore,
    coverImageUrl:  doc.coverPhotoUrl ?? null,
    reviewCount:    doc.reviewCount,
    hasReservations: doc.isOpenForReservations,
  };
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const getDiscoverFeed = onCall(async (request) => {
  const traceId = newTraceId();

  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }
  const uid = request.auth.uid;

  const parseResult = GetDiscoverFeedSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError("invalid-argument", `Invalid input: ${parseResult.error.message}`);
  }
  const { city } = parseResult.data;

  const db = getFirestore();
  const now = Date.now();
  const newCutoff = Timestamp.fromMillis(now - DISCOVER_NEW_DAYS * 24 * 60 * 60 * 1000);
  const trendingCutoff = Timestamp.fromMillis(now - DISCOVER_TRENDING_DAYS * 24 * 60 * 60 * 1000);

  // ---------------------------------------------------------------------------
  // Rail: newOnZupurb — establishments added in last 30 days
  // ---------------------------------------------------------------------------
  async function railNewOnZupurb(): Promise<EstablishmentSearchResult[]> {
    const snap = await db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("isActive", "==", true)
      .where("city", "==", city)
      .where("createdAt", ">=", newCutoff)
      .orderBy("createdAt", "desc")
      .limit(RAIL_SIZE)
      .get();
    return snap.docs.map((d) => toResult(d.data() as EstablishmentDoc));
  }

  // ---------------------------------------------------------------------------
  // Rail: topRatedNearby — highest overallScore in city
  // ---------------------------------------------------------------------------
  async function railTopRated(): Promise<EstablishmentSearchResult[]> {
    const snap = await db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("isActive", "==", true)
      .where("city", "==", city)
      .orderBy("overallScore", "desc")
      .limit(RAIL_SIZE)
      .get();
    return snap.docs.map((d) => toResult(d.data() as EstablishmentDoc));
  }

  // ---------------------------------------------------------------------------
  // Rail: fromPeopleLikeYou — top 50 by overall score, ranked by FPYL
  // Always computed fresh per viewer; never served from city-level Redis cache.
  // ---------------------------------------------------------------------------
  async function railFPYL(): Promise<EstablishmentSearchResult[]> {
    const snap = await db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("isActive", "==", true)
      .where("city", "==", city)
      .orderBy("overallScore", "desc")
      .limit(50)
      .get();

    const docs = snap.docs.map((d) => d.data() as EstablishmentDoc);

    // Compute FPYL scores in parallel via Redis-backed cache
    const withFpyl = await Promise.all(
      docs.map(async (doc) => {
        const fpylScore = await getCachedFPYLScore(doc.estId, uid, traceId);
        return { doc, fpylScore };
      })
    );

    // Sort by FPYL score descending, return top RAIL_SIZE
    withFpyl.sort((a, b) => b.fpylScore - a.fpylScore);
    return withFpyl.slice(0, RAIL_SIZE).map(({ doc, fpylScore }) => toResult(doc, fpylScore));
  }

  // ---------------------------------------------------------------------------
  // Rail: trending — establishments with most reviews in last 7 days
  // ---------------------------------------------------------------------------
  async function railTrending(): Promise<EstablishmentSearchResult[]> {
    // Count reviews per estId in the trending window
    const reviewsSnap = await db
      .collection(REVIEWS_COLLECTION)
      .where("createdAt", ">=", trendingCutoff)
      .where("status", "==", "published")
      .get();

    const counts: Record<string, number> = {};
    for (const d of reviewsSnap.docs) {
      const r = d.data() as ReviewDoc;
      counts[r.estId] = (counts[r.estId] ?? 0) + 1;
    }

    // Get top estIds by count
    const topEstIds = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, RAIL_SIZE)
      .map(([estId]) => estId);

    if (topEstIds.length === 0) return [];

    // Fetch establishment docs for the top IDs
    // Firestore `in` supports up to 30 items; RAIL_SIZE is 10
    const estSnap = await db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("__name__", "in", topEstIds)
      .where("isActive", "==", true)
      .where("city", "==", city)
      .get();

    const estMap: Record<string, EstablishmentDoc> = {};
    for (const d of estSnap.docs) {
      const est = d.data() as EstablishmentDoc;
      estMap[est.estId] = est;
    }

    // Preserve order by review count, filter missing docs
    return topEstIds
      .filter((id) => estMap[id])
      .map((id) => toResult(estMap[id]));
  }

  // ---------------------------------------------------------------------------
  // Rail: withReservations — active venues that accept reservations
  // ---------------------------------------------------------------------------
  async function railWithReservations(): Promise<EstablishmentSearchResult[]> {
    const snap = await db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("isActive", "==", true)
      .where("city", "==", city)
      .where("isOpenForReservations", "==", true)
      .orderBy("overallScore", "desc")
      .limit(RAIL_SIZE)
      .get();
    return snap.docs.map((d) => toResult(d.data() as EstablishmentDoc));
  }

  // PERF: p95 < 300ms with Redis cache hit; < 2s cache miss

  // Try Redis for the 4 non-personalized rails
  interface CachedNonPersonalisedRails {
    newOnZupurb:      EstablishmentSearchResult[];
    topRatedNearby:   EstablishmentSearchResult[];
    trending:         EstablishmentSearchResult[];
    withReservations: EstablishmentSearchResult[];
  }

  const cityCache = await redis.get<CachedNonPersonalisedRails>(CacheKeys.discoverFeed(city));

  let newOnZupurb:      EstablishmentSearchResult[];
  let topRatedNearby:   EstablishmentSearchResult[];
  let trending:         EstablishmentSearchResult[];
  let withReservations: EstablishmentSearchResult[];

  if (cityCache) {
    // Cache hit: use pre-computed non-personalised rails
    newOnZupurb      = cityCache.newOnZupurb;
    topRatedNearby   = cityCache.topRatedNearby;
    trending         = cityCache.trending;
    withReservations = cityCache.withReservations;
  } else {
    // Cache miss: compute all 4 non-personalised rails in parallel
    [newOnZupurb, topRatedNearby, trending, withReservations] = await Promise.all([
      railNewOnZupurb(),
      railTopRated(),
      railTrending(),
      railWithReservations(),
    ]);

    // Store non-personalised rails in Redis (best-effort, non-blocking)
    const toCache: CachedNonPersonalisedRails = {
      newOnZupurb,
      topRatedNearby,
      trending,
      withReservations,
    };
    redis.set(CacheKeys.discoverFeed(city), toCache, CacheTTL.discoverFeed)
      .catch(() => { /* non-critical */ });
  }

  // fromPeopleLikeYou always computed fresh per viewer (uses per-viewer Redis FPYL cache)
  const fromPeopleLikeYou = await railFPYL();

  log.info("getDiscoverFeed: complete", {
    traceId,
    userId: uid,
    domain: "discovery",
    eventId: `discoverFeed_${uid}`,
  }, {
    city,
    newOnZupurbCount:      newOnZupurb.length,
    topRatedCount:         topRatedNearby.length,
    fpylCount:             fromPeopleLikeYou.length,
    trendingCount:         trending.length,
    withReservationsCount: withReservations.length,
  });

  return {
    rails: {
      newOnZupurb,
      topRatedNearby,
      fromPeopleLikeYou,
      trending,
      withReservations,
    },
  };
});
