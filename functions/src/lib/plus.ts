/**
 * plus.ts — Zupurb Plus membership lifecycle utilities.
 *
 * Plus can be activated by:
 *   - IAP purchase (RevenueCat webhook — integrations I7)
 *   - Platinum tier (automatic, free while Platinum)
 *
 * isPlusActive checks BOTH plusActive: true AND plusActiveUntil > now.
 * Field alone is not sufficient — always call isPlusActive() for eligibility checks.
 *
 * Milestone: B14
 */

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { Paths } from "./schema";
import { unlockBadge } from "./badges";
import { sendNotification } from "./notify";
import { log, newTraceId } from "./logging";

// ---------------------------------------------------------------------------
// activatePlus
// ---------------------------------------------------------------------------

/**
 * Activate (or renew) Zupurb Plus for a user.
 * - Sets plusActive: true, plusActivatedAt: now, plusActiveUntil: now + durationDays
 * - Awards 'plus_activated' badge on first activation
 * - Sends activation notification
 */
export async function activatePlus(
  uid: string,
  durationDays: number,
  source: "iap" | "platinum_tier"
): Promise<void> {
  const traceId = newTraceId();
  const db = getFirestore();
  const now = Timestamp.now();
  const activeUntil = Timestamp.fromMillis(
    now.toMillis() + durationDays * 24 * 60 * 60 * 1000
  );

  // Check if this is the first Plus activation (for badge)
  const userSnap = await db.doc(Paths.user(uid)).get();
  const wasAlreadyPlus = userSnap.exists
    ? (userSnap.data() as { plusActive?: boolean }).plusActive === true
    : false;

  await db.doc(Paths.user(uid)).update({
    plusActive: true,
    plusActivatedAt: now,
    plusActiveUntil: activeUntil,
    plusSource: source,
    updatedAt: now,
  });

  // Award plus_activated badge on first activation only
  if (!wasAlreadyPlus) {
    try {
      await unlockBadge(uid, "plus_activated", traceId);
    } catch (err) {
      log.warn("activatePlus: badge unlock failed", {
        traceId, userId: uid, domain: "plus", eventId: "activatePlus",
      }, { error: String(err) });
    }
  }

  await sendNotification(uid, {
    type: "system",
    title: "Zupurb Plus Activated!",
    body: "Zupurb Plus is now active! Enjoy 1.25× points and exclusive deals.",
    data: { source, activeUntil: activeUntil.toMillis().toString() },
    relatedEntityId: uid,
    relatedEntityType: "plus",
  });

  log.info("activatePlus: complete", {
    traceId, userId: uid, domain: "plus", eventId: "activatePlus",
  }, { source, durationDays });
}

// ---------------------------------------------------------------------------
// deactivatePlus
// ---------------------------------------------------------------------------

/**
 * Deactivate Zupurb Plus for a user.
 * - Sets plusActive: false, plusDeactivatedAt: now
 * - Sends notification for expiry / tier_downgrade (not refund)
 */
export async function deactivatePlus(
  uid: string,
  reason: "expired" | "tier_downgrade" | "refund"
): Promise<void> {
  const traceId = newTraceId();
  const db = getFirestore();
  const now = Timestamp.now();

  await db.doc(Paths.user(uid)).update({
    plusActive: false,
    plusDeactivatedAt: now,
    updatedAt: now,
  });

  if (reason !== "refund") {
    const body =
      reason === "tier_downgrade"
        ? "Your Zupurb Plus membership has ended because your tier has changed. Keep earning points to reactivate!"
        : "Your Zupurb Plus membership has expired. Renew to continue enjoying exclusive benefits.";

    await sendNotification(uid, {
      type: "system",
      title: "Zupurb Plus Ended",
      body,
      data: { reason },
      relatedEntityId: uid,
      relatedEntityType: "plus",
    });
  }

  log.info("deactivatePlus: complete", {
    traceId, userId: uid, domain: "plus", eventId: "deactivatePlus",
  }, { reason });
}

// ---------------------------------------------------------------------------
// isPlusActive
// ---------------------------------------------------------------------------

/**
 * Returns true only if plusActive === true AND plusActiveUntil > now.
 * Both conditions required — field alone is not sufficient.
 */
export async function isPlusActive(uid: string): Promise<boolean> {
  const db = getFirestore();
  const snap = await db.doc(Paths.user(uid)).get();
  if (!snap.exists) return false;

  const data = snap.data() as {
    plusActive?: boolean;
    plusActiveUntil?: Timestamp | null;
  };

  if (!data.plusActive) return false;
  if (!data.plusActiveUntil) return false;

  return data.plusActiveUntil.toMillis() > Date.now();
}
