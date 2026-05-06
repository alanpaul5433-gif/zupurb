/**
 * Unit tests for functions/src/lib/tiers.ts
 * Covers: computeTier, getTierMultiplier, computeRolling12MonthPts
 *         isUpgrade, isDowngrade (bonus coverage)
 *
 * T1 — Milestone B14
 */

// ---------------------------------------------------------------------------
// Module mocks — tiers.ts imports from ledger, badges, notify, logging
// ---------------------------------------------------------------------------

jest.mock("./ledger", () => ({
  awardPoints: jest.fn().mockResolvedValue(undefined),
}), { virtual: true });

jest.mock("../lib/ledger", () => ({
  awardPoints: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../lib/badges", () => ({
  unlockBadge: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../lib/notify", () => ({
  sendNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../lib/logging", () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  newTraceId: () => "test-trace",
}));

jest.mock("../lib/plus", () => ({
  activatePlus: jest.fn().mockResolvedValue(undefined),
  deactivatePlus: jest.fn().mockResolvedValue(undefined),
  isPlusActive: jest.fn().mockResolvedValue(false),
}), { virtual: true });

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  computeTier,
  getTierMultiplier,
  computeRolling12MonthPts,
  isUpgrade,
  isDowngrade,
} from "../lib/tiers";
import { Timestamp, getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// computeTier
// ---------------------------------------------------------------------------

describe("computeTier", () => {
  describe("Bronze tier", () => {
    it("0 pts → bronze", () => {
      expect(computeTier(0)).toBe("bronze");
    });

    it("1 pt → bronze", () => {
      expect(computeTier(1)).toBe("bronze");
    });

    it("999 pts → bronze (boundary below silver)", () => {
      expect(computeTier(999)).toBe("bronze");
    });

    it("negative pts → bronze (handles underflow gracefully)", () => {
      expect(computeTier(-100)).toBe("bronze");
    });
  });

  describe("Silver tier", () => {
    it("1000 pts → silver (exact threshold)", () => {
      expect(computeTier(1000)).toBe("silver");
    });

    it("2500 pts → silver", () => {
      expect(computeTier(2500)).toBe("silver");
    });

    it("4999 pts → silver (boundary below gold)", () => {
      expect(computeTier(4999)).toBe("silver");
    });
  });

  describe("Gold tier", () => {
    it("5000 pts → gold (exact threshold)", () => {
      expect(computeTier(5000)).toBe("gold");
    });

    it("10000 pts → gold", () => {
      expect(computeTier(10000)).toBe("gold");
    });

    it("14999 pts → gold (boundary below platinum)", () => {
      expect(computeTier(14999)).toBe("gold");
    });
  });

  describe("Platinum tier", () => {
    it("15000 pts → platinum (exact threshold)", () => {
      expect(computeTier(15000)).toBe("platinum");
    });

    it("100000 pts → platinum", () => {
      expect(computeTier(100000)).toBe("platinum");
    });

    it("Number.MAX_SAFE_INTEGER → platinum", () => {
      expect(computeTier(Number.MAX_SAFE_INTEGER)).toBe("platinum");
    });
  });
});

// ---------------------------------------------------------------------------
// getTierMultiplier
// ---------------------------------------------------------------------------

describe("getTierMultiplier", () => {
  it("bronze → 100 (1.0×)", () => {
    expect(getTierMultiplier("bronze")).toBe(100);
  });

  it("silver → 110 (1.1×)", () => {
    expect(getTierMultiplier("silver")).toBe(110);
  });

  it("gold → 120 (1.2×)", () => {
    expect(getTierMultiplier("gold")).toBe(120);
  });

  it("platinum → 125 (1.25×)", () => {
    expect(getTierMultiplier("platinum")).toBe(125);
  });

  it("multipliers are integer × 100 — all are integers", () => {
    const tiers = ["bronze", "silver", "gold", "platinum"] as const;
    for (const tier of tiers) {
      expect(Number.isInteger(getTierMultiplier(tier))).toBe(true);
    }
  });

  it("each tier has a distinct multiplier", () => {
    const multipliers = [
      getTierMultiplier("bronze"),
      getTierMultiplier("silver"),
      getTierMultiplier("gold"),
      getTierMultiplier("platinum"),
    ];
    const unique = new Set(multipliers);
    expect(unique.size).toBe(4);
  });

  it("higher tier always has higher or equal multiplier", () => {
    expect(getTierMultiplier("silver")).toBeGreaterThan(getTierMultiplier("bronze"));
    expect(getTierMultiplier("gold")).toBeGreaterThan(getTierMultiplier("silver"));
    expect(getTierMultiplier("platinum")).toBeGreaterThan(getTierMultiplier("gold"));
  });
});

// ---------------------------------------------------------------------------
// isUpgrade / isDowngrade (bonus coverage — no Firestore needed)
// ---------------------------------------------------------------------------

describe("isUpgrade", () => {
  it("bronze → silver = upgrade", () => expect(isUpgrade("bronze", "silver")).toBe(true));
  it("bronze → gold = upgrade", () => expect(isUpgrade("bronze", "gold")).toBe(true));
  it("silver → bronze = not upgrade", () => expect(isUpgrade("silver", "bronze")).toBe(false));
  it("same tier = not upgrade", () => expect(isUpgrade("gold", "gold")).toBe(false));
  it("gold → platinum = upgrade", () => expect(isUpgrade("gold", "platinum")).toBe(true));
});

describe("isDowngrade", () => {
  it("silver → bronze = downgrade", () => expect(isDowngrade("silver", "bronze")).toBe(true));
  it("platinum → gold = downgrade", () => expect(isDowngrade("platinum", "gold")).toBe(true));
  it("bronze → silver = not downgrade", () => expect(isDowngrade("bronze", "silver")).toBe(false));
  it("same tier = not downgrade", () => expect(isDowngrade("bronze", "bronze")).toBe(false));
});

// ---------------------------------------------------------------------------
// computeRolling12MonthPts — Firestore-backed
// ---------------------------------------------------------------------------

describe("computeRolling12MonthPts", () => {
  let mockGet: jest.Mock;
  let mockSelect: jest.Mock;
  let mockWhere: jest.Mock;
  let mockCollection: jest.Mock;
  let mockDb: Record<string, unknown>;

  function buildChainMock(docs: Array<{ delta: number }>) {
    mockGet = jest.fn().mockResolvedValue({
      docs: docs.map((d) => ({ data: () => d })),
    });
    mockSelect = jest.fn().mockReturnValue({ get: mockGet });
    mockWhere = jest.fn().mockReturnThis();
    mockCollection = jest.fn().mockReturnValue({
      where: mockWhere,
      select: mockSelect,
      get: mockGet,
    });
    // Chain where().where().where().select().get()
    (mockWhere as jest.Mock).mockImplementation(function (this: unknown) {
      return {
        where: mockWhere,
        select: mockSelect,
        get: mockGet,
      };
    });
    mockDb = { collection: mockCollection };
    (getFirestore as jest.Mock).mockReturnValue(mockDb);
  }

  it("sums only positive delta entries within 12 months", async () => {
    buildChainMock([{ delta: 100 }, { delta: 250 }, { delta: 50 }]);
    const result = await computeRolling12MonthPts("uid-1");
    expect(result).toBe(400);
  });

  it("returns 0 when no entries exist", async () => {
    buildChainMock([]);
    const result = await computeRolling12MonthPts("uid-empty");
    expect(result).toBe(0);
  });

  it("single entry — returns its delta", async () => {
    buildChainMock([{ delta: 500 }]);
    const result = await computeRolling12MonthPts("uid-single");
    expect(result).toBe(500);
  });

  it("Firestore query filters delta > 0 at DB level — test accumulator handles missing delta", async () => {
    // Simulate entry with undefined delta (defensive)
    buildChainMock([{ delta: 100 }, { delta: undefined as unknown as number }]);
    const result = await computeRolling12MonthPts("uid-partial");
    // undefined ?? 0 → treated as 0
    expect(result).toBe(100);
  });

  it("large point accumulation sums correctly", async () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({ delta: (i + 1) * 10 }));
    // Sum = 10 + 20 + ... + 1000 = 10 * (1+2+...+100) = 10 * 5050 = 50500
    buildChainMock(entries);
    const result = await computeRolling12MonthPts("uid-large");
    expect(result).toBe(50500);
  });
});
