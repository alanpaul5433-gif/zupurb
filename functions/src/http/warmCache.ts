/**
 * warmCache.ts — Admin-only callable: pre-warm Redis cache for a city or establishment.
 *
 * Used by admin after adding a new city or major establishment so the first
 * real-user request is served from cache rather than cold Firestore queries.
 *
 * Input:  { type: 'city' | 'establishment'; id: string }
 * Output: { warmed: string[]; duration: number }
 *
 * Admin custom claim required.
 *
 * Milestone: B11
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import {
  EstablishmentDoc,
  ReviewDoc,
  ESTABLISHMENTS_COLLECTION,
  REVIEWS_COLLECTION,
} from "../lib/schema";
import { computeRollingScore } from "../algorithms/scoring";
import { redis } from "../lib/redis";
import { CacheKeys, CacheTTL } from "../lib/cacheKeys";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const WarmCacheSchema = z.object({
  type: z.enum(["city", "establishment"]),
  id:   z.string().min(1).max(200),
});

// ---------------------------------------------------------------------------
// Constants (mirrors refreshDiscoverCache)
// ---------------------------------------------------------------------------

const RAIL_SIZE            = 10; // RC: discover_rail_size
const DISCOVER_NEW_DAYS    = 30; // RC: discover_new_days
const DISCOVER_TRENDING_DAYS = 7; // RC: discover_trending_days

function toResult(doc: EstablishmentDoc): object {
  return {
    id:              doc.estId,
    name:            doc.name,
    categories:      doc.categories,
    city:            doc.city,
    overallScore:    doc.overallScore,
    coverImageUrl:   doc.coverPhotoUrl ?? null,
    reviewCount:     doc.reviewCount,
    hasReservations: doc.isOpenForReservations,
  };
}

// ---------------------------------------------------------------------------
// City cache warmer
// ---------------------------------------------------------------------------

async function warmCity(city: string): Promise<string[]> {
  const db      = getFirestore();
  const now     = Date.now();
  const newCutoff      = Timestamp.fromMillis(now - DISCOVER_NEW_DAYS * 24 * 60 * 60 * 1000);
  const trendingCutoff = Timestamp.fromMillis(now - DISCOVER_TRENDING_DAYS * 24 * 60 * 60 * 1000);

  async function railNewOnZupurb(): Promise<object[]> {
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

  async function railTopRated(): Promise<object[]> {
    const snap = await db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("isActive", "==", true)
      .where("city", "==", city)
      .orderBy("overallScore", "desc")
      .limit(RAIL_SIZE)
      .get();
    return snap.docs.map((d) => toResult(d.data() as EstablishmentDoc));
  }

  async function railTrending(): Promise<object[]> {
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

    const topEstIds = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, RAIL_SIZE)
      .map(([estId]) => estId);

    if (topEstIds.length === 0) return [];

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

    return topEstIds.filter((id) => estMap[id]).map((id) => toResult(estMap[id]));
  }

  async function railWithReservations(): Promise<object[]> {
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

  const [newOnZupurb, topRatedNearby, trending, withReservations] = await Promise.all([
    railNewOnZupurb(),
    railTopRated(),
    railTrending(),
    railWithReservations(),
  ]);

  const payload = { newOnZupurb, topRatedNearby, trending, withReservations };
  const key     = CacheKeys.discoverFeed(city);
  await redis.set(key, payload, CacheTTL.discoverFeed);

  return [key];
}

// ---------------------------------------------------------------------------
// Establishment cache warmer
// ---------------------------------------------------------------------------

async function warmEstablishment(eid: string): Promise<string[]> {
  const result = await computeRollingScore(eid);
  const key    = CacheKeys.establishmentScore(eid);
  await redis.set(key, result.overallScore, CacheTTL.establishmentScore);
  return [key];
}

// ---------------------------------------------------------------------------
// Callable
// ---------------------------------------------------------------------------

export const warmCache = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be authenticated.");
    }

    const isAdmin = (request.auth.token as { admin?: boolean }).admin === true;
    if (!isAdmin) {
      throw new HttpsError("permission-denied", "Admin claim required.");
    }

    const parsed = WarmCacheSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", `Invalid input: ${parsed.error.message}`);
    }

    const { type, id } = parsed.data;
    const startMs = Date.now();

    log.info("warmCache: start", {
      traceId,
      domain: "cache",
      eventId: `warmCache_${type}_${id}`,
    }, { type, id });

    let warmed: string[];
    if (type === "city") {
      warmed = await warmCity(id);
    } else {
      warmed = await warmEstablishment(id);
    }

    const duration = Date.now() - startMs;

    log.info("warmCache: complete", {
      traceId,
      domain: "cache",
      eventId: `warmCache_done_${type}_${id}`,
    }, { type, id, warmedCount: warmed.length, duration });

    return { warmed, duration };
  }
);
