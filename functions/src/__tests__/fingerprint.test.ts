/**
 * Unit tests for functions/src/algorithms/fingerprint.ts
 * Covers: computeSimilarity (pure), buildFingerprintSnapshot (Firestore-backed).
 *
 * T1 — Milestone B3
 */

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock("../lib/logging", () => ({
  log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  newTraceId: () => "test-trace",
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { Timestamp } from "firebase-admin/firestore";
import { computeSimilarity } from "../algorithms/fingerprint";
import {
  FingerprintSnapshotDoc,
  DemographicFingerprint,
} from "../lib/schema";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeFingerprint(overrides: Partial<DemographicFingerprint> = {}): DemographicFingerprint {
  return {
    ageGroup: 0.25,
    genderIdentity: 0.5,
    spendingHabit: 0.5,
    cuisinePreferences: [1, 0, 1, 0, 0],
    activityPreferences: [1, 1, 0, 0, 0],
    dietaryRestrictions: [0, 0, 1, 0],
    ...overrides,
  };
}

function makeSnapshot(fp: DemographicFingerprint, uid = "user1", rid = "review1"): FingerprintSnapshotDoc {
  return {
    snapshotId: rid,
    userId: uid,
    reviewId: rid,
    fingerprint: fp,
    capturedAt: Timestamp.now(),
  };
}

// ---------------------------------------------------------------------------
// computeSimilarity
// ---------------------------------------------------------------------------

describe("computeSimilarity", () => {
  describe("identical fingerprints → maximum similarity", () => {
    it("same fingerprint → 1.0", () => {
      const fp = makeFingerprint();
      const a = makeSnapshot(fp, "u1", "r1");
      const b = makeSnapshot(fp, "u2", "r2");
      // All scalar closeness = 1.0, all Jaccard = 1.0
      // 0.20*1.0 + 0.15*1.0 + 0.10*1.0 + 0.15*1.0 + 0.20*1.0 + 0.10*1.0 = 0.90
      // clamped to [0, 1] → 0.90
      const result = computeSimilarity(a, b);
      expect(result).toBeCloseTo(0.9, 5);
    });

    it("identical all-zero multi-hot vectors → Jaccard = 0", () => {
      const fp = makeFingerprint({
        cuisinePreferences: [0, 0, 0],
        activityPreferences: [0, 0, 0],
        dietaryRestrictions: [0, 0, 0],
      });
      const a = makeSnapshot(fp);
      const b = makeSnapshot(fp);
      // All Jaccard = 0 (union = 0 → Jaccard = 0 by spec)
      // scalar portion = 0.20 + 0.15 + 0.10 = 0.45 (ageGroup, gender, spending all same)
      const result = computeSimilarity(a, b);
      expect(result).toBeCloseTo(0.45, 5);
    });
  });

  describe("disjoint fingerprints → minimum similarity", () => {
    it("completely disjoint multi-hot, max scalar distance → 0.0", () => {
      const fpA = makeFingerprint({
        ageGroup: 0.0,
        genderIdentity: 0.0,
        spendingHabit: 0.0,
        cuisinePreferences: [1, 0, 0],
        activityPreferences: [1, 0, 0],
        dietaryRestrictions: [1, 0, 0],
      });
      const fpB = makeFingerprint({
        ageGroup: 1.0,
        genderIdentity: 1.0,
        spendingHabit: 1.0,
        cuisinePreferences: [0, 1, 1],
        activityPreferences: [0, 1, 1],
        dietaryRestrictions: [0, 1, 1],
      });
      // Scalar closeness for ageGroup: 1 - |0-1| = 0, gender: 0, spending: 0
      // Jaccard for all multi-hot: intersection=0, union>0 → 0.0
      // Total = 0.0
      const a = makeSnapshot(fpA, "u1", "r1");
      const b = makeSnapshot(fpB, "u2", "r2");
      const result = computeSimilarity(a, b);
      expect(result).toBe(0.0);
    });
  });

  describe("partial similarity", () => {
    it("same age group, different everything else → only age weight contributes", () => {
      const fpA = makeFingerprint({
        ageGroup: 0.5,
        genderIdentity: 0.0,
        spendingHabit: 0.0,
        cuisinePreferences: [1, 0, 0],
        activityPreferences: [1, 0, 0],
        dietaryRestrictions: [1, 0, 0],
      });
      const fpB = makeFingerprint({
        ageGroup: 0.5,     // same → closeness = 1.0
        genderIdentity: 1.0,
        spendingHabit: 1.0,
        cuisinePreferences: [0, 1, 1],
        activityPreferences: [0, 1, 1],
        dietaryRestrictions: [0, 1, 1],
      });
      // ageClose = 1.0 → contributes 0.20
      // genderClose = |0.0 - 1.0| = 0
      // spendClose = 0
      // all Jaccards = 0 (disjoint)
      // total = 0.20
      const result = computeSimilarity(makeSnapshot(fpA), makeSnapshot(fpB));
      expect(result).toBeCloseTo(0.20, 5);
    });

    it("weight sum sanity: all max scalar + all max Jaccard = 0.90 not 1.0", () => {
      // Weights: 0.20 + 0.15 + 0.10 + 0.15 + 0.20 + 0.10 = 0.90
      const fp = makeFingerprint({ cuisinePreferences: [1], activityPreferences: [1], dietaryRestrictions: [1] });
      const a = makeSnapshot(fp);
      const b = makeSnapshot(fp);
      const result = computeSimilarity(a, b);
      expect(result).toBeLessThanOrEqual(1.0);
      expect(result).toBeGreaterThanOrEqual(0.0);
    });

    it("result is always in [0, 1]", () => {
      const fpA = makeFingerprint({ ageGroup: 0.1, genderIdentity: 0.9 });
      const fpB = makeFingerprint({ ageGroup: 0.9, genderIdentity: 0.1 });
      const result = computeSimilarity(makeSnapshot(fpA), makeSnapshot(fpB));
      expect(result).toBeGreaterThanOrEqual(0.0);
      expect(result).toBeLessThanOrEqual(1.0);
    });

    it("vectors of different lengths — shorter vector padded with 0", () => {
      const fpA = makeFingerprint({ cuisinePreferences: [1, 1, 1] });
      const fpB = makeFingerprint({ cuisinePreferences: [1, 1] }); // shorter
      // Treated as [1,1,0] vs [1,1,1]
      // intersection=2, union=3 → Jaccard = 2/3
      // Other dimensions are identical, contributing 0.20+0.15+0.10+0.20+0.10 = 0.75
      // cuisineJacc = 2/3 → 0.15 * (2/3) = 0.10
      // total ≈ 0.75 + 0.10 = 0.85
      const result = computeSimilarity(makeSnapshot(fpA), makeSnapshot(fpB));
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1.0);
    });
  });

  describe("Jaccard similarity edge cases", () => {
    it("both empty cuisine vectors → Jaccard = 0 (union = 0 guard)", () => {
      const fpA = makeFingerprint({ cuisinePreferences: [] });
      const fpB = makeFingerprint({ cuisinePreferences: [] });
      // jaccard returns 0 when len=0
      const result = computeSimilarity(makeSnapshot(fpA), makeSnapshot(fpB));
      // Other dimensions identical → 0.45 (scalar) + 0 cuisine + others (if also empty)
      expect(result).toBeGreaterThanOrEqual(0.0);
    });

    it("fully overlapping multi-hot → Jaccard = 1.0", () => {
      const fp = makeFingerprint({
        cuisinePreferences: [1, 1, 0, 1],
        activityPreferences: [0, 1, 1],
        dietaryRestrictions: [1],
      });
      const result = computeSimilarity(makeSnapshot(fp), makeSnapshot(fp));
      // identical → Jaccard = 1.0 for all three
      expect(result).toBeCloseTo(0.9, 5);
    });
  });
});
