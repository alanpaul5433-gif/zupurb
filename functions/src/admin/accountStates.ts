/**
 * accountStates.ts — Account state management for admin actions.
 *
 * Provides: suspendUser, banUser, unsuspendUser, sandboxUser (admin override).
 * Also exports: liftExpiredSuspensions (scheduled, daily 05:00 UTC).
 *
 * State model:
 *   accountStatus field on users/{uid}: 'active' | 'suspended' | 'banned' | 'sandboxed'
 *   suspendedUntil: Timestamp | null — for time-limited suspensions
 *   suspendReason: string | null
 *   bannedAt: Timestamp | null
 *   bannedReason: string | null
 *
 * All callables require the `admin` custom claim (requireAdmin).
 *
 * Milestone: B12
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { Paths, USERS_COLLECTION } from "../lib/schema";
import { requireAdmin } from "../lib/adminGuard";
import { sendNotification } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Shared DB helpers
// ---------------------------------------------------------------------------

/**
 * suspendUser — sets accountStatus='suspended', suspendedUntil, suspendReason.
 * Sends a notification to the user.
 */
export async function suspendUser(
  uid: string,
  reason: string,
  durationHours: number,
  db: FirebaseFirestore.Firestore,
  actorUid = "system",
  traceId?: string
): Promise<void> {
  const now = Timestamp.now();
  const suspendedUntil = Timestamp.fromMillis(now.toMillis() + durationHours * 3600 * 1000);
  const tid = traceId ?? newTraceId();

  await db.doc(Paths.user(uid)).update({
    accountStatus: "suspended",
    suspendedUntil,
    suspendReason: reason,
    updatedAt: now,
  });

  // Audit trail on private_user_data
  const auditLine = `[${now.toDate().toISOString()}] actor:${actorUid} suspended uid:${uid} hours:${durationHours} reason:"${reason}"`;
  await db.doc(Paths.privateUserData(uid)).update({
    internalNotes: FieldValue.arrayUnion(auditLine) as unknown as string,
  }).catch(() => { /* doc may not exist yet — non-fatal */ });

  await sendNotification(uid, {
    type: "system",
    title: "Account suspended",
    body: `Your account has been suspended for ${durationHours} hour(s). Reason: ${reason}`,
    data: { durationHours: String(durationHours), suspendedUntil: suspendedUntil.toDate().toISOString() },
  });

  log.info("suspendUser: complete", {
    traceId: tid, userId: actorUid, domain: "admin", eventId: uid,
  }, { reason, durationHours, suspendedUntil: suspendedUntil.toDate().toISOString() });
}

/**
 * banUser — sets accountStatus='banned', bannedAt, bannedReason; anonymizes PII on user doc.
 */
export async function banUser(
  uid: string,
  reason: string,
  db: FirebaseFirestore.Firestore,
  actorUid = "system",
  traceId?: string
): Promise<void> {
  const now = Timestamp.now();
  const tid = traceId ?? newTraceId();

  // Anonymize PII on the public user doc
  await db.doc(Paths.user(uid)).update({
    accountStatus: "banned",
    bannedAt: now,
    bannedReason: reason,
    // PII anonymization — clear identifying fields
    displayName: "[banned]",
    photoUrl: null,
    bio: null,
    updatedAt: now,
  });

  const auditLine = `[${now.toDate().toISOString()}] actor:${actorUid} banned uid:${uid} reason:"${reason}"`;
  await db.doc(Paths.privateUserData(uid)).update({
    isBanned: true,
    bannedAt: now,
    banReason: reason,
    internalNotes: FieldValue.arrayUnion(auditLine) as unknown as string,
  }).catch(() => { /* non-fatal */ });

  log.warn("banUser: user banned", {
    traceId: tid, userId: actorUid, domain: "admin", eventId: uid,
  }, { reason });
}

/**
 * unsuspendUser — restores accountStatus='active', clears suspension fields.
 */
export async function unsuspendUser(
  uid: string,
  db: FirebaseFirestore.Firestore,
  actorUid = "system",
  traceId?: string,
  notify = true
): Promise<void> {
  const now = Timestamp.now();
  const tid = traceId ?? newTraceId();

  await db.doc(Paths.user(uid)).update({
    accountStatus: "active",
    suspendedUntil: null,
    suspendReason: null,
    updatedAt: now,
  });

  const auditLine = `[${now.toDate().toISOString()}] actor:${actorUid} unsuspended uid:${uid}`;
  await db.doc(Paths.privateUserData(uid)).update({
    internalNotes: FieldValue.arrayUnion(auditLine) as unknown as string,
  }).catch(() => { /* non-fatal */ });

  if (notify) {
    await sendNotification(uid, {
      type: "system",
      title: "Account suspension lifted",
      body: "Your account suspension has been lifted. You can now access Zupurb normally.",
    });
  }

  log.info("unsuspendUser: complete", {
    traceId: tid, userId: actorUid, domain: "admin", eventId: uid,
  });
}

/**
 * sandboxUser (admin override) — sets accountStatus='sandboxed'.
 * Does NOT require UAR threshold to be crossed; admin can sandbox any user.
 */
export async function sandboxUser(
  uid: string,
  reason: string,
  db: FirebaseFirestore.Firestore,
  actorUid = "system",
  traceId?: string
): Promise<void> {
  const now = Timestamp.now();
  const tid = traceId ?? newTraceId();

  await db.doc(Paths.user(uid)).update({
    accountStatus: "sandboxed",
    updatedAt: now,
  });

  await db.doc(Paths.privateUserData(uid)).update({
    isSandboxed: true,
    sandboxedAt: now,
    internalNotes: FieldValue.arrayUnion(
      `[${now.toDate().toISOString()}] actor:${actorUid} admin-sandboxed uid:${uid} reason:"${reason}"`
    ) as unknown as string,
  }).catch(() => { /* non-fatal */ });

  log.info("sandboxUser: admin override applied", {
    traceId: tid, userId: actorUid, domain: "admin", eventId: uid,
  }, { reason });
}

// ---------------------------------------------------------------------------
// Callable — admin_suspendUser
// ---------------------------------------------------------------------------

const SuspendUserSchema = z.object({
  uid:           z.string().min(1),
  reason:        z.string().min(1).max(500),
  durationHours: z.number().int().positive(),
});

export const admin_suspendUser = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = SuspendUserSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { uid, reason, durationHours } = parsed.data;

    log.info("admin_suspendUser: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `suspend_${uid}`,
    }, { reason, durationHours });

    const db = getFirestore();
    await suspendUser(uid, reason, durationHours, db, adminUid, traceId);

    return { uid, accountStatus: "suspended", durationHours };
  }
);

// ---------------------------------------------------------------------------
// Callable — admin_banUser
// ---------------------------------------------------------------------------

const BanUserSchema = z.object({
  uid:    z.string().min(1),
  reason: z.string().min(1).max(500),
});

export const admin_banUser = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = BanUserSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { uid, reason } = parsed.data;

    log.info("admin_banUser: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `ban_${uid}`,
    }, { reason });

    const db = getFirestore();
    await banUser(uid, reason, db, adminUid, traceId);

    return { uid, accountStatus: "banned" };
  }
);

// ---------------------------------------------------------------------------
// Callable — admin_unsuspendUser
// ---------------------------------------------------------------------------

const UnsuspendUserSchema = z.object({
  uid: z.string().min(1),
});

export const admin_unsuspendUser = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = UnsuspendUserSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { uid } = parsed.data;

    log.info("admin_unsuspendUser: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `unsuspend_${uid}`,
    });

    const db = getFirestore();
    await unsuspendUser(uid, db, adminUid, traceId, true);

    return { uid, accountStatus: "active" };
  }
);

// ---------------------------------------------------------------------------
// Callable — admin_sandboxUser
// ---------------------------------------------------------------------------

const SandboxUserSchema = z.object({
  uid:    z.string().min(1),
  reason: z.string().min(1).max(500),
});

export const admin_sandboxUser = onCall(
  { region: "us-central1" },
  async (request) => {
    const traceId = newTraceId();
    requireAdmin(request);
    const adminUid = request.auth!.uid;

    const parsed = SandboxUserSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
      );
    }
    const { uid, reason } = parsed.data;

    log.info("admin_sandboxUser: start", {
      traceId, userId: adminUid, domain: "admin", eventId: `sandbox_${uid}`,
    }, { reason });

    const db = getFirestore();
    await sandboxUser(uid, reason, db, adminUid, traceId);

    return { uid, accountStatus: "sandboxed" };
  }
);

// ---------------------------------------------------------------------------
// Scheduled — liftExpiredSuspensions (daily 05:00 UTC)
// ---------------------------------------------------------------------------

export const liftExpiredSuspensions = onSchedule(
  { schedule: "0 5 * * *", timeZone: "UTC", region: "us-central1" },
  async () => {
    const traceId = newTraceId();
    const db = getFirestore();
    const now = Timestamp.now();

    log.info("liftExpiredSuspensions: start", {
      traceId, domain: "admin", eventId: "lift_suspensions_cron",
    });

    const snap = await db
      .collection(USERS_COLLECTION)
      .where("accountStatus", "==", "suspended")
      .where("suspendedUntil", "<=", now)
      .get();

    if (snap.empty) {
      log.info("liftExpiredSuspensions: no expired suspensions", {
        traceId, domain: "admin", eventId: "lift_suspensions_cron",
      });
      return;
    }

    let lifted = 0;
    let failed = 0;

    for (const doc of snap.docs) {
      const uid = doc.id;
      try {
        await unsuspendUser(uid, db, "system_cron", traceId, true);
        lifted++;
      } catch (err) {
        failed++;
        log.error("liftExpiredSuspensions: failed to unsuspend user", {
          traceId, userId: uid, domain: "admin", eventId: "lift_suspensions_cron",
        }, { error: String(err) });
      }
    }

    log.info("liftExpiredSuspensions: complete", {
      traceId, domain: "admin", eventId: "lift_suspensions_cron",
    }, { lifted, failed });
  }
);
