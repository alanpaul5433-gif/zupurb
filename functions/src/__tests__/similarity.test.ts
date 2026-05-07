/**
 * Unit tests for functions/src/algorithms/similarity.ts
 * Covers: computeTextSimilarity (pure), computeReviewSimilarityBatch (Firestore-backed)
 *
 * T1 — Milestone B3
 */

// ---------------------------------------------------------------------------
// No module mocks needed for pure function tests.
// computeReviewSimilarityBatch tests mock Firestore manually.
// ---------------------------------------------------------------------------

import {
  computeTextSimilarity,
  computeReviewSimilarityBatch,
} from "../algorithms/similarity";

// ---------------------------------------------------------------------------
// computeTextSimilarity — pure function
// ---------------------------------------------------------------------------

describe("computeTextSimilarity", () => {
  describe("identical text", () => {
    it("identical strings → 1.0", () => {
      const text = "The food was absolutely amazing and the service was great";
      expect(computeTextSimilarity(text, text)).toBe(1.0);
    });

    it("identical after normalisation (different case) → 1.0", () => {
      const a = "GREAT FOOD AND SERVICE";
      const b = "great food and service";
      expect(computeTextSimilarity(a, b)).toBe(1.0);
    });

    it("identical after punctuation removal → 1.0", () => {
      const a = "Great food, amazing service!";
      const b = "Great food  amazing service";
      // After normalisation: "great food amazing service" for both
      expect(computeTextSimilarity(a, b)).toBe(1.0);
    });
  });

  describe("completely different text → 0.0", () => {
    it("no shared bigrams → 0.0", () => {
      const a = "the food was delicious amazing";
      const b = "terrible service cold drinks";
      // No shared bigrams
      const result = computeTextSimilarity(a, b);
      expect(result).toBe(0.0);
    });

    it("single unshared words → 0.0", () => {
      // Each is 1 word → unigram; no overlap
      const result = computeTextSimilarity("alpha", "beta");
      expect(result).toBe(0.0);
    });
  });

  describe("empty string edge cases", () => {
    it("both empty strings → 0.0", () => {
      expect(computeTextSimilarity("", "")).toBe(0.0);
    });

    it("one empty string → 0.0", () => {
      expect(computeTextSimilarity("great food", "")).toBe(0.0);
      expect(computeTextSimilarity("", "great food")).toBe(0.0);
    });

    it("whitespace-only string → 0.0 (treated as empty)", () => {
      expect(computeTextSimilarity("   ", "great food")).toBe(0.0);
    });
  });

  describe("partial overlap", () => {
    it("single shared bigram in different contexts → low score > 0", () => {
      // bigrams of A: {"great food", "food was"}
      // bigrams of B: {"great food", "food here"}
      // intersection=1 ("great food"), union=3
      // Jaccard = 1/3 ≈ 0.333
      const a = "great food was amazing";
      const b = "great food here today";
      const result = computeTextSimilarity(a, b);
      // intersection ≥ 1, result > 0
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1.0);
    });

    it("result is always in [0, 1]", () => {
      const a = "wonderful experience at this restaurant";
      const b = "wonderful experience at this place";
      const result = computeTextSimilarity(a, b);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1.0);
    });

    it("copy-paste review (one extra word) → high similarity close to 1.0", () => {
      const base = "great food amazing service would recommend";
      const modified = "great food amazing service would recommend definitely";
      const result = computeTextSimilarity(base, modified);
      // Almost all bigrams shared — score should be high
      expect(result).toBeGreaterThan(0.7);
    });

    it("adding completely unrelated words reduces similarity", () => {
      const a = "the food was great";
      const b = "the food was great but parking is terrible and staff rude";
      const exact = computeTextSimilarity(a, a);
      const partial = computeTextSimilarity(a, b);
      expect(partial).toBeLessThan(exact);
      expect(partial).toBeGreaterThan(0);
    });
  });

  describe("single token texts", () => {
    it("two identical single-word strings → 1.0 (unigram fallback)", () => {
      expect(computeTextSimilarity("amazing", "amazing")).toBe(1.0);
    });

    it("two different single-word strings → 0.0", () => {
      expect(computeTextSimilarity("amazing", "terrible")).toBe(0.0);
    });
  });
});

// ---------------------------------------------------------------------------
// computeReviewSimilarityBatch — Firestore-backed
// ---------------------------------------------------------------------------

describe("computeReviewSimilarityBatch", () => {
  function makeDb(bodies: string[]) {
    const docs = bodies.map((body) => ({ data: () => ({ body }) }));
    return {
      collection: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: bodies.length === 0,
          size: bodies.length,
          docs,
        }),
      }),
    } as unknown as FirebaseFirestore.Firestore;
  }

  it("no reviews → returns 0 averageSimilarity, 0 pairs", async () => {
    const db = makeDb([]);
    const result = await computeReviewSimilarityBatch("uid-empty", db);
    expect(result.averageSimilarity).toBe(0);
    expect(result.pairCount).toBe(0);
    expect(result.reviewCount).toBe(0);
  });

  it("single review → 0 pairs, reviewCount=1", async () => {
    const db = makeDb(["great food and service"]);
    const result = await computeReviewSimilarityBatch("uid-one", db);
    expect(result.pairCount).toBe(0);
    expect(result.reviewCount).toBe(1);
    expect(result.averageSimilarity).toBe(0);
  });

  it("two identical reviews → averageSimilarity = 1.0", async () => {
    const text = "the food was absolutely amazing and the service was great";
    const db = makeDb([text, text]);
    const result = await computeReviewSimilarityBatch("uid-identical", db);
    expect(result.pairCount).toBe(1);
    expect(result.averageSimilarity).toBe(1.0);
  });

  it("two completely different reviews → averageSimilarity near 0", async () => {
    const db = makeDb([
      "amazing food delicious atmosphere warm staff",
      "terrible parking cold drinks rude service",
    ]);
    const result = await computeReviewSimilarityBatch("uid-diff", db);
    expect(result.pairCount).toBe(1);
    expect(result.averageSimilarity).toBe(0.0);
  });

  it("three reviews: pair count = 3", async () => {
    const db = makeDb([
      "great food and service",
      "great food and ambiance",
      "completely different place cold drinks",
    ]);
    const result = await computeReviewSimilarityBatch("uid-three", db);
    // pairs: (0,1), (0,2), (1,2) = 3
    expect(result.pairCount).toBe(3);
    expect(result.reviewCount).toBe(3);
    expect(result.averageSimilarity).toBeGreaterThanOrEqual(0);
    expect(result.averageSimilarity).toBeLessThanOrEqual(1.0);
  });

  it("averageSimilarity is rounded to 4 decimal places", async () => {
    const db = makeDb([
      "great food and service here",
      "great food and service today",
      "great food and drinks today",
    ]);
    const result = await computeReviewSimilarityBatch("uid-round", db);
    // Check the string representation has at most 4 decimal places
    const decimals = result.averageSimilarity.toString().split(".")[1]?.length ?? 0;
    expect(decimals).toBeLessThanOrEqual(4);
  });

  it("empty body reviews are filtered out (body trimmed to empty)", async () => {
    // One real review, two empty-body reviews
    const db = makeDb(["great food and service", "", "   "]);
    const result = await computeReviewSimilarityBatch("uid-mixed", db);
    // Only 1 non-empty body → not enough for pairs
    expect(result.pairCount).toBe(0);
    expect(result.averageSimilarity).toBe(0);
  });

  it("shill-like scenario: many near-identical reviews → high averageSimilarity", async () => {
    const bodies = [
      "great food amazing service would definitely recommend",
      "great food amazing service would definitely visit again",
      "great food amazing service would definitely come back",
      "great food amazing service would definitely return soon",
    ];
    const db = makeDb(bodies);
    const result = await computeReviewSimilarityBatch("uid-shill", db);
    // Most bigrams are shared → high similarity
    expect(result.averageSimilarity).toBeGreaterThan(0.5);
    expect(result.pairCount).toBe(6); // C(4,2) = 6
  });
});
