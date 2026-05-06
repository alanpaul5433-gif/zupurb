# Zupurb — Technical Architecture

**Status:** Drafted 2026-05-05. Aligns with `DEVELOPMENT_PLAN.md` decisions through Phase 0.
**Stack:** Flutter (mobile) + Firebase (backend) + selected third-party services.
**Audience:** Engineers (human or AI) deciding where new code should live or how a new feature should fit.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                                 │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  User App   │  │ Business App │  │  Admin   │  │  Marketing   │ │
│  │  (Flutter)  │  │   (Flutter)  │  │ (Retool) │  │   (Web/SEO)  │ │
│  └──────┬──────┘  └──────┬───────┘  └────┬─────┘  └──────────────┘ │
└─────────┼────────────────┼────────────────┼────────────────────────┘
          │                │                │
          │  ▼ Firebase Auth + App Check ▼  │
          │                │                │
┌─────────▼────────────────▼────────────────▼────────────────────────┐
│                       BACKEND TIER (Firebase / GCP)                 │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐            │
│  │  Firestore   │  │   Cloud      │  │  Cloud Tasks   │            │
│  │  (primary)   │◄─┤  Functions   ├─►│  (async work)  │            │
│  │              │  │  (2nd gen)   │  │                │            │
│  └──────┬───────┘  └──┬────────┬──┘  └────────────────┘            │
│         │             │        │                                    │
│  ┌──────▼─────┐ ┌─────▼──┐ ┌───▼──────┐ ┌──────────┐ ┌──────────┐ │
│  │ BigQuery   │ │ Cloud  │ │ Firebase │ │  Remote  │ │   FCM    │ │
│  │ (auto-     │ │Storage │ │ Auth +   │ │  Config  │ │ (push)   │ │
│  │  export)   │ │ + CDN  │ │App Check │ │          │ │          │ │
│  └────────────┘ └────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                                     │
│         ┌────────────────────────────────────────┐                  │
│         │  Redis (Upstash) — score & feed cache  │                  │
│         └────────────────────────────────────────┘                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                  THIRD-PARTY INTEGRATION TIER                       │
│                                                                     │
│  Receipt OCR    AI Summary      Gift Cards     Maps & Places        │
│  (TBD —         (Anthropic      (Tremendous)   (Google)             │
│   harness)       Claude Haiku)                                      │
│                                                                     │
│  IAP / Subs     Push (extra)    Anti-Fraud     Image Moderation     │
│  (RevenueCat)   (OneSignal?)    (FingerprintJS) (AWS Rekognition)   │
│                                                                     │
│  Search         Email           Video          Deep Linking         │
│  (Algolia)      (SendGrid)      (Mux/CFStream) (Branch.io)          │
└─────────────────────────────────────────────────────────────────────┘
```

**Boundary principles:**
- Clients never read business data directly — all writes flow through Cloud Functions or rule-gated Firestore writes.
- Third-party calls only originate from Cloud Functions, never from the client (keeps API keys + cost visible + auditable).
- BigQuery is read-only from the app side; analytics queries never hit Firestore live data.

---

## 2. Data Architecture (Firestore)

### Collection Hierarchy

```
users/{userId}                              ← profile, fingerprint, tier, tier history
  ├── fingerprintSnapshots/{snapshotId}     ← frozen at each review submission
  ├── notifications/{notifId}
  ├── referrals/{referralId}                ← outbound referrals (this user as referrer)
  ├── reservations/{reservationId}          ← user's bookings (denormalized)
  └── reviewDrafts/{draftId}                ← offline drafts before submission

private_user_data/{userId}                  ← invisible to user; admin-only reads
  └── uar, deviceFingerprints, fraudFlags, internalNotes

establishments/{estId}                      ← venue data, computed scores
  ├── reviews/{reviewId}                    ← denormalized for venue page query
  ├── reservationSlots/{slotId}             ← venue's slot config
  ├── deals/{dealId}                        ← venue-specific deals
  └── scoreCacheByDemographic/{bucketId}    ← optional pre-aggregation

reviews/{reviewId}                          ← flat collection (cross-venue queries)
                                              fields: userId, estId, answers[], rawScore,
                                              weightFactor, fingerprintSnapshotId,
                                              uarAtSubmission, verificationTier,
                                              disclosureCategory, mediaIds[], status

reservations/{reservationId}                ← flat collection (admin queries)
deals/{dealId}                              ← global deal index
dealRedemptions/{redemptionId}              ← append-only redemption log

pointsLedger/{entryId}                      ← APPEND-ONLY ledger
                                              fields: userId, delta, reason, sourceType,
                                              sourceId, earnedAt, expiresAt, balanceAfter

userBalances/{userId}                       ← projected current balance
                                              (derived from ledger; cached for fast reads)

challenges/{challengeId}                    ← global challenge definitions
userChallengeProgress/{userId}_{challengeId} ← per-user progress

badges/{badgeId}                            ← global badge definitions
userBadges/{userId}/badges/{badgeId}        ← earned per user

conversations/{conversationId}              ← chat thread metadata
  └── messages/{messageId}                  ← chat messages (subcollection)

posts/{postId}                              ← social photo posts
reels/{reelId}                              ← short-form video

flags/{flagId}                              ← anti-fraud flags (admin queue)
adminQueue/{queueItemId}                    ← moderation tasks

referralCodes/{code}                        ← reverse lookup: code → userId
```

### Key Indexes (Composite)

| Collection | Query | Index |
|---|---|---|
| `reviews` | List by user, by date | `userId asc, submittedAt desc` |
| `reviews` | List for establishment | `estId asc, submittedAt desc` |
| `reviews` | List for venue + verified-only | `estId asc, verificationTier asc, submittedAt desc` |
| `pointsLedger` | User's recent activity | `userId asc, earnedAt desc` |
| `pointsLedger` | Expiring soon | `userId asc, expiresAt asc, redeemed asc` |
| `reservations` | Venue + date range | `estId asc, scheduledAt asc` |
| `deals` | Active near user | `geohash asc, active asc, expiresAt desc` |
| `notifications` | Recent + unread | `userId asc, readAt asc, createdAt desc` |

### Security Rule Philosophy

- **Default deny.** No collection is readable or writable by default.
- **Reads:** Allow if user is the document owner, OR document is public, OR user has admin custom claim.
- **Writes:** Only via Cloud Functions for anything that affects scoring, points, badges, UAR, tier, or admin state. Direct client writes only for harmless user-controlled state (profile bio, privacy toggles, draft saves).
- **App Check enforced on every callable.**
- **Phone verification status checked** before allowing review/reservation/redemption writes.
- **Sandbox status (UAR < 0.3) blocks** all review writes; user sees normal UI but writes are no-ops.

### Denormalization Choices

- Review data is **duplicated** into both `reviews/{id}` (flat) and `establishments/{estId}/reviews/{id}` (subcollection) — write cost paid for read efficiency on venue pages.
- User display name + photo URL are **denormalized into reviews and posts** at write time. Profile updates fan out to recent items only (last 30 days); older items keep stale display data (acceptable trade-off).
- Establishment score (Overall) is **stored as a field on the establishment doc** — recomputed on every review write, never queried live.
- "From People Like You" score is **NOT pre-computed** per establishment — it's per-viewer, computed on demand and cached in Redis with key `fpyl:{estId}:{viewerFingerprintHash}`.

---

## 3. Algorithmic Architecture

### The Review-Submission Fan-Out (Heaviest Path)

When a user submits a review, this graph of work fires:

```
┌─────────────────┐
│  Client submits │
│   review        │
└────────┬────────┘
         │ (validated callable function)
         ▼
┌────────────────────┐
│  reviews/onCreate  │ ← Firestore trigger, runs synchronously
└────────┬───────────┘
         │
         ├──► Receipt OCR (queued via Cloud Tasks → vendor)
         ├──► Photo validation (queued)
         ├──► AI summary generation (queued)
         ├──► Per-review score calculation
         │       ↓
         │    Establishment rolling score recalc
         │       ↓
         │    Invalidate Redis FPYL cache for affected establishment
         ├──► UAR adjustment (small bump on verified)
         ├──► Points award (writes pointsLedger entry)
         │       ↓
         │    Update userBalances projection
         ├──► Badge progression check (might unlock + bonus pts)
         ├──► Challenge progression check
         ├──► Tier recalc (rolling 12-mo window)
         ├──► Fraud Layer 2 (behavioural pattern check)
         ├──► Fraud Layer 3 (questionnaire structure check)
         ├──► Fraud Layer 4 (statistical anomaly + cluster)
         ├──► Q8 contradiction check
         ├──► Notification fanout to followers (async)
         └──► BigQuery export (auto)
```

Most steps run **asynchronously via Cloud Tasks** so review submission UX returns in <500ms. The synchronous path returns: score, points awarded, balance after, any badge unlocks. Slower work (OCR, AI summary) lands seconds later via push update or refresh.

### Core Algorithms

| Algorithm | Location | Inputs | Output | Complexity |
|---|---|---|---|---|
| **Per-Review Score** | `algorithms/score.ts` | answers[Q1..Q7], establishmentType, weightFactor | rawScore ∈ [1.0, 5.0] | O(1) |
| **Establishment Rolling Score (Overall)** | `algorithms/score.ts` | All review docs for est, each reviewer's UAR snapshot | weighted average | O(N reviews) — incremental update preferred |
| **From People Like You Score** | `algorithms/score.ts` | viewer fingerprint, all reviewers' fingerprintSnapshots | weighted score using only similarity ≥ 0.75 | O(N reviews) per call — cache aggressively |
| **Demographic Similarity** | `algorithms/fingerprint.ts` | two fingerprint vectors | cosine ∈ [0, 1] | O(D dimensions) |
| **UAR Adjustment** | `algorithms/uar.ts` | event type, current UAR | delta + new UAR | O(1) |
| **Time Decay** | `algorithms/timeDecay.ts` | review timestamp | weight multiplier ∈ {1.0, 0.7, 0.4, 0.2} | O(1) |
| **Q8 Contradiction Check** | `algorithms/fraudDetection.ts` | answers[Q1..Q8] | flag bool | O(1) |
| **Statistical Anomaly Check** | `algorithms/fraudDetection.ts` | answers[Q1..Q8] | flag bool (all-A or all-D) | O(1) |
| **Coordinated Attack Detector** | `algorithms/fraudDetection.ts` | recent reviews on est, time window | cluster signal | O(N reviews in window) — runs async |
| **Tier Calculation** | `algorithms/tiers.ts` | rolling 12-mo points sum | tier name | O(1) given pre-aggregated sum |

### Caching Strategy

| Cache key | Layer | TTL | Invalidation |
|---|---|---|---|
| `establishment:{id}:overallScore` | Redis | 24h | Invalidated on any review write to that est |
| `fpyl:{estId}:{viewerFingerprintHash}` | Redis | 1h | Invalidated on any review write to that est |
| `userBalance:{userId}` | Redis | 5min | Invalidated on any pointsLedger write |
| `tierForUser:{userId}` | Redis | 1h | Invalidated quarter-end + on points event |
| `discoverFeed:{userId}:{lat,lng,radius}` | Redis | 10min | Time-based only |

Without Redis, From People Like You would recompute 100% of the time — that's the killer cost driver. Cache hit rate target: >95%.

---

## 4. Service Boundaries

### Cloud Functions — Four Function Types

| Type | When | Examples |
|---|---|---|
| **Triggered** (Firestore onCreate/onUpdate/onDelete) | Reactive to data changes | `reviews_onCreate`, `users_onUpdate`, `points_ledger_onCreate` |
| **Scheduled** (Cloud Scheduler crons) | Time-based | `points_expireBatch` (daily), `tier_quarterEndRecalc` (quarterly), `challenges_refresh` (weekly) |
| **Callable** (client → function direct) | Validated user actions | `reviews_submit`, `reservations_book`, `referrals_redeemCode`, `points_redeemDeal` |
| **HTTP** (webhooks from third parties) | Inbound vendor events | `revenuecat_webhook`, `tremendous_webhook` |

### Sync vs Async

| Operation | Path | Reason |
|---|---|---|
| Score calculation | Sync (callable returns score) | UX needs immediate feedback |
| Points award | Sync (returned in response) | Same |
| Badge unlock check | Sync (returned in response) | Same |
| OCR receipt | Async (Cloud Tasks → vendor) | Vendor latency 2–8 seconds |
| AI summary generation | Async | LLM latency 2–5 seconds |
| Photo validation | Async | Vendor latency |
| Fraud cluster detection | Async | Heavy query; runs out-of-band |
| Notification fanout | Async (Pub/Sub) | Can be eventually consistent |
| BigQuery export | Auto via Firebase Extension | Operational concern, not user-facing |
| Tier quarterly recalc | Scheduled (cron) | Not time-sensitive |

### Function Naming Convention

`<domain>_<event>` for triggered, `<domain>_<verb>` for callable.

Examples: `reviews_onCreate`, `reviews_submit`, `points_expireBatch`, `referrals_redeemCode`, `tiers_quarterEndRecalc`.

---

## 5. Folder Structures

### Mobile (Flutter — `lib/`)

```
lib/
├── main.dart                           ← entry point + Firebase init
├── app.dart                            ← MaterialApp, theme application
├── router.dart                         ← go_router config, route guards
│
├── theme/
│   ├── colors.dart                     ← design tokens (Phase 0 deliverable)
│   ├── dimens.dart                     ← spacing, radius, sizes
│   ├── text_styles.dart
│   └── theme.dart
│
├── l10n/                               ← ARB files; English at launch
│   └── app_en.arb
│
├── screens/                            ← one folder per feature
│   ├── auth/                           (splash, signup, login, forgot, otp)
│   ├── onboarding/                     (10 screens per SOW §6 — incl. missing Sensitive)
│   ├── home/                           (feed + tabs)
│   ├── search/
│   ├── discover/
│   ├── establishment/
│   ├── review/                         (verify visit + 8 questions + disclosure + written)
│   ├── reservation/
│   ├── messages/                       (in-house Firestore chat)
│   ├── profile/
│   ├── badges/                         (badges + challenges + leaderboard?)
│   ├── points/                         (wallet + redeem + tier)
│   └── settings/                       (settings + privacy)
│
├── widgets/                            ← shared, reusable components
│   ├── score_badge.dart
│   ├── review_card.dart
│   ├── time_slot_grid.dart
│   ├── tier_frame.dart
│   ├── otp_input.dart
│   └── ...
│
├── state/                              ← Riverpod providers/notifiers
│   ├── auth_state.dart
│   ├── user_profile_state.dart
│   ├── home_feed_state.dart
│   └── ...
│
├── models/                             ← plain Dart data classes (json_serializable)
│
├── services/                           ← thin wrappers around Cloud Functions
│   ├── reviews_service.dart            (calls reviews_submit etc.)
│   ├── reservations_service.dart
│   ├── points_service.dart
│   └── ...
│
├── integrations/                       ← third-party SDK wrappers (own by integrations-dev)
│   ├── firebase_auth_wrapper.dart
│   ├── revenuecat_wrapper.dart
│   ├── algolia_wrapper.dart
│   ├── maps_wrapper.dart
│   └── ...
│
└── utils/
    ├── exif_strip.dart
    ├── image_compress.dart
    ├── geohash.dart
    └── ...
```

### Backend (Firebase Functions — `functions/src/`)

```
functions/src/
├── index.ts                            ← exports all functions
│
├── domains/                            ← one subfolder per business domain
│   ├── auth/                           (account creation, phone verification)
│   ├── users/                          (profile CRUD, fingerprint generation, deletion)
│   ├── reviews/                        (submit, edit, score calc, AI summary call)
│   ├── establishments/                 (claim flow, score recalc trigger, geo)
│   ├── reservations/                   (book, check-in, cancel, no-show)
│   ├── deals/                          (matching, redemption, anti-abuse)
│   ├── points/                         (earn, expire, multiplier, ledger writes)
│   ├── badges/                         (progression, unlocks)
│   ├── tiers/                          (recalc, downgrade, perk activation)
│   ├── challenges/                     (refresh cron, progress check)
│   ├── referrals/                      (code generation, attribution, anti-fraud)
│   ├── messaging/                      (chat, follow gates, business 1-msg rule)
│   ├── notifications/                  (fanout, smart timing, FCM)
│   ├── fraud/                          (Layers 2/3/4, sandbox, quarantine)
│   └── admin/                          (moderation queue, suspend/ban, founder badge)
│
├── algorithms/                         ← pure functions, no Firestore I/O
│   ├── score.ts
│   ├── uar.ts
│   ├── fingerprint.ts                  (cosine similarity, fingerprint gen)
│   ├── timeDecay.ts
│   ├── weights.ts                      (restaurant/bar/nightclub/coffee weight matrix)
│   ├── fraudDetection.ts               (Q8 contradiction, all-A/D anomaly)
│   └── tierCalc.ts
│
├── integrations/                       ← thin vendor wrappers (own by integrations-dev)
│   ├── ocr.ts                          (vendor TBD post-harness)
│   ├── claude.ts                       (AI summary)
│   ├── tremendous.ts                   (gift cards)
│   ├── algolia.ts                      (search index)
│   ├── revenuecat.ts                   (subscription validation)
│   ├── rekognition.ts                  (image moderation)
│   └── perspective.ts                  (toxicity)
│
├── lib/                                ← shared utilities
│   ├── firestore.ts                    (typed accessors)
│   ├── logging.ts                      (structured JSON logger)
│   ├── validation.ts                   (Zod helpers)
│   ├── retry.ts
│   ├── idempotency.ts
│   └── auth.ts                         (custom claim checks)
│
└── schemas/                            ← Zod validators per domain
    ├── review.ts
    ├── reservation.ts
    └── ...
```

---

## 6. Cross-Cutting Concerns

### Authentication & Authorization

- **Firebase Auth** issues ID tokens; clients send them with every callable.
- **Custom claims** for `admin: true`, `staff: true` (Business Portal), set via Cloud Function only.
- **Phone verification** is a separate Auth provider link; reviews + reservations require it.
- **Account deletion** is a callable that anonymizes user data (CCPA right to be forgotten); reviews are kept (depersonalized) to preserve establishment scores.

### Error Handling

- **Cloud Functions** return typed error codes: `auth/required`, `validation/invalid`, `quota/exceeded`, `state/sandboxed`, `fraud/blocked`, `vendor/down`, etc.
- **Client maps codes to user copy** in `l10n/app_en.arb` — never shows raw error strings.
- **Fail-soft on async work** — if AI summary generation fails, the review still publishes with a fallback summary; ops gets a Sentry alert.

### Logging & Telemetry

- **Backend:** structured JSON to Cloud Logging, fields `traceId, userId, eventId, domain, eventType, durationMs, success`.
- **Mobile:** Crashlytics for crashes, Performance Monitoring for app start + screen render, Mixpanel for product events (sign-up, review submit, redemption, tier-up).
- **PII:** never log raw email, phone, fingerprint vector, UAR. Hash before logging if needed for correlation.

### Feature Flags (Remote Config)

Naming: `<domain>.<feature>.<param>`. Examples:

| Key | Purpose |
|---|---|
| `score.weights.restaurant` | Restaurant weight matrix |
| `score.weights.bar` | Bar/nightclub weight matrix |
| `fingerprint.similarityThreshold` | Currently 0.75 |
| `points.cost.deal.dessert` | Free dessert deal cost (currently 750) |
| `tier.thresholds.gold` | Currently 5000 |
| `feature.creatorMonetizationPhase2` | Off at launch, on later |

All scoring weights, point costs, tier thresholds, and similarity threshold must be in Remote Config — **never hardcoded.**

### Internationalization

- **English-only at launch**, but every user-facing string in `app_en.arb`.
- Date / number / currency formatting via `intl` package — never hardcoded format strings.

### Offline-First

- **Firestore offline persistence** enabled on mobile (caches reads + queues writes).
- **Review drafts** stored in Hive/Isar — survives crashes, restored on app open.
- **Optimistic UI** for upvotes, follows, deal-claim taps — server reconciles.
- **Pending state surfaced** when an action is queued and waiting for connectivity.

---

## 7. Security Boundaries

### What the Client Is NEVER Trusted For

- Per-review score calculation
- Establishment rolling score
- From People Like You score
- Points balance (always re-fetched from `userBalances` projection)
- UAR (never sent to client at all)
- Eligibility for gift card redemption (90 days + 20 reviews + UAR > 0.65)
- Tier calculation
- Badge unlock decisions
- Founder badge award (admin-only)
- Verification tier assignment (depends on OCR + photo validation results)
- Anti-fraud signals
- Deal point cost (Remote Config server-side; client just displays)

### Sensitive Data Handling

| Data | Storage | Visibility |
|---|---|---|
| Email, phone | Firebase Auth | User + admin only |
| Demographic profile | `users/{id}` | User + (some) similarity matching server-side |
| Demographic fingerprint snapshot | `users/{id}/fingerprintSnapshots/{id}` | Server-side only — never returned to client |
| UAR | `private_user_data/{id}` | Admin only |
| Device fingerprints | `private_user_data/{id}` | Admin only |
| Receipt images | Cloud Storage, time-limited URLs | OCR job + user only |
| Points ledger entries | `pointsLedger/{id}` | User reads only their own |
| Gift card codes | Tremendous side; we hold reference only | Delivered via email, not stored in app |

### App Check

- Enforced on all callables and Firestore writes.
- Debug tokens issued for dev builds; revoked in production.

### CCPA / Privacy

- "Do Not Sell My Personal Information" available in Privacy Settings.
- Account deletion within 30 days of request.
- Data export available via "Download My Data" — async job → email link.
- Privacy Policy URL live and reachable before launch.

---

## 8. Performance & Scaling

### Firestore Hot-Key Avoidance

- **Establishment review counters** could become hot keys on viral venues. Use **distributed counters** (10 shards per establishment) summed at read time.
- **No "global counter" patterns** anywhere. Everything scoped per-user or per-entity.

### Pagination

- Cursor-based pagination only (`startAfterDocument`). Never offset-based.
- Default page size: 20. Max: 50.

### Image Pipeline

```
Client picks image
  ↓ on-device:
  ├── EXIF-strip
  ├── compress to ≤ 2 MB
  └── orient correctly
  ↓
Resumable upload to Firebase Storage
  ↓ (on-finalize trigger):
  ├── thumbnail generation (Cloud Function)
  ├── moderation scan (Rekognition)
  └── attach mediaId to review/post
  ↓
Cloudflare CDN delivers to readers
```

### Video Pipeline

- Mux or Cloudflare Stream handle ingest, transcoding, HLS adaptive streaming.
- App uploads via Mux's resumable SDK; gets back a playback ID; stores playback ID on the reel doc.
- Thumbnails auto-extracted at first frame.

### BigQuery Analytics

- Auto-export from Firestore via the Firebase Extension.
- All cohort/retention/funnel queries run against BigQuery, never Firestore live data.
- Mixpanel/Amplitude is the front-end analytics tool layered on top.

### Performance Budgets

| Metric | Target |
|---|---|
| App cold start (release build, mid-range Android) | < 2.0s |
| Time to first contentful screen | < 1.5s |
| Home feed list scroll | 60fps sustained |
| Review submit → confirmation | < 1.5s |
| Establishment page open → scores visible | < 800ms (cache hit) / < 2s (miss) |
| Search query → results | < 1s (Algolia) |

---

## 9. Extension Model

### Where Does New Code Go?

| New thing | Goes in |
|---|---|
| New screen | `lib/screens/<feature>/` |
| New shared widget | `lib/widgets/` |
| New design token | `lib/theme/<file>.dart` (never inline values) |
| New Riverpod provider | `lib/state/<feature>_state.dart` |
| New backend domain | `functions/src/domains/<domain>/` |
| New algorithm (pure) | `functions/src/algorithms/<name>.ts` |
| New integration wrapper | `functions/src/integrations/<vendor>.ts` + optionally `lib/integrations/` |
| New Firestore collection | Top-level if cross-cutting; subcollection if owned by parent |
| New point cost / threshold | **Remote Config**, not source code |
| New feature flag | **Remote Config** with naming convention `<domain>.<feature>` |
| New scheduled job | `functions/src/domains/<domain>/<name>.ts` registered in Cloud Scheduler |
| New copy string | `lib/l10n/app_en.arb` — never inline |

### When to Create a New Microservice (Cloud Run)

Default: **don't.** Cloud Functions handle everything in the current scope. Promote to Cloud Run only if:

1. Function exceeds Cloud Functions memory/runtime limits (currently 2 GB / 9 min for triggered, 60 min for callable in 2nd gen).
2. Workload needs sticky state, websockets, or sustained connections (the in-house chat may approach this; revisit at scale).
3. A non-Node language is materially better (e.g., Python for ML inference if a custom model emerges).

### When to Add a New Pillar / Subagent

Trigger: a body of work that doesn't fit any existing pillar's scope and is non-trivial in size. Examples:

- **`data-scientist`** — when ML modeling on the From People Like You algorithm or fraud detection becomes meaningful work (probably post-launch).
- **`growth-engineer`** — referral funnel optimization, A/B test orchestration, retention experimentation.
- **`design-systems`** — when the design system itself needs maintenance separate from feature work.

Adding a pillar requires:
1. Add row to `docs/AGENTS.md` routing table.
2. Create `.claude/agents/<new>.md` with skill set + scope + workflow.
3. Update `DEVELOPMENT_PLAN.md` §1 The Five Pillars.
4. Update `RULES.md` if it changes any guardrail.

### Versioning Rules

- **Mobile app:** SemVer in `pubspec.yaml`. Build number monotonic across all flavors.
- **Cloud Functions:** Tagged independently — `backend-v1.2.3`. Breaking changes must ship dual-read code first, then migrate.
- **Firestore schema:** Forward-only migrations. Never drop fields used by any deployed app version. Use `schemaVersion` field on documents that change shape.
- **Remote Config:** Defaults shipped in app for fail-safe; server overrides take precedence.

---

## 10. Architecture Decision Records (ADR Index)

For significant decisions that come up during the build, create a short ADR. Format:

```
## ADR-NNN: <title>
Date:
Status: Proposed / Accepted / Superseded by ADR-XXX
Context: <2–3 lines>
Decision: <1 line>
Consequences: <bullet list>
```

Suggested location: `docs/adr/NNN-<slug>.md`.

### ADRs Captured From Phase 0

| ID | Decision | Source |
|---|---|---|
| ADR-001 | Stack: Flutter + Firebase | DEVELOPMENT_PLAN §8 (2026-05-05) |
| ADR-002 | Chat: in-house on Firestore | DEVELOPMENT_PLAN §8 (2026-05-05) |
| ADR-003 | Reservation flow: instant-confirm | DEVELOPMENT_PLAN §8 (2026-05-05) |
| ADR-004 | Cancellation: 48-hr cutoff, no fee | DEVELOPMENT_PLAN §8 (2026-05-05) |
| ADR-005 | Loyalty tiers: 4-tier rolling 12-mo points | DEVELOPMENT_PLAN §11.1 (2026-05-05) |
| ADR-006 | Referral system: 500/250 pts on first verified review | DEVELOPMENT_PLAN §11.2 (2026-05-05) |
| ADR-007 | Founder Badge cap: 150 | DEVELOPMENT_PLAN §8 (2026-05-05) |
| ADR-008 | Partially Verified points: 25 flat | DEVELOPMENT_PLAN §8 (2026-05-05) |
| ADR-009 | OCR: 4-vendor harness at $60 | DEVELOPMENT_PLAN §8 (2026-05-05) |
| ADR-010 | Gift cards: Tremendous | DEVELOPMENT_PLAN §8 (2026-05-05) |

When new architecture decisions arise mid-build, append them as ADR-011, ADR-012, etc.

---

This document is the canonical architecture reference. Any deviation must be captured as a new ADR.
