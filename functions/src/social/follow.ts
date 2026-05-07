/**
 * follow.ts — Follow graph callables.
 *
 * Implements:
 *   followUser     — create follows/{followerId}__{followeeId}, update counters
 *   unfollowUser   — delete follow doc, decrement counters
 *   getFollowers   — paginated list of users following a given uid
 *   getFollowing   — paginated list of users a given uid follows
 *   isMutualFollow — helper (used by messaging gate)
 *
 * Schema: follows/{id}: followerId, followeeId, createdAt
 * Counters: users/{uid}.followersCount / followingCount (atomic update)
 *
 * Milestone: B10
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import {
  FollowDoc,
  UserDoc,
  FOLLOWS_COLLECTION,
  Paths,
} from "../lib/schema";
import { sendNotification } from "../lib/notify";
import { log, newTraceId } from "../lib/logging";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE     = 50;

// ---------------------------------------------------------------------------
// isMutualFollow — exported helper consumed by messaging gate
// ---------------------------------------------------------------------------

/**
 * Returns true when both uid→targetUid and targetUid→uid follow docs exist.
 * Does NOT throw — returns false on error so callers can default to deny.
 */
export async function isMutualFollow(
  uidA: string,
  uidB: string,
  db: FirebaseFirestore.Firestore
): Promise<boolean> {
  try {
    const [aFollowsB, bFollowsA] = await Promise.all([
      db.doc(Paths.follow(uidA, uidB)).get(),
      db.doc(Paths.follow(uidB, uidA)).get(),
    ]);
    return aFollowsB.exists && bFollowsA.exists;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// followUser
// ---------------------------------------------------------------------------

const FollowUserSchema = z.object({
  followeeUid: z.string().min(1),
});

export const followUser = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const followerId = request.auth.uid;

  const parsed = FollowUserSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { followeeUid } = parsed.data;

  if (followerId === followeeUid) {
    throw new HttpsError("invalid-argument", "Cannot follow yourself.");
  }

  const db = getFirestore();

  log.info("followUser: start", {
    traceId, userId: followerId, domain: "social", eventId: `follow_${followerId}_${followeeUid}`,
  });

  // Check followee exists
  const followeeSnap = await db.doc(Paths.user(followeeUid)).get();
  if (!followeeSnap.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  const followDocId = `${followerId}__${followeeUid}`;
  const followRef = db.collection(FOLLOWS_COLLECTION).doc(followDocId);
  const existingSnap = await followRef.get();

  if (existingSnap.exists) {
    // Idempotent — already following
    log.info("followUser: already following (idempotent)", {
      traceId, userId: followerId, domain: "social", eventId: followDocId,
    });
    return { followId: followDocId, alreadyFollowing: true };
  }

  const now = Timestamp.now();

  const followDoc: FollowDoc = {
    followId: followDocId,
    followerId,
    followeeId: followeeUid,
    createdAt: now,
  };

  // Atomic: write follow doc + increment both user counters
  const batch = db.batch();
  batch.set(followRef, followDoc);
  batch.update(db.doc(Paths.user(followerId)), {
    followingCount: FieldValue.increment(1),
    following: FieldValue.arrayUnion(followeeUid),
    updatedAt: now,
  });
  batch.update(db.doc(Paths.user(followeeUid)), {
    followersCount: FieldValue.increment(1),
    followers: FieldValue.arrayUnion(followerId),
    updatedAt: now,
  });
  await batch.commit();

  // Notify followee (fire-and-forget; errors must not fail the callable)
  try {
    const followerSnap = await db.doc(Paths.user(followerId)).get();
    const followerData = followerSnap.data() as UserDoc | undefined;
    const followerName = followerData?.displayName ?? "Someone";
    await sendNotification(followeeUid, {
      type: "new_follower",
      title: "New follower",
      body: `${followerName} started following you.`,
      relatedEntityId: followerId,
      relatedEntityType: "user",
    });
  } catch (err) {
    log.warn("followUser: notification failed (non-fatal)", {
      traceId, userId: followerId, domain: "social", eventId: followDocId,
    }, { error: String(err) });
  }

  log.info("followUser: complete", {
    traceId, userId: followerId, domain: "social", eventId: followDocId,
  });

  return { followId: followDocId, alreadyFollowing: false };
});

// ---------------------------------------------------------------------------
// unfollowUser
// ---------------------------------------------------------------------------

const UnfollowUserSchema = z.object({
  followeeUid: z.string().min(1),
});

export const unfollowUser = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
  const followerId = request.auth.uid;

  const parsed = UnfollowUserSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { followeeUid } = parsed.data;

  if (followerId === followeeUid) {
    throw new HttpsError("invalid-argument", "Cannot unfollow yourself.");
  }

  const db = getFirestore();
  const followDocId = `${followerId}__${followeeUid}`;
  const followRef = db.collection(FOLLOWS_COLLECTION).doc(followDocId);
  const existingSnap = await followRef.get();

  if (!existingSnap.exists) {
    // Idempotent — not following
    return { unfollowed: false };
  }

  const now = Timestamp.now();

  const batch = db.batch();
  batch.delete(followRef);
  batch.update(db.doc(Paths.user(followerId)), {
    followingCount: FieldValue.increment(-1),
    following: FieldValue.arrayRemove(followeeUid),
    updatedAt: now,
  });
  batch.update(db.doc(Paths.user(followeeUid)), {
    followersCount: FieldValue.increment(-1),
    followers: FieldValue.arrayRemove(followerId),
    updatedAt: now,
  });
  await batch.commit();

  log.info("unfollowUser: complete", {
    traceId, userId: followerId, domain: "social", eventId: followDocId,
  });

  return { unfollowed: true };
});

// ---------------------------------------------------------------------------
// getFollowers — paginated list of uids following a given user
// ---------------------------------------------------------------------------

const GetFollowersSchema = z.object({
  uid:     z.string().min(1),
  limit:   z.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
  afterId: z.string().optional(),
});

export const getFollowers = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");

  const parsed = GetFollowersSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { uid, limit, afterId } = parsed.data;

  const db = getFirestore();

  let query = db
    .collection(FOLLOWS_COLLECTION)
    .where("followeeId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit + 1);

  if (afterId) {
    const cursorSnap = await db.collection(FOLLOWS_COLLECTION).doc(afterId).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  const hasMore = snap.size > limit;
  const docs = snap.docs.slice(0, limit).map((d) => d.data() as FollowDoc);

  log.info("getFollowers: complete", {
    traceId, userId: request.auth.uid, domain: "social", eventId: `followers_${uid}`,
  }, { count: docs.length, hasMore });

  return {
    items: docs.map((f) => ({ uid: f.followerId, followedAt: f.createdAt.toDate().toISOString() })),
    hasMore,
    nextCursor: hasMore && docs.length > 0 ? docs[docs.length - 1].followId : null,
  };
});

// ---------------------------------------------------------------------------
// getFollowing — paginated list of uids this user follows
// ---------------------------------------------------------------------------

const GetFollowingSchema = z.object({
  uid:     z.string().min(1),
  limit:   z.number().int().min(1).max(MAX_PAGE_SIZE).optional().default(DEFAULT_PAGE_SIZE),
  afterId: z.string().optional(),
});

export const getFollowing = onCall(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 60, enforceAppCheck: true },
  async (request) => {
  const traceId = newTraceId();

  if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");

  const parsed = GetFollowingSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }
  const { uid, limit, afterId } = parsed.data;

  const db = getFirestore();

  let query = db
    .collection(FOLLOWS_COLLECTION)
    .where("followerId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(limit + 1);

  if (afterId) {
    const cursorSnap = await db.collection(FOLLOWS_COLLECTION).doc(afterId).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  const snap = await query.get();
  const hasMore = snap.size > limit;
  const docs = snap.docs.slice(0, limit).map((d) => d.data() as FollowDoc);

  log.info("getFollowing: complete", {
    traceId, userId: request.auth.uid, domain: "social", eventId: `following_${uid}`,
  }, { count: docs.length, hasMore });

  return {
    items: docs.map((f) => ({ uid: f.followeeId, followedAt: f.createdAt.toDate().toISOString() })),
    hasMore,
    nextCursor: hasMore && docs.length > 0 ? docs[docs.length - 1].followId : null,
  };
});
