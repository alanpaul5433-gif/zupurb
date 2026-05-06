/**
 * refreshDiscoverCache.ts — Scheduled job (every 6 hours).
 *
 * Pre-computes discover feed rails for the top N cities and stores results in
 * establishmentScores/{city}_discover as a cached feed document.
 * This avoids computing rails on every user request for popular cities.
 *
 * RC keys:
 *   discover_cache_refresh_hours (default 6)
 *   discover_top_cities          (default list — hard-coded here until RC integration)
 *   discover_rail_size           (default 10)
 *   discover_new_days            (default 30)
 *   discover_trending_days       (default 7)
 *
 * Timeout: 300s, Memory: 512MiB
 *
 * Milestone: B9
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  EstablishmentDoc,
  ReviewDoc,
  ESTABLISHMENTS_COLLECTION,
  REVIEWS_COLLECTION,
} from "../lib/schema";
import { log, newTraceId } from "../lib/logging";
import { redis } from "../lib/redis";
import { CacheKeys, CacheTTL } from "../lib/cacheKeys";

setGlobalOptions({ maxInstances: 1 });

// ---------------------------------------------------------------------------
// Constants (RC defaults)
// ---------------------------------------------------------------------------

const TOP_CITIES: string[] = [
  "Los Angeles",
  "New York",
  "Chicago",
  "Houston",
  "Phoenix",
  "San Francisco",
  "Miami",
  "Dallas",
  "Seattle",
  "Boston",
]; // RC: discover_top_cities

const RAIL_SIZE            = 10;  // RC: discover_rail_size
const DISCOVER_NEW_DAYS    = 30;  // RC: discover_new_days
const DISCOVER_TRENDING_DAYS = 7; // RC: discover_trending_days

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DiscoverRailCache {
  city:               string;
  computedAt:         Timestamp;
  newOnZupurb:        object[];
  topRatedNearby:     object[];
  trending:           object[];
  withReservations:   object[];
}

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

async function computeRailsForCity(
  db: FirebaseFirestore.Firestore,
  city: string,
  now: number
): Promise<DiscoverRailCache> {
  const newCutoff      = Timestamp.fromMillis(now - DISCOVER_NEW_DAYS * 24 * 60 * 60 * 1000);
  const trendingCutoff = Timestamp.fromMillis(now - DISCOVER_TRENDING_DAYS * 24 * 60 * 60 * 1000);

  // Rail: new on Zupurb
  async function newOnZupurb(): Promise<object[]> {
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

  // Rail: top rated
  async function topRated(): Promise<object[]> {
    const snap = await db
      .collection(ESTABLISHMENTS_COLLECTION)
      .where("isActive", "==", true)
      .where("city", "==", city)
      .orderBy("overallScore", "desc")
      .limit(RAIL_SIZE)
      .get();
    return snap.docs.map((d) => toResult(d.data() as EstablishmentDoc));
  }

  // Rail: trending — most reviews in last 7 days
  async function trending(): Promise<object[]> {
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

  // Rail: with reservations
  async function withReservations(): Promise<object[]> {
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

  const [newResults, topResults, trendingResults, reservationResults] = await Promise.all([
    newOnZupurb(),
    topRated(),
    trending(),
    withReservations(),
  ]);

  return {
    city,
    computedAt:      Timestamp.now(),
    newOnZupurb:     newResults,
    topRatedNearby:  topResults,
    trending:        trendingResults,
    withReservations: reservationResults,
  };
}

// ---------------------------------------------------------------------------
// Scheduled function
// ---------------------------------------------------------------------------

export const refreshDiscoverCache = onSchedule(
  {
    schedule:  "every 6 hours", // RC: discover_cache_refresh_hours (6)
    timeoutSeconds: 300,
    memory:    "512MiB",
  },
  async () => {
    const traceId = newTraceId();
    const db = getFirestore();
    const now = Date.now();

    log.info("refreshDiscoverCache: starting", {
      traceId,
      domain: "discovery",
      eventId: "refreshDiscoverCache",
    }, { cities: TOP_CITIES.length });

    let successCount = 0;
    let failCount = 0;

    for (const city of TOP_CITIES) {
      try {
        const cache = await computeRailsForCity(db, city, now);
        const docId = `${city.replace(/\s+/g, "_").toLowerCase()}_discover`;

        await db
          .collection("establishmentScores")
          .doc(docId)
          .set(cache, { merge: true });

        // Also write non-personalised rails to Redis for fast serving
        const redisPayload = {
          newOnZupurb:      cache.newOnZupurb,
          topRatedNearby:   cache.topRatedNearby,
          trending:         cache.trending,
          withReservations: cache.withReservations,
        };
        await redis.set(CacheKeys.discoverFeed(city), redisPayload, CacheTTL.discoverFeed);

        successCount++;
        log.info("refreshDiscoverCache: city cached", {
          traceId,
          domain: "discovery",
          eventId: `discoverCache_${city}`,
        }, { city });
      } catch (err) {
        failCount++;
        log.error("refreshDiscoverCache: city failed", {
          traceId,
          domain: "discovery",
          eventId: `discoverCache_err_${city}`,
        }, { city, error: String(err) });
      }
    }

    log.info("refreshDiscoverCache: complete", {
      traceId,
      domain: "discovery",
      eventId: "refreshDiscoverCache_done",
    }, { successCount, failCount });
  }
);
