/**
 * integrations/tremendous/client.ts — Thin REST client for the Tremendous API.
 *
 * Environment variables:
 *   TREMENDOUS_API_KEY            — Bearer token (from Tremendous dashboard)
 *   TREMENDOUS_FUNDING_SOURCE_ID  — Funding source to charge (from dashboard)
 *   TREMENDOUS_SANDBOX            — "true" → testflight base URL; anything else → production
 *
 * The module exports a single factory: getTremendousClient().
 * All vendor-specific HTTP details are encapsulated here; consumers import only
 * TremendousClient, CreateOrderParams, TremendousOrder, TremendousProduct.
 *
 * Graceful degradation: if TREMENDOUS_API_KEY is absent at runtime the factory
 * throws immediately so callers can surface a useful error and refund points.
 *
 * Cost tagging: every paid API call logs { costBand } so we can attribute spend.
 *   createOrder → costBand: "tremendous:order:create"  (~$0.00 platform fee; gift card face value charged separately)
 *   getOrder    → costBand: "tremendous:order:get"
 *   listProducts → costBand: "tremendous:products:list"
 *
 * Milestone: I7
 */

import {
  CreateOrderParams,
  TremendousOrder,
  TremendousProduct,
  TremendousApiError,
} from "./types";
import { log } from "../../lib/logging";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Sandbox base URL — for testflight environment. */
const SANDBOX_BASE_URL = "https://testflight.tremendous.com/api/v2";
/** Production base URL. */
const PROD_BASE_URL    = "https://www.tremendous.com/api/v2";

function getBaseUrl(): string {
  return process.env.TREMENDOUS_SANDBOX === "true" ? SANDBOX_BASE_URL : PROD_BASE_URL;
}

function getApiKey(): string {
  const key = process.env.TREMENDOUS_API_KEY;
  if (!key) {
    throw new TremendousApiError(
      "TREMENDOUS_API_KEY is not set — cannot call Tremendous API",
      500,
      "",
    );
  }
  return key;
}

// Sentinel traceId for client-internal logs (no user context at this layer)
const CLIENT_TRACE_ID = "tremendous-client";

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

async function tremendousFetch<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const apiKey  = getApiKey();
  const baseUrl = getBaseUrl();
  const url     = `${baseUrl}${path}`;
  const start   = Date.now();

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type":  "application/json",
    "Accept":        "application/json",
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
    log.error("tremendous: network error", {
      traceId: CLIENT_TRACE_ID,
      domain:  "tremendous",
      eventId: "tremendous_network_error",
    }, { path, error: String(err) });
    throw new TremendousApiError(`Network error calling Tremendous: ${String(err)}`, 0, "");
  }

  const durationMs = Date.now() - start;
  const rawBody    = await res.text();

  if (!res.ok) {
    log.error("tremendous: API error", {
      traceId: CLIENT_TRACE_ID,
      domain:  "tremendous",
      eventId: "tremendous_api_error",
    }, { path, status: res.status, durationMs, body: rawBody.substring(0, 500) });
    throw new TremendousApiError(
      `Tremendous API ${method} ${path} → ${res.status}`,
      res.status,
      rawBody,
    );
  }

  log.info("tremendous: API call success", {
    traceId: CLIENT_TRACE_ID,
    domain:  "tremendous",
    eventId: "tremendous_api_ok",
  }, { path, method, status: res.status, durationMs });

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    throw new TremendousApiError(
      `Tremendous API returned unparseable JSON on ${method} ${path}`,
      res.status,
      rawBody,
    );
  }
}

// ---------------------------------------------------------------------------
// Tremendous API response envelopes
// ---------------------------------------------------------------------------

interface OrderEnvelope  { order: TremendousOrder }
interface ProductsEnvelope { products: TremendousProduct[] }

// ---------------------------------------------------------------------------
// TremendousClient interface
// ---------------------------------------------------------------------------

export interface TremendousClient {
  /**
   * Create a Tremendous order (send a gift card).
   * externalId = redemptionId ensures idempotency: Tremendous deduplicates on
   * externalId so a retried createOrder with the same id returns the existing order.
   * Cost band: tremendous:order:create
   */
  createOrder(params: CreateOrderParams): Promise<TremendousOrder>;

  /**
   * Fetch a single order by Tremendous order ID.
   * Cost band: tremendous:order:get
   */
  getOrder(orderId: string): Promise<TremendousOrder>;

  /**
   * List available products (gift card brands / denominations).
   * Result is stable — cache at caller level (1 hour in Redis).
   * Cost band: tremendous:products:list
   */
  listProducts(): Promise<TremendousProduct[]>;

  /**
   * Sandbox-only: simulate delivery of a reward so webhooks fire in testflight.
   * No-ops in production (logs a warning).
   */
  simulateDelivery(orderId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let _client: TremendousClient | null = null;

/**
 * Returns the singleton TremendousClient.
 * Throws TremendousApiError if TREMENDOUS_API_KEY is not set.
 * Call once per Cloud Function invocation; the singleton is safe to reuse
 * across warm invocations (no stateful connection).
 */
export function getTremendousClient(): TremendousClient {
  if (_client) return _client;

  // Validate key eagerly so the caller can catch immediately.
  getApiKey();

  _client = {
    async createOrder(params: CreateOrderParams): Promise<TremendousOrder> {
      const fundingSourceId = params.fundingSourceId ||
        process.env.TREMENDOUS_FUNDING_SOURCE_ID;
      if (!fundingSourceId) {
        throw new TremendousApiError(
          "TREMENDOUS_FUNDING_SOURCE_ID is not set",
          500,
          "",
        );
      }

      // Tremendous expects the order shape:
      // https://developers.tremendous.com/reference/create-order
      const requestBody = {
        external_id: params.externalId,
        payment: {
          funding_source_id: fundingSourceId,
        },
        rewards: [
          {
            value: {
              denomination: params.valueUsd,
              currency_code: "USD",
            },
            products: [params.productId],
            recipient: {
              name:  params.recipientName,
              email: params.recipientEmail,
            },
            delivery: {
              method: params.deliveryMethod,
            },
            ...(params.campaignId ? { campaign_id: params.campaignId } : {}),
          },
        ],
      };

      const env = await tremendousFetch<OrderEnvelope>("POST", "/orders", requestBody);
      return env.order;
    },

    async getOrder(orderId: string): Promise<TremendousOrder> {
      const env = await tremendousFetch<OrderEnvelope>("GET", `/orders/${orderId}`);
      return env.order;
    },

    async listProducts(): Promise<TremendousProduct[]> {
      const env = await tremendousFetch<ProductsEnvelope>("GET", "/products");
      return env.products;
    },

    async simulateDelivery(orderId: string): Promise<void> {
      if (process.env.TREMENDOUS_SANDBOX !== "true") {
        log.warn("tremendous: simulateDelivery called in production — no-op", {
          traceId: CLIENT_TRACE_ID,
          domain:  "tremendous",
          eventId: "tremendous_simulate_noop",
        }, { orderId });
        return;
      }
      // Sandbox simulate endpoint: POST /simulate/orders/{id}/delivery
      await tremendousFetch<unknown>("POST", `/simulate/orders/${orderId}/delivery`);
    },
  };

  return _client;
}
