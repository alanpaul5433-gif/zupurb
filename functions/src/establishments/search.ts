/**
 * establishments/search.ts — Algolia search indexing pipeline for establishments.
 *
 * The Firestore trigger `onEstablishmentWrite` watches establishments/{eid} and:
 *   - On CREATE or UPDATE: syncs the record to the Algolia "zupurb_venues" index.
 *   - On DELETE or deactivation (isActive → false): removes the record from Algolia.
 *
 * NOTE: This file re-exports the trigger that already lives in
 * triggers/onEstablishmentWrite.ts (built in B9). B4 wires it into the
 * establishments domain exports and ensures it is listed in index.ts under B4.
 *
 * The Algolia record shape (EstablishmentRecord) is defined in
 * integrations/algolia/indexing.ts and includes:
 *   objectID, name, categories, city, state, _geoloc (lat/lng), overallScore,
 *   reviewCount, isActive, acceptsReservations.
 *   Private fields (ownerUids, reportCount, UAR signals) are excluded.
 *
 * Credentials: ALGOLIA_APP_ID + ALGOLIA_ADMIN_API_KEY environment variables.
 * Graceful degradation: if credentials are missing, writes are no-ops and a
 * warning is logged — the Firestore write still succeeds.
 *
 * Milestone: B4 (Establishments)
 */

// Re-export the existing trigger so it can be wired through the B4 domain barrel.
export { onEstablishmentWrite } from "../triggers/onEstablishmentWrite";

// Re-export Algolia indexing helpers for use by claiming/admin flows.
export { indexEstablishment, deindexEstablishment } from "../integrations/algolia/indexing";
