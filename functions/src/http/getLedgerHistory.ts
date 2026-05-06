/**
 * getLedgerHistory.ts — Paginated ledger history callable.
 *
 * Input:  { limit?: number; afterEntryId?: string }
 * Output: { entries: PointsLedgerEntry[]; nextCursor: string | null }
 *
 * Default limit: 20, max: 50.
 * Entries sorted descending by createdAt.
 *
 * Milestone: B5
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { PointsLedgerEntry, POINTS_LEDGER_COLLECTION } from "../lib/schema";
import { log, newTraceId } from "../lib/logging";

const InputSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(20),
  afterEntryId: z.string().optional(),
});

export const getLedgerHistory = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }
    const uid = request.auth.uid;

    const parsed = InputSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new HttpsError("invalid-argument", parsed.error.message);
    }
    const { limit, afterEntryId } = parsed.data;

    log.info("getLedgerHistory: start", {
      traceId, userId: uid, domain: "points", eventId: `ledger_${uid}`,
    }, { limit, afterEntryId });

    const db = getFirestore();

    let query = db
      .collection(POINTS_LEDGER_COLLECTION)
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (afterEntryId) {
      const cursorSnap = await db
        .collection(POINTS_LEDGER_COLLECTION)
        .doc(afterEntryId)
        .get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    }

    const snap = await query.get();
    const entries = snap.docs.map((d) => d.data() as PointsLedgerEntry);
    const nextCursor = entries.length === limit
      ? (snap.docs[snap.docs.length - 1].id ?? null)
      : null;

    return { entries, nextCursor };
  }
);
