/**
 * seed_demo_data.js — Populates Firestore with demo establishments, deals,
 * and reviews so the web app at https://zupurb-dev.web.app has real data.
 *
 * Usage:
 *   node scripts/seed_demo_data.js
 *
 * Credentials: uses Application Default Credentials (ADC).
 * Run `gcloud auth application-default login` first if credentials are absent,
 * or set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path.
 *
 * Idempotent: uses doc().set() with merge:false for establishments/deals
 * and add() for reviews (reviews are not idempotent by design — re-running
 * will append more demo reviews).
 */

"use strict";

const admin = require("firebase-admin");

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

if (!admin.apps.length) {
  admin.initializeApp({ projectId: "zupurb-dev" });
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// ---------------------------------------------------------------------------
// Establishments
// ---------------------------------------------------------------------------

const establishments = [
  {
    id: "social-lounge",
    name: "The Social Lounge",
    type: "Restaurant & Bar",
    area: "Downtown LA",
    imageUrl:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
    score: 4.4,
    priceRange: "$$",
    distanceKm: 1.2,
    openUntil: "11 PM",
    hasAlcohol: true,
    tags: ["bar", "lounge", "restaurant"],
    hasReservations: true,
    hasDeals: true,
    isActive: true,
    categories: ["restaurant"],
    createdAt: FieldValue.serverTimestamp(),
  },
  {
    id: "rooftop-garden",
    name: "The Rooftop Garden",
    type: "Bar",
    area: "Midtown",
    imageUrl:
      "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400",
    score: 4.6,
    priceRange: "$$$",
    distanceKm: 2.1,
    openUntil: "1 AM",
    hasAlcohol: true,
    tags: ["bar", "rooftop"],
    hasReservations: false,
    hasDeals: false,
    isActive: true,
    categories: ["bar"],
    createdAt: FieldValue.serverTimestamp(),
  },
  {
    id: "amber-bistro",
    name: "Amber Bistro",
    type: "Bistro",
    area: "Silver Lake",
    imageUrl:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400",
    score: 4.6,
    priceRange: "$$",
    distanceKm: 1.4,
    openUntil: "10 PM",
    hasAlcohol: false,
    tags: ["bistro", "french"],
    hasReservations: true,
    hasDeals: false,
    isActive: true,
    categories: ["restaurant"],
    createdAt: FieldValue.serverTimestamp(),
  },
  {
    id: "velvet-lounge",
    name: "Velvet Lounge",
    type: "Cocktail Bar",
    area: "Echo Park",
    imageUrl:
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400",
    score: 4.1,
    priceRange: "$$$",
    distanceKm: 1.8,
    openUntil: "2 AM",
    hasAlcohol: true,
    tags: ["cocktail", "bar", "lounge"],
    hasReservations: false,
    hasDeals: false,
    isActive: true,
    categories: ["bar"],
    createdAt: FieldValue.serverTimestamp(),
  },
  {
    id: "atrium-cafe",
    name: "The Atrium Café",
    type: "Café",
    area: "Los Feliz",
    imageUrl:
      "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400",
    score: 4.3,
    priceRange: "$",
    distanceKm: 0.9,
    openUntil: "8 PM",
    hasAlcohol: false,
    tags: ["cafe", "coffee"],
    hasReservations: false,
    hasDeals: true,
    isActive: true,
    categories: ["cafe"],
    createdAt: FieldValue.serverTimestamp(),
  },
  {
    id: "bloom-gardenia",
    name: "Bloom Gardenia",
    type: "Restaurant",
    area: "Beverly Hills",
    imageUrl:
      "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400",
    score: 4.5,
    priceRange: "$$$",
    distanceKm: 3.0,
    openUntil: "11 PM",
    hasAlcohol: true,
    tags: ["restaurant", "fine dining"],
    hasReservations: true,
    hasDeals: true,
    isActive: true,
    categories: ["restaurant"],
    createdAt: FieldValue.serverTimestamp(),
  },
];

// ---------------------------------------------------------------------------
// Deals — keyed by establishment id → array of deals
// ---------------------------------------------------------------------------

const dealsByEstId = {
  "social-lounge": [
    {
      id: "free-appetizer",
      label: "Free Appetizer",
      description: "Free appetizer with any entree purchase",
      points: 800,
      isActive: true,
    },
    {
      id: "free-dessert",
      label: "Free Dessert",
      description: "Free dessert with entree",
      points: 750,
      isActive: true,
    },
  ],
  "bloom-gardenia": [
    {
      id: "cocktail-discount",
      label: "20% Off Cocktails",
      description: "20% off signature cocktails",
      points: 750,
      isActive: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

const reviews = [
  {
    estId: "social-lounge",
    userId: "demo-user-1",
    authorName: "Sarah M.",
    authorPhotoUrl: "https://i.pravatar.cc/150?img=44",
    score: 4.2,
    text:
      "Had an incredible dinner here last night. The ambiance is exactly what we were looking for — modern, dimly lit but still energetic. The scallops were perfectly seared.",
    aiSummary:
      "Vibrant atmosphere with exceptional service. The seafood selection stands out as the main highlight.",
    verificationTier: "photo",
    helpfulVotes: 24,
    status: "published",
    createdAt: FieldValue.serverTimestamp(),
  },
  {
    estId: "social-lounge",
    userId: "demo-user-2",
    authorName: "Marcus T.",
    authorPhotoUrl: "https://i.pravatar.cc/150?img=12",
    score: 4.5,
    text:
      "Excellent cocktails and great atmosphere. The bartenders really know their craft.",
    aiSummary: "Excellent cocktails in a sophisticated setting.",
    verificationTier: "gps",
    helpfulVotes: 18,
    status: "published",
    createdAt: FieldValue.serverTimestamp(),
  },
  {
    estId: "rooftop-garden",
    userId: "demo-user-3",
    authorName: "Priya K.",
    authorPhotoUrl: "https://i.pravatar.cc/150?img=25",
    score: 4.7,
    text: "The view is absolutely stunning. Best rooftop bar in the city by far.",
    aiSummary: "Stunning rooftop views with quality drinks and service.",
    verificationTier: "receipt",
    helpfulVotes: 31,
    status: "published",
    createdAt: FieldValue.serverTimestamp(),
  },
];

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

async function seed() {
  console.log("Seeding Firestore for project: zupurb-dev");

  // 1. Establishments
  console.log(`\nWriting ${establishments.length} establishments...`);
  for (const est of establishments) {
    const { id, ...data } = est;
    await db.collection("establishments").doc(id).set(data, { merge: false });
    console.log(`  establishments/${id} OK`);
  }

  // 2. Deals (subcollections under each establishment)
  console.log("\nWriting deals subcollections...");
  for (const [estId, deals] of Object.entries(dealsByEstId)) {
    for (const deal of deals) {
      const { id, ...dealData } = deal;
      await db
        .collection("establishments")
        .doc(estId)
        .collection("deals")
        .doc(id)
        .set(dealData, { merge: false });
      console.log(`  establishments/${estId}/deals/${id} OK`);
    }
  }

  // 3. Reviews (flat collection + denormalized subcollection)
  console.log("\nWriting reviews...");
  for (const review of reviews) {
    // Flat reviews collection (auto-ID)
    const ref = await db.collection("reviews").add(review);
    console.log(`  reviews/${ref.id} (estId: ${review.estId}) OK`);

    // Denormalized into establishments/{estId}/reviews/{reviewId}
    await db
      .collection("establishments")
      .doc(review.estId)
      .collection("reviews")
      .doc(ref.id)
      .set(review, { merge: false });
    console.log(`  establishments/${review.estId}/reviews/${ref.id} OK`);
  }

  console.log("\nSeed complete.");
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

module.exports = { seed };
