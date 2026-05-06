/**
 * evictStaleCache.ts — Daily 5 AM UTC cache housekeeping.
 *
 * Bulk-evicts search result keys (pattern search:*) from Redis.
 * Search results have a 5-minute TTL but can accumulate in high-traffic windows;
 * this job clears any that are still lingering.
 *
 * Also logs Redis memory usage if available via the Upstash /info endpoint.
 *
 * Notes:
 * - Redis TTLs handle most expiry automatically. This job is supplementary cleanup.
 * - Uses the SCAN + DEL pattern via Upstash REST. Upstash REST supports SCAN.
 * - Timeout: 60s, Memory: 128MiB
 *
 * Milestone: B11
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { redis } from "../lib/redis";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// SCAN helper (direct fetch — avoids exposing internals from redis.ts)
// ---------------------------------------------------------------------------

/**
 * Calls the Upstash REST SCAN endpoint.
 * Returns [nextCursor, matchedKeys] or null if Redis is unavailable.
 */
async function redisScan(cursor: string, pattern: string): Promise<[string, string[]] | null> {
  const url   = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  try {
    const path = [
      "scan",
      encodeURIComponent(cursor),
      "match",
      encodeURIComponent(pattern),
      "count",
      "100",
    ].join("/");

    const res = await fetch(`${url}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const body = (await res.json()) as { result?: [string, string[]]; error?: string };
    if (body.error || !body.result) return null;

    return body.result;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Scheduled function
// ---------------------------------------------------------------------------

export const evictStaleCache = onSchedule(
  {
    schedule:       "0 5 * * *", // Daily at 5 AM UTC
    timeoutSeconds: 60,
    memory:         "128MiB",
  },
  async () => {
    const traceId = newTraceId();

    log.info("evictStaleCache: starting", {
      traceId,
      domain: "cache",
      eventId: "evictStaleCache",
    });

    let deletedCount = 0;
    let cursor = "0";

    // Bulk-evict search:* keys
    try {
      do {
        const result = await redisScan(cursor, "search:*");
        if (!result) {
          log.warn("evictStaleCache: SCAN unavailable (Redis not configured?)", {
            traceId,
            domain: "cache",
            eventId: "evictStaleCache_scan_unavailable",
          });
          break;
        }

        const [nextCursor, keys] = result;
        cursor = nextCursor;

        if (keys.length > 0) {
          await Promise.all(keys.map((k) => redis.del(k)));
          deletedCount += keys.length;
        }
      } while (cursor !== "0");
    } catch (err) {
      log.error("evictStaleCache: scan/delete error", {
        traceId,
        domain: "cache",
        eventId: "evictStaleCache_error",
      }, { error: String(err) });
    }

    // Log Redis memory usage (best-effort)
    try {
      const info = await redis.info();
      if (info) {
        const memMatch  = info.match(/used_memory_human:([^\r\n]+)/);
        const peakMatch = info.match(/used_memory_peak_human:([^\r\n]+)/);
        log.info("evictStaleCache: Redis memory", {
          traceId,
          domain: "cache",
          eventId: "evictStaleCache_memory",
        }, {
          usedMemory: memMatch?.[1]?.trim() ?? "unknown",
          peakMemory: peakMatch?.[1]?.trim() ?? "unknown",
        });
      }
    } catch {
      // Non-critical — memory logging failure does not fail the job
    }

    log.info("evictStaleCache: complete", {
      traceId,
      domain: "cache",
      eventId: "evictStaleCache_done",
    }, { deletedCount });
  }
);
