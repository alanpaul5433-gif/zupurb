/**
 * Unit tests for functions/src/lib/ledger.ts
 * Covers: getExpiringEntries, expireStalePoints.
 *
 * T1 — Milestone B5/B6
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("../lib/logging", () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  newTraceId: () => "test-trace",
}));

jest.mock("../lib/redis", () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../lib/cacheKeys", () => ({
  CacheKeys: {
    userBalance: (uid: string) => `balance:${uid}`,
    establishmentScore: (id: string) => `score:${id}`,
    fpylScore: (eid: string, uid: string) => `fpyl:${eid}:${uid}`,
  },
  CacheTTL: {
    userBalance: 60,
    establishmentScore: 300,
    fpylScore: 1800,
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { Timestamp, getFirestore, FieldValue } from "firebase-admin/firestore";
import { getExpiringEntries, expireStalePoints } from "../lib/ledger";
import { PointsLedgerEntry } from "../lib/schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<PointsLedgerEntry> = {}): PointsLedgerEntry {
  const now = Timestamp.now();
  return {
    entryId: "entry-1",
    userId: "uid-1",
    delta: 100,
    type: "earn_review_unverified",
    sourceId: null,
    sourceType: null,
    description: "Test entry",
    balanceAfter: 100,
    expiresAt: Timestamp.fromMillis(now.toMillis() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    isExpired: false,
    multiplierApplied: 100,
    createdAt: now,
    schemaVersion: 1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getExpiringEntries
// ---------------------------------------------------------------------------

describe("getExpiringEntries", () => {
  let mockGet: jest.Mock;
  let mockWhere: jest.Mock;
  let mockOrderBy: jest.Mock;
  let mockCollection: jest.Mock;

  function setupMock(entries: PointsLedgerEntry[]) {
    mockGet = jest.fn().mockResolvedValue({
      docs: entries.map((e) => ({ data: () => e })),
    });
    mockOrderBy = jest.fn().mockReturnValue({ get: mockGet });
    mockWhere = jest.fn().mockImplementation(() => ({
      where: mockWhere,
      orderBy: mockOrderBy,
      get: mockGet,
    }));
    mockCollection = jest.fn().mockReturnValue({ where: mockWhere });

    (getFirestore as jest.Mock).mockReturnValue({ collection: mockCollection });
  }

  it("returns entries expiring within the given window", async () => {
    const entries = [makeEntry({ entryId: "e1", delta: 100 }), makeEntry({ entryId: "e2", delta: 200 })];
    setupMock(entries);
    const result = await getExpiringEntries("uid-1", 30);
    expect(result).toHaveLength(2);
    expect(result[0].entryId).toBe("e1");
    expect(result[1].entryId).toBe("e2");
  });

  it("returns empty array when no entries are expiring soon", async () => {
    setupMock([]);
    const result = await getExpiringEntries("uid-empty", 30);
    expect(result).toHaveLength(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns entries in ascending order of expiresAt (as ordered by Firestore query)", async () => {
    const now = Date.now();
    const soon = makeEntry({ entryId: "soon", expiresAt: Timestamp.fromMillis(now + 1 * 24 * 60 * 60 * 1000) });
    const later = makeEntry({ entryId: "later", expiresAt: Timestamp.fromMillis(now + 25 * 24 * 60 * 60 * 1000) });
    setupMock([soon, later]); // Firestore returns in asc order
    const result = await getExpiringEntries("uid-ordered", 30);
    expect(result[0].entryId).toBe("soon");
    expect(result[1].entryId).toBe("later");
  });

  it("uses correct Firestore query predicates", async () => {
    setupMock([]);
    await getExpiringEntries("uid-1", 14);
    // Should have called .where("userId", "==", ...) at least once
    expect(mockWhere).toHaveBeenCalledWith("userId", "==", "uid-1");
    expect(mockWhere).toHaveBeenCalledWith("isExpired", "==", false);
  });
});

// ---------------------------------------------------------------------------
// expireStalePoints
// ---------------------------------------------------------------------------

/** Creates an infinitely-chainable Firestore query mock that always resolves to `finalResult`. */
function makeChainableQuery(finalResult: unknown) {
  const q: Record<string, jest.Mock> = {};
  q["where"]   = jest.fn().mockImplementation(() => q);
  q["orderBy"] = jest.fn().mockImplementation(() => q);
  q["limit"]   = jest.fn().mockImplementation(() => q);
  q["get"]     = jest.fn().mockResolvedValue(finalResult);
  return q;
}

describe("expireStalePoints", () => {
  it("returns 0 when no stale entries exist", async () => {
    const q = makeChainableQuery({ empty: true, docs: [] });
    (getFirestore as jest.Mock).mockReturnValue({
      collection: jest.fn().mockReturnValue(q),
    });

    const result = await expireStalePoints("uid-no-stale");
    expect(result).toBe(0);
  });

  it("marks expired entries and returns total points expired", async () => {
    const now = Timestamp.now();
    const pastMs = now.toMillis() - 2 * 24 * 60 * 60 * 1000; // 2 days ago

    const staleEntry1 = makeEntry({
      entryId: "stale-1",
      delta: 100,
      isExpired: false,
      expiresAt: Timestamp.fromMillis(pastMs),
    });
    const staleEntry2 = makeEntry({
      entryId: "stale-2",
      delta: 150,
      isExpired: false,
      expiresAt: Timestamp.fromMillis(pastMs - 1000),
    });

    // Mock the outer query (find stale)
    const ref1 = { path: "pointsLedger/stale-1" };
    const ref2 = { path: "pointsLedger/stale-2" };
    const mockTxGet = jest.fn()
      .mockResolvedValueOnce({ exists: true, data: () => staleEntry1, ref: ref1 })
      .mockResolvedValueOnce({ exists: true, data: () => staleEntry2, ref: ref2 })
      // tx.get(balanceRef) call inside the transaction
      .mockResolvedValueOnce({ exists: true, data: () => ({ balance: 500, lifetimeEarned: 600, lifetimeSpent: 100 }) });

    const mockTxUpdate = jest.fn();
    const mockTxDoc1 = { ref: { path: "pointsLedger/stale-1" }, data: () => staleEntry1 };
    const mockTxDoc2 = { ref: { path: "pointsLedger/stale-2" }, data: () => staleEntry2 };

    const mockRunTransaction = jest.fn().mockImplementation(async (fn: Function) => {
      await fn({
        get: mockTxGet,
        update: mockTxUpdate,
      });
    });

    const mockBalanceDoc = {
      exists: true,
      data: () => ({ balance: 500, lifetimeEarned: 600, lifetimeSpent: 100 }),
    };
    const mockUserDoc = { exists: true, data: () => ({ pointsBalance: 500 }) };

    const mockDocFn = jest.fn().mockImplementation((path: string) => {
      if (path.startsWith("userBalances/") || path === "userBalances/uid-expire") {
        return { get: jest.fn().mockResolvedValue(mockBalanceDoc) };
      }
      if (path.startsWith("users/")) {
        return { get: jest.fn().mockResolvedValue(mockUserDoc) };
      }
      return { get: jest.fn().mockResolvedValue({ exists: false }) };
    });

    const q = makeChainableQuery({ empty: false, docs: [mockTxDoc1, mockTxDoc2] });
    (getFirestore as jest.Mock).mockReturnValue({
      collection: jest.fn().mockReturnValue(q),
      runTransaction: mockRunTransaction,
      doc: mockDocFn,
    });

    const result = await expireStalePoints("uid-expire");

    // Total from transaction: 100 + 150 = 250
    expect(result).toBe(250);
    // Transaction was called once (one batch)
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
    // isExpired was set on both docs
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "pointsLedger/stale-1" }),
      { isExpired: true }
    );
    expect(mockTxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: "pointsLedger/stale-2" }),
      { isExpired: true }
    );
  });

  it("skips already-expired entries inside transaction (idempotency)", async () => {
    const now = Timestamp.now();
    const pastMs = now.toMillis() - 1 * 24 * 60 * 60 * 1000;

    const alreadyExpiredEntry = makeEntry({
      entryId: "already-expired",
      delta: 100,
      isExpired: true, // already expired inside tx
      expiresAt: Timestamp.fromMillis(pastMs),
    });

    const mockTxDoc = { ref: { path: "pointsLedger/already-expired" }, data: () => alreadyExpiredEntry };

    const mockRunTransaction = jest.fn().mockImplementation(async (fn: Function) => {
      await fn({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => alreadyExpiredEntry,
        }),
        update: jest.fn(),
      });
    });

    const q = makeChainableQuery({ empty: false, docs: [mockTxDoc] });
    (getFirestore as jest.Mock).mockReturnValue({
      collection: jest.fn().mockReturnValue(q),
      runTransaction: mockRunTransaction,
      doc: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ balance: 100 }) }),
      }),
    });

    const result = await expireStalePoints("uid-idempotent");
    // actualTotal = 0 because entry.isExpired = true inside tx → early return
    expect(result).toBe(0);
  });

  it("returns 0 for user with no ledger entries at all", async () => {
    const q = makeChainableQuery({ empty: true, docs: [] });
    (getFirestore as jest.Mock).mockReturnValue({
      collection: jest.fn().mockReturnValue(q),
    });

    const result = await expireStalePoints("uid-zero");
    expect(result).toBe(0);
  });
});
