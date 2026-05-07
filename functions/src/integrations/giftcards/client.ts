/**
 * integrations/giftcards/client.ts — Thin Tremendous REST client for gift card delivery.
 *
 * ============================================================
 * VENDOR COMPARISON: Tango Card vs Tremendous
 * ============================================================
 *
 * Tango Card (now Blackhawk Network / Tango)
 *   + Established (10+ years), wide brand catalog (~5,000+ brands)
 *   + Enterprise-grade — used by large loyalty programs
 *   - Complex integration: SOAP + REST mix; older docs
 *   - Higher account minimums ($500+ pre-fund required)
 *   - KYC/onboarding takes 4–8 weeks
 *   - Sandbox is limited and requires separate sign-up
 *   - Less transparent pricing model
 *
 * Tremendous  ← RECOMMENDED
 *   + Modern REST API (v2), well-documented with OpenAPI spec
 *   + Instant sandbox (testflight.tremendous.com) — no approval gate
 *   + Good catalog (~1,000+ brands including Amazon, Starbucks, Visa prepaid)
 *   + Lower minimums ($100 initial deposit is enough to start)
 *   + KYC: 2–4 weeks (standard business verification + bank account)
 *   + Per-reward fee model is transparent (typically $0–$2 per order)
 *   + Webhook support for delivery status events
 *   + idempotency via externalId — safe to retry
 *
 * DECISION: Tremendous
 * Rationale: Faster time to sandbox, simpler API surface, lower minimums, and
 * idempotent order creation make it the right choice for a loyalty rewards app
 * at this stage. Can revisit Tango Card if catalog breadth becomes a constraint.
 * Captured as ADR-010 in ARCHITECTURE.md.
 *
 * ============================================================
 * API surface (exported from this module)
 * ============================================================
 *
 *   listCatalog(): Promise<GiftCardProduct[]>
 *     GET /v1/products — returns available gift card products.
 *     Results are stable; cache at caller level (1h in Redis recommended).
 *     Cost band: giftcards:catalog:list
 *
 *   sendReward(recipientEmail, productId, value, uid): Promise<RewardResult>
 *     POST /v1/rewards — creates and immediately sends a gift card reward.
 *     Uses uid as externalId suffix for Tremendous-side idempotency.
 *     Cost band: giftcards:reward:send
 *
 * ============================================================
 * Environment variables
 * ============================================================
 *   TREMENDOUS_API_KEY            — Bearer token from Tremendous dashboard
 *   TREMENDOUS_FUNDING_SOURCE_ID  — Funding source ID from Tremendous dashboard
 *   TREMENDOUS_SANDBOX            — "true" → testflight URL; anything else → production
 *
 * ============================================================
 * Milestone: I7
 */

import { log } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** A gift card product available in the Tremendous catalog. */
export interface GiftCardProduct {
  id: string;
  name: string;
  description: string;
  /** Minimum redeemable value in USD (dollars). */
  minValue: number;
  /** Maximum redeemable value in USD (dollars). */
  maxValue: number;
  currency: string;
  category: string;
}

/** Result of a successful sendReward call. */
export interface RewardResult {
  rewardId: string;
  /** Tremendous order status: QUEUED | EXECUTED | FAILED | CANCELED */
  status: string;
  /** Delivery status of the first reward in the order: CLAIMED | UNCLAIMED | FAILED */
  deliveryStatus: string;
  createdAt: string;
}

/** Internal error type — wraps Tremendous HTTP errors so consumers don't leak vendor shape. */
export class GiftCardClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = "GiftCardClientError";
  }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SANDBOX_BASE_URL = "https://testflight.tremendous.com/api/v1";
const PROD_BASE_URL    = "https://www.tremendous.com/api/v1";

function getBaseUrl(): string {
  return process.env.TREMENDOUS_SANDBOX === "true" ? SANDBOX_BASE_URL : PROD_BASE_URL;
}

function getApiKey(): string {
  const key = process.env.TREMENDOUS_API_KEY;
  if (!key) {
    throw new GiftCardClientError(
      "TREMENDOUS_API_KEY is not set — cannot call gift card API",
      500,
      "",
    );
  }
  return key;
}

const CLIENT_TRACE = "giftcards-client";

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function giftcardFetch<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const apiKey  = getApiKey();
  const url     = `${getBaseUrl()}${path}`;
  const start   = Date.now();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const init: RequestInit = {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    log.error("giftcards: network error", {
      traceId: CLIENT_TRACE,
      domain:  "giftcards",
      eventId: "giftcards_network_error",
    }, { path, error: String(err) });
    throw new GiftCardClientError(`Network error: ${String(err)}`, 0, "");
  }

  const durationMs = Date.now() - start;
  const rawBody    = await res.text();

  if (!res.ok) {
    log.error("giftcards: API error", {
      traceId: CLIENT_TRACE,
      domain:  "giftcards",
      eventId: "giftcards_api_error",
    }, { path, status: res.status, durationMs, body: rawBody.substring(0, 500) });
    throw new GiftCardClientError(
      `Tremendous API ${method} ${path} → ${res.status}`,
      res.status,
      rawBody,
    );
  }

  log.info("giftcards: API ok", {
    traceId: CLIENT_TRACE,
    domain:  "giftcards",
    eventId: "giftcards_api_ok",
  }, { path, method, status: res.status, durationMs });

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new GiftCardClientError(
      `Unparseable JSON from Tremendous ${method} ${path}`,
      res.status,
      rawBody,
    );
  }
}

// ---------------------------------------------------------------------------
// Tremendous v1 response envelopes
// ---------------------------------------------------------------------------

interface ProductsEnvelope {
  products: Array<{
    id: string;
    name: string;
    description?: string;
    category: string;
    currency_codes: string[];
    countries: string[];
    skus: Array<{ min: number; max: number }>;
  }>;
}

interface OrderEnvelope {
  order: {
    id: string;
    status: string;
    created_at: string;
    rewards: Array<{
      id: string;
      status: string;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * listCatalog — GET /products
 *
 * Returns gift card products available in the configured Tremendous account.
 * Results are stable — callers should cache for ~1 hour.
 * Cost band: giftcards:catalog:list
 */
export async function listCatalog(): Promise<GiftCardProduct[]> {
  const envelope = await giftcardFetch<ProductsEnvelope>("GET", "/products");
  log.info("giftcards: catalog fetched", {
    traceId: CLIENT_TRACE,
    domain:  "giftcards",
    eventId: "giftcards_catalog_fetched",
  }, { count: envelope.products.length, costBand: "giftcards:catalog:list" });

  return envelope.products.map((p) => {
    const sku = p.skus[0];
    return {
      id:          p.id,
      name:        p.name,
      description: p.description ?? "",
      minValue:    sku?.min ?? 0,
      maxValue:    sku?.max ?? 0,
      currency:    p.currency_codes[0] ?? "USD",
      category:    p.category,
    };
  });
}

/**
 * sendReward — POST /orders
 *
 * Creates a Tremendous order containing a single gift card reward delivered
 * by email to recipientEmail.
 *
 * @param recipientEmail  Verified email address (fetched from Firebase Auth — never client-supplied).
 * @param productId       Tremendous product ID (from listCatalog).
 * @param value           Dollar amount (float, e.g. 10.00).
 * @param uid             Firebase Auth UID — used as externalId suffix for idempotency.
 *
 * Idempotency: externalId = `gc_{uid}_{productId}_{valueStr}` is sent on every call.
 * Tremendous deduplicates on externalId — safe to retry.
 * Cost band: giftcards:reward:send
 */
export async function sendReward(
  recipientEmail: string,
  productId: string,
  value: number,
  uid: string,
): Promise<RewardResult> {
  const fundingSourceId = process.env.TREMENDOUS_FUNDING_SOURCE_ID;
  if (!fundingSourceId) {
    throw new GiftCardClientError(
      "TREMENDOUS_FUNDING_SOURCE_ID is not set",
      500,
      "",
    );
  }

  // Build a stable externalId for idempotency: gc_{uid}_{productId}_{cents}
  const valueCents = Math.round(value * 100);
  const externalId = `gc_${uid}_${productId}_${valueCents}`;

  const requestBody = {
    external_id: externalId,
    payment: {
      funding_source_id: fundingSourceId,
    },
    rewards: [
      {
        value: {
          denomination: value,
          currency_code: "USD",
        },
        products: [productId],
        recipient: {
          name:  "Zupurb User",
          email: recipientEmail,
        },
        delivery: {
          method: "EMAIL",
        },
      },
    ],
  };

  const envelope = await giftcardFetch<OrderEnvelope>("POST", "/orders", requestBody);

  const order  = envelope.order;
  const reward = order.rewards[0];

  log.info("giftcards: reward sent", {
    traceId: CLIENT_TRACE,
    domain:  "giftcards",
    userId:  uid,
    eventId: `giftcards_reward_sent_${order.id}`,
  }, {
    orderId:        order.id,
    orderStatus:    order.status,
    deliveryStatus: reward?.status ?? "unknown",
    costBand:       "giftcards:reward:send",
  });

  return {
    rewardId:       order.id,
    status:         order.status,
    deliveryStatus: reward?.status ?? "unknown",
    createdAt:      order.created_at,
  };
}
