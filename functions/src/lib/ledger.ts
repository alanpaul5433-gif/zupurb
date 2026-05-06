/**
 * ledger.ts — Reusable points ledger helpers.
 *
 * All balance mutations go through these functions.
 * Source of truth: pointsLedger/{entryId} (append-only).
 * Fast-read projection: userBalances/{userId}.
 *
 * Used by: B2 (onboarding), B5 (review), B6 (expiry), B7 (badge), B9 (deal), etc.
 */

import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import type * as FirebaseFirestore from "@google-cloud/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import {
  LedgerEntryType,
  PointsLedgerEntry,
  UserBalanceDoc,
  POINTS_LEDGER_COLLECTION,
  Paths,
} from "./schema";
import { redis } from "./redis";
import { CacheKeys, CacheTTL } from "./cacheKeys";

const SCHEMA_VERSION = 1;

export interface AwardPointsParams {
  amount: number;              // positive integer
  type: LedgerEntryType;
  description: string;
  relatedEntityId?: string;    // reviewId, reservationId, dealId, etc.
  relatedEntityType?: string;  // "review" | "reservation" | "deal" | "badge" | etc.
  expiresAt?: Timestamp;       // default: now + RC:points.expiryMonths (12 mo)
  multiplierApplied?: number;  // integer × 100; e.g., 125 = 1.25×. Default 100.
}

export interface SpendPointsParams {
  amount: number;              // positive integer (stored as negative delta in ledger)
  type: LedgerEntryType;
  description: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
}

// ---------------------------------------------------------------------------
// Extended ledger helpers (B5)
// ---------------------------------------------------------------------------

/**
 * Get all ledger entries for a user that expire within the next N days.
 * Used for expiry-warning notifications and wallet display.
 */
export async function getExpiringEntries(
  uid: string,
  withinDays: number
): Promise<PointsLedgerEntry[]> {
  const db = getFirestore();
  const now = Timestamp.now();
  const cutoff = Timestamp.fromMillis(now.toMillis() + withinDays * 24 * 60 * 60 * 1000);

  const snap = await db
    .collection(POINTS_LEDGER_COLLECTION)
    .where("userId", "==", uid)
    .where("isExpired", "==", false)
    .where("expiresAt", "<=", cutoff)
    .where("expiresAt", ">", now)
    .orderBy("expiresAt", "asc")
    .get();

  return snap.docs.map((d) => d.data() as PointsLedgerEntry);
}

/**
 * Get paginated ledger history for a user, descending by createdAt.
 */
export async function getLedgerHistory(
  uid: string,
  limit: number,
  afterDoc?: FirebaseFirestore.DocumentSnapshot
): Promise<PointsLedgerEntry[]> {
  const db = getFirestore();
  let query = db
    .collection(POINTS_LEDGER_COLLECTION)
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit);

  if (afterDoc) {
    query = query.startAfter(afterDoc);
  }

  const snap = await query.get();
  return snap.docs.map((d) => d.data() as PointsLedgerEntry);
}

/**
 * Expire stale points: mark entries as expired where expiresAt < now and isExpired != true.
 * Updates the userBalances projection atomically.
 * Returns the total points expired in this call.
 *
 * Idempotent: safe to call multiple times; already-expired entries are skipped.
 */
export async function expireStalePoints(uid: string): Promise<number> {
  const db = getFirestore();
  const now = Timestamp.now();

  // Find all non-expired entries that have passed their expiry date
  const snap = await db
    .collection(POINTS_LEDGER_COLLECTION)
    .where("userId", "==", uid)
    .where("isExpired", "==", false)
    .where("expiresAt", "<=", now)
    // Only earn entries have expiresAt set; spend entries have null
    .where("expiresAt", "!=", null)
    .get();

  if (snap.empty) return 0;

  let totalExpired = 0;
  const BATCH_SIZE = 400; // Firestore batch write limit

  // Process in Firestore transaction slices (≤500 ops each)
  // We use batched writes here since we just need to mark expired + update balance
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const slice = snap.docs.slice(i, i + BATCH_SIZE);
    let sliceTotal = 0;

    // Collect amounts
    for (const doc of slice) {
      const entry = doc.data() as PointsLedgerEntry;
      if (entry.delta > 0) {
        sliceTotal += entry.delta;
      }
    }

    if (sliceTotal === 0) continue;

    // Run atomically: mark each entry expired + decrement balance
    await db.runTransaction(async (tx) => {
      // Re-read each entry inside tx to prevent double-expiry races
      const freshSnaps = await Promise.all(slice.map((d) => tx.get(d.ref)));
      let actualTotal = 0;

      for (const freshDoc of freshSnaps) {
        if (!freshDoc.exists) continue;
        const entry = freshDoc.data() as PointsLedgerEntry;
        if (entry.isExpired) continue; // already handled by concurrent call
        if (entry.delta > 0) {
          actualTotal += entry.delta;
        }
        tx.update(freshDoc.ref, { isExpired: true });
      }

      if (actualTotal === 0) return;

      const balanceRef = db.doc(Paths.userBalance(uid));
      const balanceSnap = await tx.get(balanceRef);

      if (balanceSnap.exists) {
        tx.update(balanceRef, {
          balance: FieldValue.increment(-actualTotal),
          updatedAt: Timestamp.now(),
        });
      }

      // Mirror to users/{uid}.pointsBalance
      const userRef = db.doc(Paths.user(uid));
      tx.update(userRef, {
        pointsBalance: FieldValue.increment(-actualTotal),
        updatedAt: Timestamp.now(),
      });

      totalExpired += actualTotal;
    });
  }

  return totalExpired;
}

// ---------------------------------------------------------------------------
// Original functions below (unchanged)
// ---------------------------------------------------------------------------

/**
 * Award points to a user atomically.
 * Appends a ledger entry and updates the userBalances projection.
 */
export async function awardPoints(uid: string, params: AwardPointsParams): Promise<void> {
  const db = getFirestore();
  const multiplier = params.multiplierApplied ?? 100;

  // RC: points.expiryMonths — default 12 months from now
  const expiresAt: Timestamp = params.expiresAt ?? (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 12); // RC: points.expiryMonths
    return Timestamp.fromDate(d);
  })();

  await db.runTransaction(async (tx) => {
    const balanceRef = db.doc(Paths.userBalance(uid));
    const balanceSnap = await tx.get(balanceRef);

    const currentBalance = balanceSnap.exists
      ? (balanceSnap.data() as UserBalanceDoc).balance
      : 0;
    const balanceAfter = currentBalance + params.amount;

    // Append ledger entry with deterministic-ish ID: uid_type_timestamp
    const entryId = `${uid}_${params.type}_${Date.now()}`;
    const entryRef = db.collection(POINTS_LEDGER_COLLECTION).doc(entryId);

    const entry: PointsLedgerEntry = {
      entryId,
      userId: uid,
      delta: params.amount,
      type: params.type,
      sourceId: params.relatedEntityId ?? null,
      sourceType: params.relatedEntityType ?? null,
      description: params.description,
      balanceAfter,
      expiresAt,
      isExpired: false,
      multiplierApplied: multiplier,
      createdAt: Timestamp.now(),
      schemaVersion: SCHEMA_VERSION,
    };

    tx.set(entryRef, entry);

    // Upsert the balance projection
    if (balanceSnap.exists) {
      tx.update(balanceRef, {
        balance: FieldValue.increment(params.amount),
        lifetimeEarned: FieldValue.increment(params.amount),
        updatedAt: Timestamp.now(),
      });
    } else {
      const balanceDoc: UserBalanceDoc = {
        userId: uid,
        balance: params.amount,
        lifetimeEarned: params.amount,
        lifetimeSpent: 0,
        updatedAt: Timestamp.now(),
      };
      tx.set(balanceRef, balanceDoc);
    }

    // Mirror onto users/{uid}.pointsBalance (denormalized for profile reads)
    const userRef = db.doc(Paths.user(uid));
    tx.update(userRef, {
      pointsBalance: FieldValue.increment(params.amount),
      updatedAt: Timestamp.now(),
    });
  });

  // Invalidate Redis balance cache so next read reflects the new balance
  await redis.del(CacheKeys.userBalance(uid));
}

/**
 * Spend points atomically. Throws `failed-precondition` if balance is insufficient.
 */
export async function spendPoints(uid: string, params: SpendPointsParams): Promise<void> {
  const db = getFirestore();

  await db.runTransaction(async (tx) => {
    const balanceRef = db.doc(Paths.userBalance(uid));
    const balanceSnap = await tx.get(balanceRef);

    if (!balanceSnap.exists) {
      throw new HttpsError("failed-precondition", "Insufficient points balance.");
    }

    const currentBalance = (balanceSnap.data() as UserBalanceDoc).balance;
    if (currentBalance < params.amount) {
      throw new HttpsError(
        "failed-precondition",
        `Insufficient points. Need ${params.amount}, have ${currentBalance}.`
      );
    }

    const balanceAfter = currentBalance - params.amount;
    const entryId = `${uid}_${params.type}_${Date.now()}`;
    const entryRef = db.collection(POINTS_LEDGER_COLLECTION).doc(entryId);

    const entry: PointsLedgerEntry = {
      entryId,
      userId: uid,
      delta: -params.amount,
      type: params.type,
      sourceId: params.relatedEntityId ?? null,
      sourceType: params.relatedEntityType ?? null,
      description: params.description,
      balanceAfter,
      expiresAt: null,   // spend entries do not expire
      isExpired: false,
      multiplierApplied: 100,
      createdAt: Timestamp.now(),
      schemaVersion: SCHEMA_VERSION,
    };

    tx.set(entryRef, entry);

    tx.update(balanceRef, {
      balance: FieldValue.increment(-params.amount),
      lifetimeSpent: FieldValue.increment(params.amount),
      updatedAt: Timestamp.now(),
    });

    const userRef = db.doc(Paths.user(uid));
    tx.update(userRef, {
      pointsBalance: FieldValue.increment(-params.amount),
      updatedAt: Timestamp.now(),
    });
  });

  // Invalidate Redis balance cache so next read reflects the new balance
  await redis.del(CacheKeys.userBalance(uid));
}

/**
 * Get the current spendable balance for a user (excludes expired entries).
 * Reads from Redis (1 min TTL) first, then falls back to Firestore.
 * Note: expired entries are purged by the scheduled expiry job (B6); this
 *       function trusts the projection as the fast-read cache.
 */
export async function getBalance(uid: string): Promise<number> {
  // 1. Try Redis  RC: cache_ttl_balance (60s)
  const cached = await redis.get<number>(CacheKeys.userBalance(uid));
  if (cached !== null) return cached;

  // 2. Firestore fallback
  const db = getFirestore();
  const balanceSnap = await db.doc(Paths.userBalance(uid)).get();
  if (!balanceSnap.exists) return 0;

  const balance = (balanceSnap.data() as UserBalanceDoc).balance;

  // Warm Redis (best-effort)
  redis.set(CacheKeys.userBalance(uid), balance, CacheTTL.userBalance)
    .catch(() => { /* non-critical */ });

  return balance;
}
