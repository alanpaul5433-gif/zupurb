/**
 * redis.ts — Upstash Redis REST client wrapper.
 *
 * Uses Upstash REST API (fetch-based — no persistent TCP connection; safe in Cloud Functions).
 * Credentials from environment variables:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Graceful degradation: if credentials are not set or a request fails,
 * logs a warning and returns null/no-op. The caller always falls through
 * to Firestore. Never throws to the client due to a cache failure.
 *
 * Milestone: B11
 */

import { log } from "./logging";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getCredentials(): { url: string; token: string } | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Logged at most once per cold start via module-level flag below
    return null;
  }
  return { url: url.replace(/\/$/, ""), token };
}

let _warnedMissingCredentials = false;

// Sentinel traceId for internal cache client logs (no user context)
const CACHE_TRACE_ID = "cache-client";

function warnMissing(): void {
  if (!_warnedMissingCredentials) {
    _warnedMissingCredentials = true;
    log.warn("redis: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — cache disabled", {
      traceId: CACHE_TRACE_ID,
      domain:  "cache",
      eventId: "redis_missing_credentials",
    });
  }
}

async function redisRequest<T>(segments: string[]): Promise<T | null> {
  const creds = getCredentials();
  if (!creds) {
    warnMissing();
    return null;
  }

  const path = segments.map(encodeURIComponent).join("/");
  const url  = `${creds.url}/${path}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${creds.token}` },
      // Upstash REST uses GET for all commands
    });

    if (!res.ok) {
      log.warn("redis: request failed", {
        traceId: CACHE_TRACE_ID,
        domain:  "cache",
        eventId: "redis_request_error",
      }, { status: res.status, path });
      return null;
    }

    const body = (await res.json()) as { result: T | null; error?: string };

    if (body.error) {
      log.warn("redis: command error", {
        traceId: CACHE_TRACE_ID,
        domain:  "cache",
        eventId: "redis_command_error",
      }, { error: body.error, path });
      return null;
    }

    return body.result ?? null;
  } catch (err) {
    log.warn("redis: fetch exception", {
      traceId: CACHE_TRACE_ID,
      domain:  "cache",
      eventId: "redis_fetch_exception",
    }, { error: String(err) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public client
// ---------------------------------------------------------------------------

export const redis = {
  /** GET key → parsed value or null on miss/error. */
  async get<T>(key: string): Promise<T | null> {
    const raw = await redisRequest<string>(["get", key]);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  /**
   * SET key value [EX ttlSeconds].
   * Values are JSON-serialized. No-op if Redis unavailable.
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialised = JSON.stringify(value);
    if (ttlSeconds !== undefined) {
      await redisRequest<string>(["set", key, serialised, "ex", String(ttlSeconds)]);
    } else {
      await redisRequest<string>(["set", key, serialised]);
    }
  },

  /** DEL key. No-op if Redis unavailable. */
  async del(key: string): Promise<void> {
    await redisRequest<number>(["del", key]);
  },

  /**
   * MGET key1 key2 … → array of parsed values (null for each miss/error).
   * Returns array of nulls if Redis unavailable.
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const results = await redisRequest<(string | null)[]>(["mget", ...keys]);
    if (!results) return keys.map(() => null);
    return results.map((raw) => {
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    });
  },

  /** INCR key → new integer value, or null on error. */
  async incr(key: string): Promise<number | null> {
    const result = await redisRequest<number>(["incr", key]);
    return result;
  },

  /** EXPIRE key ttlSeconds. No-op if Redis unavailable. */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await redisRequest<number>(["expire", key, String(ttlSeconds)]);
  },

  /**
   * Raw INFO endpoint — returns raw info string or null.
   * Used by evictStaleCache for memory reporting.
   */
  async info(): Promise<string | null> {
    const creds = getCredentials();
    if (!creds) return null;
    try {
      const res = await fetch(`${creds.url}/info`, {
        headers: { Authorization: `Bearer ${creds.token}` },
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { result?: string };
      return body.result ?? null;
    } catch {
      return null;
    }
  },
};
