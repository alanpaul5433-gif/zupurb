/**
 * admin/seedDemoData.ts — One-shot demo content seeder (HTTP, secret-guarded).
 *
 * Populates Firestore (and Firebase Auth) with realistic dummy content so every
 * data-driven surface of the app shows real-looking content:
 *   - Discover / Search          → establishments
 *   - Home feed                  → reviews (top-level `reviews` collection)
 *   - Establishment detail       → establishments/{id}/reviews subcollection
 *   - Deals                      → deals
 *   - Profile / Points balance   → users/{uid} (+ Auth users you can log in as)
 *
 * IMPORTANT: writes the field names the FLUTTER models read (which diverge from
 * the backend spec schema). e.g. establishments use `score`/`type`/`area`/
 * `imageUrl`; reviews use `text`/`score`/`authorName`; profiles use the
 * UserProfile fields. Backend-schema mirror fields are included as harmless extras.
 *
 * Several screens (My Reservations, Points activity list, Badges) still render
 * hard-coded Phase-1A mock content, so they already look populated regardless of
 * login and need no seeding.
 *
 * Trigger (one-time; remove this function in a later deploy when done):
 *   GET https://us-central1-zupurb-9580f.cloudfunctions.net/seedDemoData?key=<GUARD>
 *
 * Idempotent — fixed doc IDs / UIDs, so re-running overwrites rather than duplicating.
 */

import { onRequest } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const GUARD = "zpb-demo-seed-2f9c4a";

const IMG = (id: string) => `https://images.unsplash.com/${id}?w=800&q=80`;
const AVATAR = (n: number) => `https://i.pravatar.cc/300?img=${n}`;

// --- "People Like You" cohort model -----------------------------------------
// Each user belongs to a taste cohort; each venue gets a per-cohort score +
// reviewer count. The client shows the viewer's-cohort score next to the
// general score; cohorts with count 0 (a conflict) are omitted → general only.
const COHORTS = ["nightlife", "brunch_cafe", "bbq_casual", "foodie_upscale", "coffee_wine"] as const;

function cohortAffinity(e: { type: string; tags: string[]; priceRange: string }, cohort: string): "match" | "conflict" | "neutral" {
  const hay = (e.type + " " + e.tags.join(" ")).toLowerCase();
  const has = (...kw: string[]) => kw.some((k) => hay.includes(k));
  switch (cohort) {
    case "nightlife":
      if (has("nightclub", "cocktail", "lounge", "speakeasy", "dancing", "late night", "nightlife")) return "match";
      if (has("café", "cafe", "bakery", "brunch", "family")) return "conflict";
      return "neutral";
    case "bbq_casual":
      if (has("bbq", "craft beer", "gastropub", "sports bar", "casual")) return "match";
      if (has("fine dining", "wine bar", "omakase")) return "conflict";
      return "neutral";
    case "brunch_cafe":
      if (has("brunch", "café", "cafe", "bakery")) return "match";
      if (has("nightclub", "whiskey", "speakeasy", "late night", "nightlife")) return "conflict";
      return "neutral";
    case "foodie_upscale":
      if (has("fine dining", "steakhouse", "mediterranean", "seafood") || e.priceRange === "$$$") return "match";
      if (has("sports bar", "casual", "family")) return "conflict";
      return "neutral";
    case "coffee_wine":
      if (has("café", "cafe", "roastery", "wine bar")) return "match";
      if (has("bbq", "nightclub", "sports bar")) return "conflict";
      return "neutral";
    default:
      return "neutral";
  }
}

// Returns {score, count} for a cohort; count 0 means "no like-minded data".
function plyForCohort(e: { id: string; type: string; tags: string[]; priceRange: string; score: number }, cohort: string): { score: number; count: number } {
  const aff = cohortAffinity(e, cohort);
  const span = e.id.length % 6;
  if (aff === "match") return { score: Math.round(Math.min(5, e.score + 0.4) * 10) / 10, count: 8 + span };
  if (aff === "conflict") return { score: 0, count: 0 };
  return { score: e.score, count: 3 + (e.id.length % 3) };
}

// ---------------------------------------------------------------------------
// Loggable demo users (Firebase Auth + users/{uid} profile)
// ---------------------------------------------------------------------------

// tasteCohort drives the "People Like You" rating. Cohorts: nightlife,
// brunch_cafe, bbq_casual, foodie_upscale, coffee_wine.
const USERS = [
  {
    uid: "demo-user-ava", email: "ava@zupurbdemo.app", password: "Zupurb#Demo1",
    displayName: "Ava Mitchell", bio: "Food explorer · cocktails & rooftops 🍸 · LA",
    avatar: 5, points: 1847, tier: "gold", reviews: 12, followers: 340, following: 180,
    cohort: "nightlife",
  },
  {
    uid: "demo-user-leo", email: "leo@zupurbdemo.app", password: "Zupurb#Demo2",
    displayName: "Leo Navarro", bio: "Always hunting the best brunch 🥑 · NYC",
    avatar: 12, points: 920, tier: "silver", reviews: 6, followers: 128, following: 96,
    cohort: "brunch_cafe",
  },
  {
    uid: "demo-user-mia", email: "mia@zupurbdemo.app", password: "Zupurb#Demo3",
    displayName: "Mia Chen", bio: "Nightlife & live music · always out 🎶 · Miami",
    avatar: 25, points: 4310, tier: "platinum", reviews: 21, followers: 1020, following: 410,
    cohort: "nightlife",
  },
  {
    uid: "demo-user-jay", email: "jay@zupurbdemo.app", password: "Zupurb#Demo4",
    displayName: "Jordan Reyes", bio: "BBQ, whiskey & live shows 🔥 · Austin",
    avatar: 33, points: 2560, tier: "gold", reviews: 15, followers: 512, following: 240,
    cohort: "bbq_casual",
  },
];

// Display-only creator profiles (NOT loggable) — populate the Creators tab and
// resolve review-author tap-throughs. uids match UID_BY_NAME below.
const CREATORS = [
  { uid: "creator-sophie-tran", displayName: "Sophie Tran", avatar: 45, bio: "Café crawler & latte-art nerd ☕ · Seattle", reviews: 38, followers: 2100, following: 320, tier: "gold", points: 3120, cohort: "coffee_wine" },
  { uid: "creator-marcus-webb", displayName: "Marcus Webb", avatar: 51, bio: "Whiskey, live music & late nights 🥃 · Nashville", reviews: 54, followers: 4800, following: 410, tier: "platinum", points: 5210, cohort: "nightlife" },
  { uid: "creator-priya-kapoor", displayName: "Priya Kapoor", avatar: 47, bio: "Mediterranean & patio dining 🌿 · Miami", reviews: 61, followers: 8400, following: 203, tier: "platinum", points: 6740, cohort: "foodie_upscale" },
  { uid: "creator-david-cohen", displayName: "David Cohen", avatar: 53, bio: "Nightlife reviewer · always on the list 🎟️ · Miami", reviews: 29, followers: 1500, following: 180, tier: "gold", points: 2480, cohort: "nightlife" },
  { uid: "creator-elena-ruiz", displayName: "Elena Ruiz", avatar: 16, bio: "Taco tours & hidden gems 🌮 · Austin", reviews: 44, followers: 3300, following: 290, tier: "gold", points: 3890, cohort: "bbq_casual" },
  { uid: "creator-tomohiro-sato", displayName: "Tomohiro Sato", avatar: 60, bio: "Omakase & natural wine 🍶 · SF", reviews: 33, followers: 2700, following: 150, tier: "gold", points: 2950, cohort: "foodie_upscale" },
  { uid: "creator-grace-okafor", displayName: "Grace Okafor", avatar: 31, bio: "Brunch, bakeries & rooftops 🥐 · NYC", reviews: 49, followers: 5600, following: 340, tier: "platinum", points: 4620, cohort: "brunch_cafe" },
  { uid: "creator-ben-fischer", displayName: "Ben Fischer", avatar: 14, bio: "Craft beer & BBQ pitmaster 🍺 · Chicago", reviews: 27, followers: 1200, following: 210, tier: "silver", points: 1980, cohort: "bbq_casual" },
];

// ---------------------------------------------------------------------------
// Establishments across multiple cities (fields match the Flutter model)
// ---------------------------------------------------------------------------

const ESTABLISHMENTS = [
  // Los Angeles
  { id: "the-social-lounge", name: "The Social Lounge", type: "Restaurant & Bar", area: "Downtown · Los Angeles", score: 4.6, priceRange: "$$", distanceKm: 1.2, openUntil: "11 PM", hasAlcohol: true, tags: ["Cocktail Bar", "Rooftop", "Live Music"], image: "photo-1517248135467-4c7edcad34c4" },
  { id: "bloom-gardenia", name: "Bloom Gardenia", type: "Brunch & Café", area: "Silver Lake · Los Angeles", score: 4.8, priceRange: "$$", distanceKm: 2.4, openUntil: "4 PM", hasAlcohol: false, tags: ["Brunch", "Vegan Friendly", "Outdoor Seating"], image: "photo-1466978913421-dad2ebd01d17" },
  { id: "amber-ember", name: "Amber & Ember", type: "Steakhouse", area: "Beverly Hills · Los Angeles", score: 4.7, priceRange: "$$$", distanceKm: 4.0, openUntil: "10 PM", hasAlcohol: true, tags: ["Fine Dining", "Wine Bar", "Date Night"], image: "photo-1544025162-d76694265947" },
  // New York
  { id: "brooklyn-smokehouse", name: "Brooklyn Smoke House", type: "BBQ & Grill", area: "Williamsburg · New York", score: 4.7, priceRange: "$$", distanceKm: 0.8, openUntil: "12 AM", hasAlcohol: true, tags: ["BBQ", "Craft Beer", "Casual"], image: "photo-1529193591184-b1d58069ecdd" },
  { id: "the-gilded-owl", name: "The Gilded Owl", type: "Cocktail Bar", area: "Manhattan · New York", score: 4.6, priceRange: "$$$", distanceKm: 1.5, openUntil: "2 AM", hasAlcohol: true, tags: ["Cocktail Bar", "Speakeasy", "Date Night"], image: "photo-1470337458703-46ad1756a187" },
  { id: "morning-bell-cafe", name: "Morning Bell Café", type: "Café & Bakery", area: "West Village · New York", score: 4.8, priceRange: "$$", distanceKm: 2.1, openUntil: "7 PM", hasAlcohol: false, tags: ["Café", "Bakery", "Brunch"], image: "photo-1501339847302-ac426a4a7cbb" },
  // Miami
  { id: "saffron-and-sea", name: "Saffron & Sea", type: "Mediterranean", area: "South Beach · Miami", score: 4.8, priceRange: "$$$", distanceKm: 1.0, openUntil: "11 PM", hasAlcohol: true, tags: ["Mediterranean", "Seafood", "Outdoor Seating"], image: "photo-1559339352-11d035aa65de" },
  { id: "neon-palm", name: "Neon Palm", type: "Nightclub", area: "Wynwood · Miami", score: 4.3, priceRange: "$$$", distanceKm: 3.4, openUntil: "4 AM", hasAlcohol: true, tags: ["Nightlife", "Dancing", "Late Night"], image: "photo-1514933651103-005eec06c04b" },
  // San Francisco
  { id: "fog-harbor-kitchen", name: "Fog Harbor Kitchen", type: "Seafood", area: "Embarcadero · San Francisco", score: 4.7, priceRange: "$$$", distanceKm: 1.7, openUntil: "10 PM", hasAlcohol: true, tags: ["Seafood", "Waterfront", "Date Night"], image: "photo-1467003909585-2f8a72700288" },
  { id: "mission-pour", name: "Mission Pour", type: "Wine Bar", area: "Mission District · San Francisco", score: 4.5, priceRange: "$$", distanceKm: 2.8, openUntil: "1 AM", hasAlcohol: true, tags: ["Wine Bar", "Small Plates", "Cozy"], image: "photo-1510812431401-41d2bd2722f3" },
  // Chicago
  { id: "lakeview-tavern", name: "Lakeview Tavern", type: "Gastropub", area: "River North · Chicago", score: 4.5, priceRange: "$$", distanceKm: 1.9, openUntil: "12 AM", hasAlcohol: true, tags: ["Gastropub", "Craft Beer", "Sports Bar"], image: "photo-1538488881038-e252a119ace7" },
  { id: "the-atrium-cafe", name: "The Atrium Café", type: "Café & Bakery", area: "West Loop · Chicago", score: 4.6, priceRange: "$", distanceKm: 3.0, openUntil: "6 PM", hasAlcohol: false, tags: ["Café", "Bakery", "Family Friendly"], image: "photo-1554118811-1e0d58224f24" },
  // Austin
  { id: "bluebonnet-bbq", name: "Bluebonnet BBQ", type: "Texas BBQ", area: "East Austin · Austin", score: 4.9, priceRange: "$$", distanceKm: 2.2, openUntil: "10 PM", hasAlcohol: true, tags: ["BBQ", "Craft Beer", "Live Music"], image: "photo-1558030006-450675393462" },
  { id: "velvet-lounge", name: "Velvet Lounge", type: "Lounge & Club", area: "Rainey Street · Austin", score: 4.4, priceRange: "$$", distanceKm: 1.4, openUntil: "2 AM", hasAlcohol: true, tags: ["Nightlife", "Cocktail Bar", "Dancing"], image: "photo-1572116469696-31de0f17cc34" },
  // Seattle / Nashville
  { id: "cascade-coffee-co", name: "Cascade Coffee Co.", type: "Café", area: "Capitol Hill · Seattle", score: 4.6, priceRange: "$", distanceKm: 4.5, openUntil: "8 PM", hasAlcohol: false, tags: ["Café", "Roastery", "Cozy"], image: "photo-1495474472287-4d71bcdd2085" },
  { id: "bourbon-and-brass", name: "Bourbon & Brass", type: "Whiskey Bar", area: "Downtown · Nashville", score: 4.6, priceRange: "$$$", distanceKm: 2.6, openUntil: "2 AM", hasAlcohol: true, tags: ["Whiskey Bar", "Live Music", "Late Night"], image: "photo-1436076863939-06870fe779c2" },
];

// review author, score, text, ai summary, tier, votes
const REVIEW_POOL: Array<[string, number, string, string, string, number]> = [
  ["Ava Mitchell", 4.6, "Had an incredible dinner here last night. The seafood was fresh and the service attentive without being intrusive.", "Vibrant atmosphere with exceptional service; the seafood selection stands out as the highlight.", "Verified Visit", 24],
  ["Leo Navarro", 4.5, "Excellent cocktails and great atmosphere. A little loud on weekends but worth it for the vibe.", "Strong cocktail program and lively ambiance, best enjoyed midweek for a quieter experience.", "Verified Visit", 18],
  ["Mia Chen", 4.8, "Absolutely loved the brunch. The avocado toast and the lavender latte were standouts.", "Standout brunch menu praised for fresh ingredients and creative drinks.", "Verified Visit", 31],
  ["Jordan Reyes", 4.9, "Best brisket I've had outside of a backyard cookout. Smoky, tender, and the sides were on point.", "Exceptional smoked meats and well-executed sides earn near-universal praise.", "Verified Visit", 42],
  ["Mia Chen", 4.7, "The steak was cooked to perfection and the wine pairing recommendation was spot on.", "Top-tier steak and knowledgeable wine pairings define the fine-dining experience.", "Verified Visit", 27],
  ["Leo Navarro", 4.4, "Great rooftop views and the DJ kept the energy up all night. Drinks are a touch pricey.", "Memorable rooftop setting with strong music, though prices skew higher.", "Verified Visit", 15],
  ["Sophie Tran", 4.7, "Cozy spot with friendly baristas and the best oat-milk latte in the neighborhood. My new morning ritual.", "Welcoming café with quality coffee and warm service, ideal for a regular stop.", "Partially Verified", 11],
  ["Marcus Webb", 4.5, "Solid whiskey selection and live music that didn't drown out conversation. Will be back.", "Broad whiskey list and balanced live music make for a relaxed night out.", "Verified Visit", 19],
  ["Priya Kapoor", 4.8, "The mezze platter was generous and full of flavor. Beautiful patio for a warm evening.", "Generous, flavorful Mediterranean plates and a standout outdoor patio.", "Verified Visit", 28],
  ["David Cohen", 4.3, "Fun energy and a packed dance floor. Lines can get long after midnight, so arrive early.", "High-energy nightlife with a lively dance floor; expect crowds late.", "Partially Verified", 13],
];

const UID_BY_NAME: Record<string, string> = {
  "Ava Mitchell": "demo-user-ava",
  "Leo Navarro": "demo-user-leo",
  "Mia Chen": "demo-user-mia",
  "Jordan Reyes": "demo-user-jay",
  "Sophie Tran": "creator-sophie-tran",
  "Marcus Webb": "creator-marcus-webb",
  "Priya Kapoor": "creator-priya-kapoor",
  "David Cohen": "creator-david-cohen",
};
const AVATAR_BY_NAME: Record<string, number> = {
  "Ava Mitchell": 5, "Leo Navarro": 12, "Mia Chen": 25, "Jordan Reyes": 33,
  "Sophie Tran": 45, "Marcus Webb": 51, "Priya Kapoor": 47, "David Cohen": 53,
};

// ---------------------------------------------------------------------------
// Search-category entities: vendors / entertainers / brands / posts
// ---------------------------------------------------------------------------
const VENDORS = [
  { id: "vend-golden-spoon", name: "Golden Spoon Catering", category: "Catering", tagline: "Farm-to-table catering for any event", image: "photo-1555244162-803834f70033", city: "Los Angeles", rating: 4.8 },
  { id: "vend-lumen-photo", name: "Lumen Photography", category: "Photography", tagline: "Editorial event & food photography", image: "photo-1452587925148-ce544e77e70d", city: "New York", rating: 4.9 },
  { id: "vend-petal-co", name: "Petal & Co. Florals", category: "Florist", tagline: "Statement florals & installations", image: "photo-1561181286-d3fee7d55364", city: "Miami", rating: 4.7 },
  { id: "vend-eventworks", name: "EventWorks Rentals", category: "Event Rentals", tagline: "Tables, lighting & lounge furniture", image: "photo-1519167758481-83f550bb49b3", city: "Chicago", rating: 4.5 },
  { id: "vend-craft-pour", name: "Craft & Pour Bartending", category: "Bartending", tagline: "Craft cocktail bars on wheels", image: "photo-1514362545857-3bc16c4c7d1b", city: "Austin", rating: 4.8 },
  { id: "vend-sweet-layer", name: "Sweet Layer Bakehouse", category: "Bakery", tagline: "Custom cakes & dessert tables", image: "photo-1486427944299-d1955d23e34d", city: "Seattle", rating: 4.9 },
];

const ENTERTAINERS = [
  { id: "ent-dj-marquez", name: "DJ Marquez", role: "DJ", tagline: "Open-format · house & throwbacks", image: "photo-1571266028243-e4733b0f0bb0", city: "Miami", rating: 4.8 },
  { id: "ent-velvet-trio", name: "The Velvet Trio", role: "Live Band", tagline: "Jazz & soul for elegant evenings", image: "photo-1511192336575-5a79af67a629", city: "New York", rating: 4.9 },
  { id: "ent-luna-acoustic", name: "Luna Acoustic", role: "Acoustic Duo", tagline: "Mellow covers for brunch & patios", image: "photo-1510915361894-db8b60106cb1", city: "Los Angeles", rating: 4.7 },
  { id: "ent-mc-rivera", name: "MC Rivera", role: "Host / MC", tagline: "Keeps the energy & the night flowing", image: "photo-1493676304819-0d7a8d026dcf", city: "Austin", rating: 4.6 },
  { id: "ent-belle-strings", name: "Belle Strings", role: "String Quartet", tagline: "Classical & pop for upscale events", image: "photo-1465847899084-d164df4dedc6", city: "San Francisco", rating: 4.9 },
  { id: "ent-ember-fire", name: "Ember Fire Collective", role: "Performers", tagline: "Fire & LED performance art", image: "photo-1514525253161-7a46d19cd819", city: "Nashville", rating: 4.7 },
];

const BRANDS = [
  { id: "brand-aurora-spirits", name: "Aurora Spirits", category: "Beverage", tagline: "Small-batch craft spirits", image: "photo-1569529465841-dfecdab7503b", city: "Los Angeles" },
  { id: "brand-verde-sparkling", name: "Verde Sparkling", category: "Beverage", tagline: "Botanical sparkling water", image: "photo-1437418747212-8d9709afab22", city: "New York" },
  { id: "brand-noma-roasters", name: "Noma Roasters", category: "Coffee", tagline: "Direct-trade specialty coffee", image: "photo-1447933601403-0c6688de566e", city: "Seattle" },
  { id: "brand-luxe-linens", name: "Luxe Linens", category: "Lifestyle", tagline: "Premium event & table linens", image: "photo-1522771739844-6a9f6d5f14af", city: "Chicago" },
  { id: "brand-sol-salt", name: "Sol & Salt Tequila", category: "Beverage", tagline: "Agave-forward, small lots", image: "photo-1516997121675-4c2d1684aa3e", city: "Miami" },
  { id: "brand-ember-grill", name: "Ember Grill Co.", category: "Food", tagline: "Premium charcoal & rubs", image: "photo-1600891964092-4316c288032e", city: "Austin" },
];

// Authored by seeded users so authorUid resolves to a real users/{uid} doc.
const POSTS: Array<{ id: string; author: string; caption: string; image: string; venue: string; likes: number; persona: string }> = [
  { id: "post-1", author: "Ava Mitchell", caption: "Sunset cocktails on the rooftop never gets old 🍸", image: "photo-1517248135467-4c7edcad34c4", venue: "The Social Lounge", likes: 184, persona: "Food Lover" },
  { id: "post-2", author: "Leo Navarro", caption: "Best avocado toast in the city, hands down 🥑", image: "photo-1466978913421-dad2ebd01d17", venue: "Bloom Gardenia", likes: 96, persona: "Explorer" },
  { id: "post-3", author: "Mia Chen", caption: "Live set was unreal tonight 🎶", image: "photo-1514933651103-005eec06c04b", venue: "Neon Palm", likes: 241, persona: "Influencer" },
  { id: "post-4", author: "Jordan Reyes", caption: "Brisket so tender it falls apart 🔥", image: "photo-1529193591184-b1d58069ecdd", venue: "Brooklyn Smoke House", likes: 312, persona: "Food Lover" },
  { id: "post-5", author: "Marcus Webb", caption: "Late-night whiskey & live music. Perfect Friday.", image: "photo-1470337458703-46ad1756a187", venue: "The Gilded Owl", likes: 158, persona: "Artist" },
  { id: "post-6", author: "Priya Kapoor", caption: "That patio. That mezze platter. 🌿", image: "photo-1559339352-11d035aa65de", venue: "Saffron & Sea", likes: 203, persona: "Traveler" },
  { id: "post-7", author: "Sophie Tran", caption: "My morning ritual ☕ latte art on point.", image: "photo-1501339847302-ac426a4a7cbb", venue: "Morning Bell Café", likes: 87, persona: "Food Lover" },
  { id: "post-8", author: "Grace Okafor", caption: "Bakery hopping in the West Loop 🥐", image: "photo-1554118811-1e0d58224f24", venue: "The Atrium Café", likes: 121, persona: "Explorer" },
  // Extra posts for the demo account (Ava) so her profile + the feed are populated.
  { id: "post-9", author: "Ava Mitchell", caption: "Tasting menu at Neon Palm — every course a 10/10 ✨", image: "photo-1504674900247-0877df9cc836", venue: "Neon Palm", likes: 142, persona: "Food Lover" },
  { id: "post-10", author: "Ava Mitchell", caption: "Cozy corner, great coffee, even better people-watching ☕", image: "photo-1445116572660-236099ec97a0", venue: "The Atrium Café", likes: 98, persona: "Influencer" },
  { id: "post-11", author: "Ava Mitchell", caption: "Found my new weekend brunch obsession 🥂", image: "photo-1533920379810-6bedac961555", venue: "Bloom Gardenia", likes: 167, persona: "Food Lover" },
];

const CITY_COORDS: Record<string, [number, number]> = {
  "Los Angeles": [34.0522, -118.2437], "New York": [40.7128, -74.006],
  "Miami": [25.7617, -80.1918], "San Francisco": [37.7749, -122.4194],
  "Chicago": [41.8781, -87.6298], "Austin": [30.2672, -97.7431],
  "Seattle": [47.6062, -122.3321], "Nashville": [36.1627, -86.7816],
};

// category, name, price, description — applied per establishment.
const MENU_TEMPLATES: Array<[string, string, number, string]> = [
  ["Starters", "Truffle Burrata", 16, "Creamy burrata, truffle honey, grilled sourdough"],
  ["Starters", "Crispy Calamari", 14, "Lightly fried, lemon aioli"],
  ["Mains", "Wood-Fired Salmon", 28, "Seasonal vegetables, herb butter"],
  ["Mains", "Dry-Aged Ribeye", 42, "12oz, hand-cut fries, peppercorn jus"],
  ["Mains", "Wild Mushroom Risotto", 22, "Arborio, parmesan, fresh herbs"],
  ["Drinks", "Smoked Old Fashioned", 15, "Bourbon, bitters, applewood smoke"],
  ["Drinks", "Garden Spritz", 13, "Elderflower, prosecco, cucumber"],
  ["Desserts", "Dark Chocolate Torte", 11, "Sea salt, vanilla gelato"],
];

// ---------------------------------------------------------------------------
// seedDemoData
// ---------------------------------------------------------------------------

export const seedDemoData = onRequest(
  { region: "us-central1", memory: "256MiB", timeoutSeconds: 180 },
  async (req, res) => {
    if (req.query.key !== GUARD) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const db = getFirestore();
    const auth = getAuth();
    const now = Timestamp.now();
    const expiry = Timestamp.fromMillis(now.toMillis() + 90 * 24 * 60 * 60 * 1000);

    let userCount = 0, estCount = 0, reviewCount = 0, dealCount = 0;
    const credentials: Array<{ email: string; password: string; displayName: string }> = [];

    // --- 1. Loggable demo users (Auth + profile + balance) ---
    for (const u of USERS) {
      // Create/refresh the Auth user (idempotent).
      try {
        await auth.createUser({ uid: u.uid, email: u.email, password: u.password, displayName: u.displayName });
      } catch {
        try { await auth.updateUser(u.uid, { email: u.email, password: u.password, displayName: u.displayName }); } catch { /* ignore */ }
      }

      await db.collection("users").doc(u.uid).set({
        uid: u.uid,
        displayName: u.displayName,
        photoUrl: AVATAR(u.avatar),
        bio: u.bio,
        followersCount: u.followers,
        followingCount: u.following,
        reviewCount: u.reviews,
        verifiedReviewCount: u.reviews,
        pointsBalance: u.points,
        rollingPoints12mo: u.points,
        loyaltyTier: u.tier,
        tierHiddenByUser: false,
        onboardingComplete: true,
        phoneVerified: true,
        isPlusSubscriber: u.tier === "platinum",
        tasteCohort: u.cohort,
        isBanned: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      }, { merge: true });

      await db.collection("userBalances").doc(u.uid).set({
        userId: u.uid, balance: u.points, lifetimeEarned: u.points, lifetimeSpent: 0, updatedAt: now,
      }, { merge: true });

      credentials.push({ email: u.email, password: u.password, displayName: u.displayName });
      userCount++;
    }

    // --- 1b. Display-only creator profiles (Creators tab + author tap-through) ---
    let creatorCount = 0;
    for (const c of CREATORS) {
      await db.collection("users").doc(c.uid).set({
        uid: c.uid,
        displayName: c.displayName,
        photoUrl: AVATAR(c.avatar),
        bio: c.bio,
        followersCount: c.followers,
        followingCount: c.following,
        reviewCount: c.reviews,
        verifiedReviewCount: c.reviews,
        pointsBalance: c.points,
        rollingPoints12mo: c.points,
        loyaltyTier: c.tier,
        tierHiddenByUser: false,
        onboardingComplete: true,
        phoneVerified: true,
        isPlusSubscriber: c.tier === "platinum",
        tasteCohort: c.cohort,
        isBanned: false,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      }, { merge: true });
      creatorCount++;
    }

    // --- 2. Establishments + reviews + deals ---
    for (let i = 0; i < ESTABLISHMENTS.length; i++) {
      const e = ESTABLISHMENTS[i];
      const hasDeals = i % 2 === 0;

      // "People Like You" per-cohort scores. Cohorts with a conflict get count 0
      // and are omitted, so those viewers see the general score only.
      const plyByCohort: Record<string, number> = {};
      const plyCountByCohort: Record<string, number> = {};
      for (const c of COHORTS) {
        const { score, count } = plyForCohort(e, c);
        if (count > 0) {
          plyByCohort[c] = score;
          plyCountByCohort[c] = count;
        }
      }

      // Address + map coordinates (derived from the venue's city).
      const city = e.area.split("·").pop()?.trim() ?? "Los Angeles";
      const base = CITY_COORDS[city] ?? CITY_COORDS["Los Angeles"];
      const lat = base[0] + ((i % 5) - 2) * 0.012;
      const lng = base[1] + ((i % 5) - 2) * 0.012;
      const address = `${120 + i * 17} Main St, ${city}`;

      await db.collection("establishments").doc(e.id).set({
        name: e.name, type: e.type, area: e.area, imageUrl: IMG(e.image),
        score: e.score, priceRange: e.priceRange, distanceKm: e.distanceKm,
        openUntil: e.openUntil, hasAlcohol: e.hasAlcohol, hasReservations: true,
        isOpenForReservations: true, coverPhotoUrl: IMG(e.image),
        hasDeals, isActive: true, tags: e.tags,
        overallScore: e.score, reviewCount: 2, isVerifiedBusiness: true,
        plyByCohort, plyCountByCohort,
        address, lat, lng,
        updatedAt: now, createdAt: now, schemaVersion: 1,
      }, { merge: true });
      estCount++;

      // Menu items (establishments/{id}/menu) — same curated template per venue.
      for (let m = 0; m < MENU_TEMPLATES.length; m++) {
        const [category, mname, price, description] = MENU_TEMPLATES[m];
        await db.collection("establishments").doc(e.id).collection("menu").doc(`item-${m}`).set({
          name: mname, description, price, category,
          imageUrl: "", isAvailable: true, sortOrder: m,
          createdAt: now, updatedAt: now,
        }, { merge: true });
      }

      // CORS-friendly Unsplash food/venue photos so review Photos render on web.
      const PHOTO_IDS = [
        "photo-1517248135467-4c7edcad34c4", "photo-1544025162-d76694265947",
        "photo-1466978913421-dad2ebd01d17", "photo-1559339352-11d035aa65de",
        "photo-1467003909585-2f8a72700288", "photo-1470337458703-46ad1756a187",
        "photo-1414235077428-338989a2e8c0", "photo-1551782450-a2132b4ba21d",
      ];
      for (let j = 0; j < 2; j++) {
        const [authorName, score, text, , tier, votes] = REVIEW_POOL[(i + j) % REVIEW_POOL.length];
        const reviewId = `demo-${e.id}-${j}`;
        // Attach 2–3 photos to EVERY review so every author's Photos tab fills.
        const nPhotos = ((i + j) % 2) + 2;
        const photoUrls = Array.from({ length: nPhotos }, (_, k) =>
          IMG(PHOTO_IDS[(i + j + k) % PHOTO_IDS.length]));
        const review = {
          estId: e.id, estName: e.name, authorUid: UID_BY_NAME[authorName] ?? "demo-user-ava",
          authorName, authorPhotoUrl: AVATAR(AVATAR_BY_NAME[authorName] ?? 5),
          score, rawScore: score, text, body: text,
          verificationTier: tier, helpfulVotes: votes, status: "published",
          photoUrls,
          createdAt: now, submittedAt: now,
        };
        await db.collection("reviews").doc(reviewId).set(review, { merge: true });
        await db.collection("establishments").doc(e.id).collection("reviews").doc(reviewId).set(review, { merge: true });
        reviewCount++;
      }

      if (hasDeals) {
        const DEAL_TEMPLATES = [
          { title: "Free Specialty Coffee", description: "Redeem for one complimentary specialty coffee of your choice.", category: "food", pointCost: 250, valueCents: 1400 },
          { title: "Complimentary Appetizer", description: "Enjoy a free appetizer from our starter menu with any entrée.", category: "food", pointCost: 200, valueCents: 1200 },
          { title: "20% Off Your Bill", description: "Take 20% off your total bill, up to $25 off.", category: "discount", pointCost: 400, valueCents: 2500 },
          { title: "Free Dessert", description: "A complimentary dessert of the day with any main course.", category: "food", pointCost: 150, valueCents: 900 },
          { title: "Buy One Get One Entrée", description: "Buy one signature entrée and get the second one free.", category: "food", pointCost: 300, valueCents: 1600 },
        ];
        const t = DEAL_TEMPLATES[(i / 2) % DEAL_TEMPLATES.length];
        const dealId = `demo-deal-${e.id}`;
        const deal = {
          dealId, estId: e.id, estName: e.name,
          title: t.title, description: t.description, category: t.category,
          pointCost: t.pointCost, originalValueCents: t.valueCents, value: t.valueCents / 100,
          coverImageUrl: IMG(e.image), imageUrl: IMG(e.image), isActive: true,
          remainingRedemptions: 50, redemptionsCount: 0, maxRedemptionsPerUser: 1,
          startsAt: now, expiresAt: expiry, createdAt: now, updatedAt: now, schemaVersion: 1,
        };
        await db.collection("deals").doc(dealId).set(deal, { merge: true });
        await db.collection("establishments").doc(e.id).collection("deals").doc(dealId).set(deal, { merge: true });
        dealCount++;
      }
    }

    // --- 5. Comments on a few reviews (so the comments feature is populated) ---
    let commentCount = 0;
    {
      const revSnap = await db.collection("reviews").where("status", "==", "published").limit(8).get();
      const COMMENT_POOL: Array<[string, string, string]> = [
        ["demo-user-leo", "Leo Navarro", "Totally agree — went last week and loved it!"],
        ["demo-user-mia", "Mia Chen", "Adding this to my list, thanks for the tip 🙌"],
        ["demo-user-jay", "Jordan Reyes", "The service really is top notch here."],
        ["demo-user-ava", "Ava Mitchell", "Spot on about the atmosphere, great review!"],
      ];
      for (let r = 0; r < revSnap.docs.length; r++) {
        const reviewId = revSnap.docs[r].id;
        const n = (r % 3) + 1; // 1–3 comments
        for (let c = 0; c < n; c++) {
          const [uid, name, text] = COMMENT_POOL[(r + c) % COMMENT_POOL.length];
          await db.collection("reviews").doc(reviewId).collection("comments").add({
            reviewId, authorUid: uid, authorName: name,
            authorPhotoUrl: AVATAR(AVATAR_BY_NAME[name] ?? 5),
            text, createdAt: Timestamp.fromMillis(now.toMillis() - (c + 1) * 3600000),
          });
          commentCount++;
        }
      }
    }

    // --- 6. Direct chat conversations + messages between demo users ---
    let conversationCount = 0;
    {
      const CONVOS: Array<[string, string, string, string, Array<[string, string]>]> = [
        ["demo-user-ava", "Ava Mitchell", "demo-user-leo", "Leo Navarro", [
          ["demo-user-leo", "Hey Ava! Going to The Social Lounge this weekend?"],
          ["demo-user-ava", "Thinking about it! Heard the rooftop is amazing."],
          ["demo-user-leo", "It is — let's grab a table Saturday?"],
          ["demo-user-ava", "I'm in. Booking it now 🎉"],
        ]],
        ["demo-user-ava", "Ava Mitchell", "demo-user-mia", "Mia Chen", [
          ["demo-user-mia", "That brunch place you reviewed looks incredible."],
          ["demo-user-ava", "Bloom Gardenia! The lavender latte is a must."],
          ["demo-user-mia", "Saving it. Want to go together next week?"],
        ]],
        ["demo-user-leo", "Leo Navarro", "demo-user-jay", "Jordan Reyes", [
          ["demo-user-jay", "Brisket at Brooklyn Smoke House = life changing 🔥"],
          ["demo-user-leo", "Adding it to the list right now."],
        ]],
      ];
      for (const [aUid, aName, bUid, bName, msgs] of CONVOS) {
        const participants = [aUid, bUid].sort();
        const convId = `${participants[0]}__${participants[1]}`;
        const last = msgs[msgs.length - 1];
        await db.collection("conversations").doc(convId).set({
          conversationId: convId,
          participantUids: participants,
          participantInfo: {
            [aUid]: { displayName: aName, photoUrl: AVATAR(AVATAR_BY_NAME[aName] ?? 5) },
            [bUid]: { displayName: bName, photoUrl: AVATAR(AVATAR_BY_NAME[bName] ?? 5) },
          },
          lastMessageText: last[1],
          lastMessageAt: now,
          lastMessageSenderUid: last[0],
          unreadCounts: { [aUid]: 0, [bUid]: 0 },
          createdAt: now, updatedAt: now,
        }, { merge: true });
        for (let m = 0; m < msgs.length; m++) {
          const [sUid, text] = msgs[m];
          const msgRef = db.collection("conversations").doc(convId).collection("messages").doc();
          await msgRef.set({
            messageId: msgRef.id, conversationId: convId, senderUid: sUid,
            text, isDeleted: false,
            sentAt: Timestamp.fromMillis(now.toMillis() - (msgs.length - m) * 60000),
          });
        }
        conversationCount++;
      }
    }

    // --- 7. Reservations for Ava (so My Reservations is populated) ---
    let reservationCount = 0;
    {
      const RES: Array<[string, string, number, number, string]> = [
        // estId, estName, partySize, daysFromNow, status
        ["the-social-lounge", "The Social Lounge", 2, 3, "confirmed"],
        ["amber-ember", "Amber & Ember", 4, -10, "completed"],
      ];
      for (let i = 0; i < RES.length; i++) {
        const [estId, estName, partySize, days, status] = RES[i];
        const sched = Timestamp.fromMillis(now.toMillis() + days * 24 * 60 * 60 * 1000);
        const resId = `demo-res-ava-${i}`;
        await db.collection("reservations").doc(resId).set({
          reservationId: resId, guestUid: "demo-user-ava", estId, estName,
          guestDisplayName: "Ava Mitchell", guestPhotoUrl: AVATAR(5),
          partySize, scheduledAt: sched, slotId: "",
          notes: null, status,
          checkedInAt: null, completedAt: status === "completed" ? now : null,
          cancelledAt: null,
          cancellationDeadlineAt: Timestamp.fromMillis(sched.toMillis() - 48 * 60 * 60 * 1000),
          checkInQrCode: "", checkInOtpHash: "", otpExpiresAt: now, otpAttempts: 0,
          idempotencyKey: resId, cancelledBy: null, cancellationReason: null,
          checkInMethod: null, reminder24hSent: false, reminder2hSent: false,
          noShowAt: null, noShowRecordedAt: null, noShowPenaltyApplied: false,
          createdAt: now, updatedAt: now, schemaVersion: 1,
        }, { merge: true });
        reservationCount++;
      }
    }

    // --- 7b. Notifications per demo user (so the bell shows real items) ---
    let notificationCount = 0;
    {
      const NOTIF_TEMPLATES: Array<[string, string]> = [
        ["New follower", "Leo Navarro started following you."],
        ["Points earned", "Your review earned you 75 points 🎉"],
        ["New deal nearby", "Neon Palm just dropped a new deal — 200 pts."],
        ["New comment", "Mia Chen commented on your review."],
        ["Reservation confirmed", "Your table at Amber & Ember is confirmed."],
        ["Badge unlocked", "You earned the Critic badge for 10 reviews!"],
      ];
      for (const u of USERS) {
        for (let n = 0; n < NOTIF_TEMPLATES.length; n++) {
          const [title, body] = NOTIF_TEMPLATES[n];
          const notifId = `demo-notif-${u.uid}-${n}`;
          await db.collection("notifications").doc(u.uid).collection("items").doc(notifId).set({
            type: "demo",
            title, body,
            isRead: n >= 3, // first 3 unread
            isDeleted: false,
            createdAt: Timestamp.fromMillis(now.toMillis() - n * 3600000),
          }, { merge: true });
          notificationCount++;
        }
      }
    }

    // --- 8. Curated lists per user (users/{uid}/lists) for the Lists tab ---
    let listCount = 0;
    {
      const IMGW = (id: string) => `https://images.unsplash.com/${id}?w=400&q=80`;
      const LIST_TEMPLATES: Array<[string, string[]]> = [
        ["Date Night Spots", ["photo-1544025162-d76694265947", "photo-1470337458703-46ad1756a187", "photo-1517248135467-4c7edcad34c4"]],
        ["Weekend Brunch", ["photo-1466978913421-dad2ebd01d17", "photo-1501339847302-ac426a4a7cbb", "photo-1554118811-1e0d58224f24"]],
        ["Hidden Gems", ["photo-1559339352-11d035aa65de", "photo-1467003909585-2f8a72700288", "photo-1510812431401-41d2bd2722f3"]],
        ["Late Night Eats", ["photo-1514933651103-005eec06c04b", "photo-1538488881038-e252a119ace7", "photo-1572116469696-31de0f17cc34"]],
      ];
      const allUids = [
        ...USERS.map((u) => u.uid),
        ...CREATORS.map((c) => c.uid),
      ];
      for (let ui = 0; ui < allUids.length; ui++) {
        const uid = allUids[ui];
        for (let li = 0; li < 2; li++) {
          const [name, covers] = LIST_TEMPLATES[(ui + li) % LIST_TEMPLATES.length];
          const listId = `demo-list-${uid}-${li}`;
          await db.collection("users").doc(uid).collection("lists").doc(listId).set({
            listId, name,
            coverImages: covers.map(IMGW),
            venueCount: covers.length + ((ui + li) % 4),
            createdAt: now, updatedAt: now,
          }, { merge: true });
          listCount++;
        }
      }
    }

    // --- 9. Search-category entities: vendors / entertainers / brands / posts ---
    let vendorCount = 0, entertainerCount = 0, brandCount = 0, postCount = 0;
    {
      for (const v of VENDORS) {
        await db.collection("vendors").doc(v.id).set({
          name: v.name, category: v.category, tagline: v.tagline,
          imageUrl: IMG(v.image), city: v.city, rating: v.rating,
          isActive: true, createdAt: now, updatedAt: now, schemaVersion: 1,
        }, { merge: true });
        vendorCount++;
      }
      for (const en of ENTERTAINERS) {
        await db.collection("entertainers").doc(en.id).set({
          name: en.name, role: en.role, tagline: en.tagline,
          imageUrl: IMG(en.image), city: en.city, rating: en.rating,
          isActive: true, createdAt: now, updatedAt: now, schemaVersion: 1,
        }, { merge: true });
        entertainerCount++;
      }
      for (const b of BRANDS) {
        await db.collection("brands").doc(b.id).set({
          name: b.name, category: b.category, tagline: b.tagline,
          imageUrl: IMG(b.image), city: b.city,
          isActive: true, createdAt: now, updatedAt: now, schemaVersion: 1,
        }, { merge: true });
        brandCount++;
      }
      // Map venue display name → establishment id so posts can deep-link the tagged venue.
      const estIdByName: Record<string, string> = {};
      for (const e of ESTABLISHMENTS) estIdByName[e.name] = e.id;
      for (let p = 0; p < POSTS.length; p++) {
        const post = POSTS[p];
        const authorUid = UID_BY_NAME[post.author] ?? "demo-user-ava";
        await db.collection("posts").doc(post.id).set({
          authorUid, authorName: post.author,
          authorPhotoUrl: AVATAR(AVATAR_BY_NAME[post.author] ?? 5),
          caption: post.caption, imageUrl: IMG(post.image),
          mediaUrl: IMG(post.image), // backend mirror field
          venueName: post.venue, venueId: estIdByName[post.venue] ?? "",
          persona: post.persona,
          likes: post.likes, likeCount: post.likes,
          isActive: true,
          createdAt: Timestamp.fromMillis(now.toMillis() - p * 5400000),
          updatedAt: now, schemaVersion: 1,
        }, { merge: true });
        postCount++;
      }
    }

    res.status(200).json({
      ok: true,
      seeded: {
        users: userCount, creators: creatorCount, establishments: estCount, reviews: reviewCount, deals: dealCount,
        comments: commentCount, conversations: conversationCount, reservations: reservationCount,
        notifications: notificationCount, lists: listCount,
        vendors: vendorCount, entertainers: entertainerCount, brands: brandCount, posts: postCount,
      },
      loginCredentials: credentials,
      note: "Demo content seeded. Log in with any credential above for a populated experience. Remove seedDemoData in a later deploy.",
    });
  }
);
