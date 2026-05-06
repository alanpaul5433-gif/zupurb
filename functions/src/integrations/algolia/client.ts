/**
 * integrations/algolia/client.ts — Algolia client factory.
 *
 * Credentials read exclusively from environment variables — never hardcoded.
 *   ALGOLIA_APP_ID         — Algolia application ID
 *   ALGOLIA_ADMIN_API_KEY  — server-side admin key (write + delete; keep secret)
 *   ALGOLIA_SEARCH_API_KEY — read-only search key (safe for Cloud Functions)
 *
 * Graceful degradation: if any credential is missing the factory returns null
 * and callers must fall back to the Firestore implementation.
 *
 * Index naming convention: zupurb_<resource> so all Zupurb indices share one
 * Algolia application and are easy to identify in the dashboard.
 *
 * Milestone: I5
 */

import algoliasearch, { SearchClient } from "algoliasearch";

const appId      = process.env.ALGOLIA_APP_ID        ?? "";
const adminKey   = process.env.ALGOLIA_ADMIN_API_KEY  ?? "";
const searchKey  = process.env.ALGOLIA_SEARCH_API_KEY ?? "";

// ---------------------------------------------------------------------------
// Client factories — one admin (write) client, one search (read) client.
// Both are module-level singletons so the TCP connection is reused across
// warm Cloud Function invocations.
// ---------------------------------------------------------------------------

let _adminClient: SearchClient | null = null;
let _searchClient: SearchClient | null = null;

/**
 * Returns the admin (write-capable) Algolia client.
 * Returns null when credentials are absent — callers must fall back to Firestore.
 */
export function getAdminClient(): SearchClient | null {
  if (!appId || !adminKey) {
    console.warn("[algolia] ALGOLIA_APP_ID or ALGOLIA_ADMIN_API_KEY not set — skipping index write.");
    return null;
  }
  if (!_adminClient) {
    _adminClient = algoliasearch(appId, adminKey);
  }
  return _adminClient;
}

/**
 * Returns the search (read-only) Algolia client.
 * Returns null when credentials are absent — callers must fall back to Firestore.
 */
export function getSearchClient(): SearchClient | null {
  if (!appId || !searchKey) {
    console.warn("[algolia] ALGOLIA_APP_ID or ALGOLIA_SEARCH_API_KEY not set — falling back to Firestore search.");
    return null;
  }
  if (!_searchClient) {
    _searchClient = algoliasearch(appId, searchKey);
  }
  return _searchClient;
}

// ---------------------------------------------------------------------------
// Index name registry — single source of truth.
// Change a name here; every module picks it up automatically.
// ---------------------------------------------------------------------------

export const INDICES = {
  venues:        "zupurb_venues",
  users:         "zupurb_users",
  posts:         "zupurb_posts",
  brands:        "zupurb_brands",
  entertainers:  "zupurb_entertainers",
} as const;

export type IndexName = typeof INDICES[keyof typeof INDICES];
