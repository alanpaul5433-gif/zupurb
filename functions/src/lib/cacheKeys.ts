/**
 * cacheKeys.ts — Redis key patterns and TTL constants.
 *
 * All cache keys follow the pattern: <domain>:<entity>:<id>
 * TTL values are in seconds. RC comments indicate the Remote Config key
 * that governs each TTL (feature not yet wired — values are defaults).
 *
 * Milestone: B11
 */

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

export const CacheKeys = {
  /** Score for a specific establishment — shared / non-personalized. */
  establishmentScore: (eid: string): string => `score:est:${eid}`,

  /** FPYL score for a specific viewer at a specific establishment. */
  fpylScore: (eid: string, uid: string): string => `score:fpyl:${eid}:${uid}`,

  /** Non-personalized discover rails for a city. */
  discoverFeed: (city: string): string => `discover:${city}`,

  /** Home feed deals rail — global, non-personalized. */
  homeFeedDeals: (): string => `feed:deals`,

  /** User points balance projection. */
  userBalance: (uid: string): string => `ledger:balance:${uid}`,

  /**
   * Search results keyed by a hash of query + serialised filters.
   * Short-TTL; bulk-evicted daily by evictStaleCache.
   */
  searchResults: (query: string, filters: string): string => {
    const raw    = query + filters;
    // Node.js Buffer.from().toString('base64') — take first 40 chars
    const hash   = Buffer.from(raw).toString("base64").substring(0, 40);
    return `search:${hash}`;
  },
};

// ---------------------------------------------------------------------------
// TTL constants (seconds)
// ---------------------------------------------------------------------------

export const CacheTTL = {
  /** 1 hour.  RC: cache_ttl_score */
  establishmentScore: 3600,

  /** 30 minutes.  RC: cache_ttl_fpyl */
  fpylScore: 1800,

  /** 6 hours.  RC: cache_ttl_discover */
  discoverFeed: 21600,

  /** 5 minutes.  RC: cache_ttl_deals */
  homeFeedDeals: 300,

  /** 1 minute.  RC: cache_ttl_balance */
  userBalance: 60,

  /** 5 minutes.  RC: cache_ttl_search */
  searchResults: 300,
};
