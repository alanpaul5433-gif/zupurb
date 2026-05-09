"use strict";
/**
 * seed_rest.js — Seeds Firestore via REST API using the Firebase CLI OAuth token.
 * No service account needed — uses the same credentials as `firebase deploy`.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Auth token ────────────────────────────────────────────────────────────────
const firebaseToolsConfig = JSON.parse(
  fs.readFileSync(
    path.join(process.env.USERPROFILE || process.env.HOME, ".config", "configstore", "firebase-tools.json"),
    "utf8"
  )
);
const ACCESS_TOKEN = firebaseToolsConfig.tokens.access_token;
const PROJECT_ID = "zupurb-dev";
const BASE_URL = `firestore.googleapis.com`;
const DB_PATH = `projects/${PROJECT_ID}/databases/(default)/documents`;

// ── REST helpers ──────────────────────────────────────────────────────────────
function fsValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === "string") return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(fsValue) } };
  if (val && typeof val === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(val).map(([k, v]) => [k, fsValue(v)])) } };
  }
  return { stringValue: String(val) };
}

function toFsDoc(data) {
  const fields = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && v._methodName === "serverTimestamp") {
      // Skip serverTimestamp — Firestore REST API handles it differently
      // Use current time as a string instead
      fields[k] = { timestampValue: new Date().toISOString() };
    } else {
      fields[k] = fsValue(v);
    }
  }
  return { fields };
}

function request(method, docPath, body) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: BASE_URL,
      path: `/v1/${DB_PATH}/${docPath}`,
      method,
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data || "{}"));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function setDoc(collectionPath, docId, data) {
  const doc = toFsDoc(data);
  // PATCH with updateMask creates or overwrites
  const fields = Object.keys(data).filter(k => !(data[k] && data[k]._methodName));
  const mask = fields.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(doc);
    const urlPath = `/v1/${DB_PATH}/${collectionPath}/${docId}?${mask}&currentDocument.exists=false`;
    const options = {
      hostname: BASE_URL,
      path: urlPath,
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data2 = "";
      res.on("data", (chunk) => (data2 += chunk));
      res.on("end", () => {
        // 409 = already exists — that's ok (idempotent)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data2 || "{}"));
        } else if (res.statusCode === 409) {
          // Overwrite without condition
          const opts2 = {
            hostname: BASE_URL,
            path: `/v1/${DB_PATH}/${collectionPath}/${docId}`,
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${ACCESS_TOKEN}`,
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(postData),
            },
          };
          const req2 = https.request(opts2, (res2) => {
            let d = "";
            res2.on("data", c => d += c);
            res2.on("end", () => res2.statusCode < 300 ? resolve(JSON.parse(d || "{}")) : reject(new Error(`HTTP ${res2.statusCode}: ${d}`)));
          });
          req2.on("error", reject);
          req2.write(postData);
          req2.end();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data2}`));
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function addDoc(collectionPath, data) {
  const doc = toFsDoc(data);
  const postData = JSON.stringify(doc);
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/v1/${DB_PATH}/${collectionPath}`,
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let d = "";
      res.on("data", c => d += c);
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const result = JSON.parse(d || "{}");
          resolve(result.name ? result.name.split("/").pop() : "unknown");
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${d}`));
        }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

// ── Data ──────────────────────────────────────────────────────────────────────
const NOW = { _methodName: "serverTimestamp" };

const establishments = [
  { id: "social-lounge", name: "The Social Lounge", type: "Restaurant & Bar", area: "Downtown LA", imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800", score: 4.4, priceRange: "$$", distanceKm: 1.2, openUntil: "11 PM", hasAlcohol: true, tags: ["bar","lounge","restaurant"], hasReservations: true, hasDeals: true, isActive: true },
  { id: "rooftop-garden", name: "The Rooftop Garden", type: "Bar", area: "Midtown", imageUrl: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=400", score: 4.6, priceRange: "$$$", distanceKm: 2.1, openUntil: "1 AM", hasAlcohol: true, tags: ["bar","rooftop"], hasReservations: false, hasDeals: false, isActive: true },
  { id: "amber-bistro", name: "Amber Bistro", type: "Bistro", area: "Silver Lake", imageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400", score: 4.6, priceRange: "$$", distanceKm: 1.4, openUntil: "10 PM", hasAlcohol: false, tags: ["bistro","french"], hasReservations: true, hasDeals: false, isActive: true },
  { id: "velvet-lounge", name: "Velvet Lounge", type: "Cocktail Bar", area: "Echo Park", imageUrl: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=400", score: 4.1, priceRange: "$$$", distanceKm: 1.8, openUntil: "2 AM", hasAlcohol: true, tags: ["cocktail","bar","lounge"], hasReservations: false, hasDeals: false, isActive: true },
  { id: "atrium-cafe", name: "The Atrium Café", type: "Café", area: "Los Feliz", imageUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=400", score: 4.3, priceRange: "$", distanceKm: 0.9, openUntil: "8 PM", hasAlcohol: false, tags: ["cafe","coffee"], hasReservations: false, hasDeals: true, isActive: true },
  { id: "bloom-gardenia", name: "Bloom Gardenia", type: "Restaurant", area: "Beverly Hills", imageUrl: "https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400", score: 4.5, priceRange: "$$$", distanceKm: 3.0, openUntil: "11 PM", hasAlcohol: true, tags: ["restaurant","fine dining"], hasReservations: true, hasDeals: true, isActive: true },
];

const dealsByEstId = {
  "social-lounge": [
    { id: "free-appetizer", label: "Free Appetizer", description: "Free appetizer with any entree purchase", points: 800, isActive: true },
    { id: "free-dessert", label: "Free Dessert", description: "Free dessert with entree", points: 750, isActive: true },
  ],
  "bloom-gardenia": [
    { id: "cocktail-discount", label: "20% Off Cocktails", description: "20% off signature cocktails", points: 750, isActive: true },
  ],
};

const reviews = [
  { estId: "social-lounge", userId: "demo-user-1", authorName: "Sarah M.", authorPhotoUrl: "https://i.pravatar.cc/150?img=44", score: 4.2, text: "Had an incredible dinner here last night. The ambiance is exactly what we were looking for — modern, dimly lit but still energetic. The scallops were perfectly seared.", aiSummary: "Vibrant atmosphere with exceptional service. The seafood selection stands out as the main highlight.", verificationTier: "photo", helpfulVotes: 24, status: "published" },
  { estId: "social-lounge", userId: "demo-user-2", authorName: "Marcus T.", authorPhotoUrl: "https://i.pravatar.cc/150?img=12", score: 4.5, text: "Excellent cocktails and great atmosphere. The bartenders really know their craft.", aiSummary: "Excellent cocktails in a sophisticated setting.", verificationTier: "gps", helpfulVotes: 18, status: "published" },
  { estId: "rooftop-garden", userId: "demo-user-3", authorName: "Priya K.", authorPhotoUrl: "https://i.pravatar.cc/150?img=25", score: 4.7, text: "The view is absolutely stunning. Best rooftop bar in the city by far.", aiSummary: "Stunning rooftop views with quality drinks and service.", verificationTier: "receipt", helpfulVotes: 31, status: "published" },
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function seed() {
  console.log("Seeding Firestore (REST API) for project:", PROJECT_ID);

  console.log(`\nWriting ${establishments.length} establishments...`);
  for (const { id, ...data } of establishments) {
    await setDoc("establishments", id, data);
    console.log(`  establishments/${id} OK`);
  }

  console.log("\nWriting deals...");
  for (const [estId, deals] of Object.entries(dealsByEstId)) {
    for (const { id, ...data } of deals) {
      await setDoc(`establishments/${estId}/deals`, id, data);
      console.log(`  establishments/${estId}/deals/${id} OK`);
    }
  }

  console.log("\nWriting reviews...");
  for (const review of reviews) {
    const reviewId = await addDoc("reviews", review);
    console.log(`  reviews/${reviewId} (estId: ${review.estId}) OK`);
    await setDoc(`establishments/${review.estId}/reviews`, reviewId, review);
    console.log(`  establishments/${review.estId}/reviews/${reviewId} OK`);
  }

  console.log("\nSeed complete!");
}

seed().catch(err => { console.error("Seed failed:", err.message); process.exit(1); });
