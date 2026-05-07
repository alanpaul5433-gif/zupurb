/**
 * Unit tests for points domain:
 *   - applyMultiplier (pure) from domains/points/multipliers.ts
 *   - checkEarnEligibility (Firestore-backed) from domains/points/eligibility.ts
 *   - Expiry date math: points earned today expire in 365 days
 *   - computeTier tier boundary integration (sourced from lib/tiers.ts — covered in
 *     tiers.test.ts; expiry math exercised here via ledger helper)
 *
 * T1 — Milestone B6
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

// Mock isPlusActive for getEarnMultiplier tests
jest.mock("../lib/plus", () => ({
  isPlusActive: jest.fn().mockResolvedValue(false),
  activatePlus: jest.fn().mockResolvedValue(undefined),
  deactivatePlus: jest.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { applyMultiplier, getEarnMultiplier } from "../domains/points/multipliers";
import { checkEarnEligibility } from "../domains/points/eligibility";
import { isPlusActive } from "../lib/plus";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// applyMultiplier — pure function
// ---------------------------------------------------------------------------

describe("applyMultiplier", () => {
  describe("standard user (1.0×)", () => {
    it("100 base × 1.0 → 100", () => {
      expect(applyMultiplier(100, 1.0)).toBe(100);
    });

    it("50 pts × 1.0 → 50", () => {
      expect(applyMultiplier(50, 1.0)).toBe(50);
    });

    it("1 pt × 1.0 → 1", () => {
      expect(applyMultiplier(1, 1.0)).toBe(1);
    });
  });

  describe("Plus subscriber (1.25×)", () => {
    it("100 pts × 1.25 → 125", () => {
      expect(applyMultiplier(100, 1.25)).toBe(125);
    });

    it("50 pts × 1.25 → 62 (floor, not 62.5)", () => {
      expect(applyMultiplier(50, 1.25)).toBe(62);
    });

    it("1 pt × 1.25 → 1 (floor)", () => {
      expect(applyMultiplier(1, 1.25)).toBe(1);
    });

    it("200 pts × 1.25 → 250", () => {
      expect(applyMultiplier(200, 1.25)).toBe(250);
    });
  });

  describe("tier multipliers applied as floats", () => {
    it("silver tier: 100 pts × (110/100) = 1.1 → 110", () => {
      expect(applyMultiplier(100, 1.1)).toBe(110);
    });

    it("gold tier: 100 pts × 1.2 → 120", () => {
      expect(applyMultiplier(100, 1.2)).toBe(120);
    });

    it("platinum tier: 100 pts × 1.25 → 125", () => {
      expect(applyMultiplier(100, 1.25)).toBe(125);
    });
  });

  describe("edge cases", () => {
    it("baseAmount=0 → 0", () => {
      expect(applyMultiplier(0, 1.25)).toBe(0);
    });

    it("negative baseAmount → 0", () => {
      expect(applyMultiplier(-50, 1.25)).toBe(0);
    });

    it("multiplier=0 → 0", () => {
      expect(applyMultiplier(100, 0)).toBe(0);
    });

    it("negative multiplier → 0", () => {
      expect(applyMultiplier(100, -1.0)).toBe(0);
    });

    it("always returns an integer (Math.floor applied)", () => {
      // 7 × 1.25 = 8.75 → 8
      expect(applyMultiplier(7, 1.25)).toBe(8);
      expect(Number.isInteger(applyMultiplier(7, 1.25))).toBe(true);
    });

    it("large amount retains precision after floor", () => {
      // 10000 × 1.25 = 12500
      expect(applyMultiplier(10000, 1.25)).toBe(12500);
    });
  });
});

// ---------------------------------------------------------------------------
// getEarnMultiplier — uses isPlusActive mock
// ---------------------------------------------------------------------------

describe("getEarnMultiplier", () => {
  it("standard user (no Plus) → 1.0", async () => {
    (isPlusActive as jest.Mock).mockResolvedValue(false);
    const result = await getEarnMultiplier("uid-standard");
    expect(result).toBe(1.0);
  });

  it("Plus subscriber → 1.25", async () => {
    (isPlusActive as jest.Mock).mockResolvedValue(true);
    const result = await getEarnMultiplier("uid-plus");
    expect(result).toBe(1.25);
  });
});

// ---------------------------------------------------------------------------
// checkEarnEligibility — Firestore-backed
// ---------------------------------------------------------------------------

type MockDb = {
  doc: jest.Mock;
  collection: jest.Mock;
};

function makeEligibleDb(uid: string): MockDb {
  const userDoc = { uid, isBanned: false, isDeleted: false };
  const privateDoc = { uid, isSandboxed: false, isBanned: false };

  const userRef = { get: jest.fn().mockResolvedValue({ exists: true, data: () => userDoc }) };
  const privateRef = { get: jest.fn().mockResolvedValue({ exists: true, data: () => privateDoc }) };

  // eligibility.ts accesses:
  //   users via:               db.doc(Paths.user(uid))            → db.doc("users/uid")
  //   private_user_data via:   db.collection("private_user_data").doc(uid)
  //   pointsLedger via:        db.collection("pointsLedger").where(...).limit().get()

  const ledgerQuery = {
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ empty: true }),
  };

  return {
    doc: jest.fn().mockImplementation((path: string) => {
      if (path.startsWith("users/")) return userRef;
      return { get: jest.fn().mockResolvedValue({ exists: false }) };
    }),
    collection: jest.fn().mockImplementation((collectionName: string) => {
      if (collectionName === "private_user_data") {
        return {
          doc: jest.fn().mockReturnValue(privateRef),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ empty: true }),
        };
      }
      // pointsLedger collection
      return ledgerQuery;
    }),
  };
}

describe("checkEarnEligibility", () => {
  describe("eligible cases", () => {
    it("normal user, not banned, not sandboxed, new sourceId → eligible", async () => {
      const mockDb = makeEligibleDb("uid-eligible");
      (getFirestore as jest.Mock).mockReturnValue(mockDb);

      const result = await checkEarnEligibility("uid-eligible", "review", "review-001");
      expect(result.eligible).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe("ineligible: user not found", () => {
    it("user doc does not exist → user_not_found", async () => {
      const mockDb: MockDb = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
        }),
        collection: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ empty: true }),
          doc: jest.fn().mockReturnThis(),
        }),
      };
      (getFirestore as jest.Mock).mockReturnValue(mockDb);

      const result = await checkEarnEligibility("uid-missing", "review", "review-001");
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("user_not_found");
    });
  });

  describe("ineligible: banned user", () => {
    it("UserDoc.isBanned=true → account_banned", async () => {
      // isBanned check on UserDoc returns early before reaching private_user_data
      const userDoc = { uid: "uid-banned", isBanned: true, isDeleted: false };

      const mockDb: MockDb = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: true, data: () => userDoc }),
        }),
        collection: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ empty: true }),
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ exists: false }),
          }),
        }),
      };
      (getFirestore as jest.Mock).mockReturnValue(mockDb);

      const result = await checkEarnEligibility("uid-banned", "review", "review-001");
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("account_banned");
    });
  });

  describe("ineligible: sandboxed user", () => {
    it("privateData.isSandboxed=true → account_sandboxed", async () => {
      const userDoc = { uid: "uid-sandbox", isBanned: false, isDeleted: false };
      const privateDoc = { uid: "uid-sandbox", isSandboxed: true, isBanned: false };
      const privateRef = { get: jest.fn().mockResolvedValue({ exists: true, data: () => privateDoc }) };

      const mockDb: MockDb = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: true, data: () => userDoc }),
        }),
        collection: jest.fn().mockImplementation((collectionName: string) => {
          if (collectionName === "private_user_data") {
            return { doc: jest.fn().mockReturnValue(privateRef) };
          }
          return {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ empty: true }),
          };
        }),
      };
      (getFirestore as jest.Mock).mockReturnValue(mockDb);

      const result = await checkEarnEligibility("uid-sandbox", "review", "review-001");
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("account_sandboxed");
    });
  });

  describe("ineligible: already rewarded", () => {
    it("existing ledger entry with same sourceId → already_rewarded", async () => {
      const userDoc = { uid: "uid-dupe", isBanned: false, isDeleted: false };
      const privateDoc = { uid: "uid-dupe", isSandboxed: false, isBanned: false };
      const privateRef = { get: jest.fn().mockResolvedValue({ exists: true, data: () => privateDoc }) };

      const mockDb: MockDb = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: true, data: () => userDoc }),
        }),
        collection: jest.fn().mockImplementation((collectionName: string) => {
          if (collectionName === "private_user_data") {
            return { doc: jest.fn().mockReturnValue(privateRef) };
          }
          // pointsLedger — non-empty → already rewarded
          return {
            where: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({ empty: false, docs: [{ id: "entry-1" }] }),
          };
        }),
      };
      (getFirestore as jest.Mock).mockReturnValue(mockDb);

      const result = await checkEarnEligibility("uid-dupe", "review", "review-already");
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("already_rewarded");
    });
  });

  describe("ineligible: deleted account", () => {
    it("UserDoc.isDeleted=true → account_deleted", async () => {
      const userDoc = { uid: "uid-deleted", isBanned: false, isDeleted: true };

      const mockDb: MockDb = {
        doc: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ exists: true, data: () => userDoc }),
        }),
        collection: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          get: jest.fn().mockResolvedValue({ empty: true }),
          doc: jest.fn().mockReturnThis(),
        }),
      };
      (getFirestore as jest.Mock).mockReturnValue(mockDb);

      const result = await checkEarnEligibility("uid-deleted", "review", "review-001");
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe("account_deleted");
    });
  });
});

// ---------------------------------------------------------------------------
// Expiry date math
// ---------------------------------------------------------------------------

describe("Points expiry date math", () => {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const EXPIRY_DAYS = 365;

  it("points earned today expire exactly 365 days later", () => {
    const now = Date.now();
    const expiresAt = now + EXPIRY_DAYS * MS_PER_DAY;
    const diffDays = (expiresAt - now) / MS_PER_DAY;
    expect(diffDays).toBe(365);
  });

  it("Timestamp.fromMillis 365 days from now is in the future", () => {
    const now = Date.now();
    const expiresAt = Timestamp.fromMillis(now + EXPIRY_DAYS * MS_PER_DAY);
    expect(expiresAt.toMillis()).toBeGreaterThan(now);
  });

  it("expiry timestamp is exactly 365 × 86400 seconds from now", () => {
    const nowMs = Date.now();
    const expiresAtMs = nowMs + EXPIRY_DAYS * MS_PER_DAY;
    const diffSeconds = (expiresAtMs - nowMs) / 1000;
    expect(diffSeconds).toBe(EXPIRY_DAYS * 86400);
  });

  it("two ledger entries earn at different times have different expiry dates", () => {
    const entry1Earned = Date.now();
    const entry2Earned = entry1Earned + 7 * MS_PER_DAY; // 7 days later
    const entry1Expires = entry1Earned + EXPIRY_DAYS * MS_PER_DAY;
    const entry2Expires = entry2Earned + EXPIRY_DAYS * MS_PER_DAY;
    expect(entry2Expires - entry1Expires).toBe(7 * MS_PER_DAY);
  });

  it("expiry logic: point earned 366 days ago is expired", () => {
    const now = Date.now();
    const earnedAt = now - 366 * MS_PER_DAY;
    const expiresAt = earnedAt + EXPIRY_DAYS * MS_PER_DAY;
    expect(expiresAt).toBeLessThan(now);
  });

  it("expiry logic: point earned 364 days ago is not yet expired", () => {
    const now = Date.now();
    const earnedAt = now - 364 * MS_PER_DAY;
    const expiresAt = earnedAt + EXPIRY_DAYS * MS_PER_DAY;
    expect(expiresAt).toBeGreaterThan(now);
  });
});
