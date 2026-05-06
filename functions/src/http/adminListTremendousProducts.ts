/**
 * http/adminListTremendousProducts.ts — Admin callable to list available Tremendous products.
 *
 * Used when configuring deals in the admin dashboard to look up Tremendous product IDs
 * (e.g., to populate PRODUCT_MAP or set tremendousProductKey on a DealDoc).
 *
 * Admin-only: requires admin custom claim.
 * Cached in Redis for 1 hour (RC: tremendous_products_cache_ttl_seconds).
 * Returns TremendousProduct[].
 *
 * Milestone: I7
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getTremendousClient } from "../integrations/tremendous/client";
import { TremendousProduct, TremendousApiError } from "../integrations/tremendous/types";
import { requireAdmin } from "../lib/adminGuard";
import { redis } from "../lib/redis";
import { log, newTraceId } from "../lib/logging";

/** Redis cache key for the Tremendous product list. */
const CACHE_KEY = "tremendous:products:list";

/** RC: tremendous_products_cache_ttl_seconds — 1 hour. */
const CACHE_TTL_SECONDS = 3600;

export const adminListTremendousProducts = onCall(
  { timeoutSeconds: 30 },
  async (request): Promise<TremendousProduct[]> => {
    const traceId = newTraceId();
    requireAdmin(request);

    // Try Redis cache first
    const cached = await redis.get<TremendousProduct[]>(CACHE_KEY);
    if (cached) {
      log.info("adminListTremendousProducts: cache hit", {
        traceId,
        userId:  request.auth?.uid ?? "admin",
        domain:  "tremendous",
        eventId: "products_cache_hit",
      }, { count: cached.length });
      return cached;
    }

    // Fetch from Tremendous
    let products: TremendousProduct[];
    try {
      const client = getTremendousClient();
      products     = await client.listProducts();
    } catch (err) {
      log.error("adminListTremendousProducts: listProducts failed", {
        traceId,
        userId:  request.auth?.uid ?? "admin",
        domain:  "tremendous",
        eventId: "products_fetch_error",
      }, { error: String(err) });

      if (err instanceof TremendousApiError) {
        throw new HttpsError(
          "internal",
          `Tremendous API error: ${err.message}`,
        );
      }
      throw new HttpsError("internal", "Failed to fetch Tremendous products.");
    }

    log.info("adminListTremendousProducts: fetched from API", {
      traceId,
      userId:  request.auth?.uid ?? "admin",
      domain:  "tremendous",
      eventId: "products_fetched",
    }, { count: products.length, costBand: "tremendous:products:list" });

    // Populate cache
    await redis.set(CACHE_KEY, products, CACHE_TTL_SECONDS);

    return products;
  },
);
