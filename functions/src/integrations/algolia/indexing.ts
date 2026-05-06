/**
 * integrations/algolia/indexing.ts — Write-path helpers for Algolia indexing.
 *
 * Each function accepts a Firestore document shape and pushes the permitted
 * subset of fields into the appropriate Algolia index. Fields marked private
 * (ownerUids, reportCount, UAR, email, phone) are intentionally excluded.
 *
 * All functions:
 *   - Return immediately (no-op) if the admin client is unavailable.
 *   - Convert vendor errors to a generic Error so callers stay vendor-agnostic.
 *   - Log timing + outcome for budget attribution.
 *
 * Milestone: I5
 */

import { getFirestore } from "firebase-admin/firestore";
import { getAdminClient, INDICES } from "./client";
import {
  EstablishmentDoc,
  UserDoc,
  ESTABLISHMENTS_COLLECTION,
} from "../../lib/schema";

// ---------------------------------------------------------------------------
// Establishment indexing
// ---------------------------------------------------------------------------

/** Shape written to the zupurb_venues index. objectID = estId. */
interface EstablishmentRecord {
  objectID: string;
  name: string;
  description: string | null;
  categories: string[];
  city: string;
  state: string;
  neighborhood: string | null;
  priceRange: string | null;
  overallScore: number;
  reviewCount: number;
  isActive: boolean;
  acceptsReservations: boolean;
  _geoloc: { lat: number; lng: number };
  tags: string[];
}

function toEstablishmentRecord(eid: string, doc: Partial<EstablishmentDoc>): EstablishmentRecord {
  return {
    objectID:            eid,
    name:                doc.name                  ?? "",
    description:         doc.description           ?? null,
    categories:          doc.categories            ?? [],
    city:                doc.city                  ?? "",
    state:               doc.state                 ?? "",
    neighborhood:        null,   // field not yet on EstablishmentDoc; reserved for future
    priceRange:          null,   // field not yet on EstablishmentDoc; reserved for future
    overallScore:        doc.overallScore           ?? 0,
    reviewCount:         doc.reviewCount            ?? 0,
    isActive:            doc.isActive               ?? true,
    acceptsReservations: doc.isOpenForReservations  ?? false,
    _geoloc: {
      lat: doc.lat ?? 0,
      lng: doc.lng ?? 0,
    },
    tags: [],  // populated by future enrichment pass; index-time placeholder
  };
}

/**
 * Upsert an establishment into the zupurb_venues index.
 * Safe to call on every create/update — Algolia uses objectID for idempotency.
 */
export async function indexEstablishment(
  eid: string,
  doc: Partial<EstablishmentDoc>
): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  const t0 = Date.now();
  try {
    const index = client.initIndex(INDICES.venues);
    await index.saveObject(toEstablishmentRecord(eid, doc));
    console.info("[algolia] indexEstablishment", { eid, durationMs: Date.now() - t0, cost_band: "index_write" });
  } catch (err) {
    console.error("[algolia] indexEstablishment failed", { eid, err });
    throw new Error(`Algolia indexEstablishment failed for ${eid}: ${(err as Error).message}`);
  }
}

/**
 * Remove an establishment from the zupurb_venues index.
 * Called on hard-delete or soft-deactivation (isActive → false).
 */
export async function deindexEstablishment(eid: string): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  const t0 = Date.now();
  try {
    const index = client.initIndex(INDICES.venues);
    await index.deleteObject(eid);
    console.info("[algolia] deindexEstablishment", { eid, durationMs: Date.now() - t0, cost_band: "index_write" });
  } catch (err) {
    console.error("[algolia] deindexEstablishment failed", { eid, err });
    throw new Error(`Algolia deindexEstablishment failed for ${eid}: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// User indexing
// ---------------------------------------------------------------------------

/** Shape written to the zupurb_users index. objectID = uid. */
interface UserRecord {
  objectID: string;
  displayName: string;
  username: string | null;
  photoURL: string | null;
  reviewCount: number;
  tier: string;
  city: string | null;
}

/**
 * Upsert a user into the zupurb_users index.
 * Private fields (UAR, email, phone, fingerprint, internal flags) are excluded.
 */
export async function indexUser(uid: string, doc: Partial<UserDoc>): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  const record: UserRecord = {
    objectID:    uid,
    displayName: doc.displayName ?? "",
    username:    null,  // username field reserved — not yet on UserDoc shape
    photoURL:    doc.photoUrl    ?? null,
    reviewCount: doc.reviewCount ?? 0,
    tier:        doc.loyaltyTier ?? "bronze",
    city:        null,  // city not yet on UserDoc; reserved for future
  };

  const t0 = Date.now();
  try {
    const index = client.initIndex(INDICES.users);
    await index.saveObject(record);
    console.info("[algolia] indexUser", { uid, durationMs: Date.now() - t0, cost_band: "index_write" });
  } catch (err) {
    console.error("[algolia] indexUser failed", { uid, err });
    throw new Error(`Algolia indexUser failed for ${uid}: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Post indexing
// ---------------------------------------------------------------------------

interface PostRecord {
  objectID:    string;
  authorUid:   string;
  caption:     string | null;
  estId:       string | null;
  createdAt:   number;  // Unix epoch seconds for Algolia numeric filtering
}

/**
 * Upsert a post into the zupurb_posts index.
 * Uses a loose `any` for the doc parameter so this file doesn't import PostDoc
 * (PostDoc lives in schema.ts but posts are not always passed as full docs).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function indexPost(postId: string, doc: any): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  const record: PostRecord = {
    objectID:  postId,
    authorUid: doc.authorUid ?? "",
    caption:   doc.caption   ?? null,
    estId:     doc.estId     ?? null,
    createdAt: doc.createdAt?.seconds ?? Math.floor(Date.now() / 1000),
  };

  const t0 = Date.now();
  try {
    const index = client.initIndex(INDICES.posts);
    await index.saveObject(record);
    console.info("[algolia] indexPost", { postId, durationMs: Date.now() - t0, cost_band: "index_write" });
  } catch (err) {
    console.error("[algolia] indexPost failed", { postId, err });
    throw new Error(`Algolia indexPost failed for ${postId}: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Bulk re-index (admin repair / initial setup)
// ---------------------------------------------------------------------------

/**
 * Paginates through the establishments Firestore collection and re-indexes all
 * active docs in batches of 100.  Returns a summary so the caller can report
 * progress.  Only active establishments are indexed; deactivated ones are
 * removed from the index.
 *
 * Admin callable only — do not expose to regular users.
 */
export async function bulkReindexEstablishments(): Promise<{ indexed: number; errors: number }> {
  const client = getAdminClient();
  if (!client) {
    console.warn("[algolia] bulkReindexEstablishments: no admin client — skipped.");
    return { indexed: 0, errors: 0 };
  }

  const db = getFirestore();
  const BATCH = 100;
  let indexed = 0;
  let errors  = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = db
      .collection(ESTABLISHMENTS_COLLECTION)
      .orderBy("estId")
      .limit(BATCH);

    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const records: EstablishmentRecord[] = [];
    const toRemove: string[] = [];

    for (const d of snap.docs) {
      const doc = d.data() as EstablishmentDoc;
      if (doc.isActive) {
        records.push(toEstablishmentRecord(doc.estId, doc));
      } else {
        toRemove.push(doc.estId);
      }
    }

    // Batch upsert active docs
    if (records.length > 0) {
      try {
        const index = client.initIndex(INDICES.venues);
        await index.saveObjects(records);
        indexed += records.length;
      } catch (err) {
        console.error("[algolia] bulkReindex batch saveObjects failed", { err });
        errors += records.length;
      }
    }

    // Batch remove inactive docs
    if (toRemove.length > 0) {
      try {
        const index = client.initIndex(INDICES.venues);
        await index.deleteObjects(toRemove);
      } catch (err) {
        console.error("[algolia] bulkReindex batch deleteObjects failed", { err });
        errors += toRemove.length;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH) break;
  }

  console.info("[algolia] bulkReindexEstablishments complete", { indexed, errors, cost_band: "bulk_index_write" });
  return { indexed, errors };
}
