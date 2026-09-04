# Zupurb — Project Executive Summary

**Version:** 1.0 · **Date:** 2026-06-22 · **Audience:** stakeholders / investors / partners

---

## 1. What Zupurb is

Zupurb is a **location-based social discovery and loyalty platform** for dining, nightlife, and entertainment. It combines **trustworthy, verified reviews** with **personalized recommendations**, **reservations**, **deals & rewards**, and a growing **partner ecosystem** — so consumers discover the right places and experiences for *them*, and businesses reach and retain the right customers.

Its differentiator is **trust + personalization**: reviews tied to verified visits, an anti-fraud scoring layer, and a **"People Like You"** rating that shows how a venue scores among users with a similar taste profile — not just a generic star average.

## 2. Platform at a glance

| Component | Audience | Tech | Status |
|---|---|---|---|
| **Consumer app** | Diners / go-ers | Flutter (iOS, Android, Web) | Demo works end-to-end; core flows live, several in active development |
| **Restaurant Owner Portal** | Venue owners | Next.js (web) | ✅ Live |
| **Partner apps** (Entertainer, Vendor, Brand) | Supply-side partners | Next.js (web) | Planned (separate app per role) |
| **Creator program** | Influencers | In the consumer app | Planned |
| **Cloud backend** | — | Firebase (Firestore, Cloud Functions, Storage, Auth, Messaging, App Check) | ✅ Live |

## 3. Key features

**Discovery & Explore**
- Instagram-style Explore with **persona lenses** (Foodie, Nightlife, Traveler…), taste rails, and a post feed
- Venue, entertainer, vendor, and brand discovery; **maps & "near me"**; menu photos; search & filters

**Reviews & trust**
- **Verified-visit** reviews (receipt-backed), structured scoring, and an anti-fraud / user-reputation layer
- **"People Like You"** rating (per taste-cohort), AI review summaries, sponsorship **disclosure**, content moderation

**Reservations**
- Time-slot booking, reservation passes / QR check-in, "my reservations"

**Deals, rewards & loyalty**
- **Points** economy, **badges & challenges**, **loyalty tiers** (Bronze→…)
- Redeemable **deals** and **gift-card** rewards; **Zupurb Plus** subscription tier

**Social & content**
- Profiles, posts/feed, **Creators**, follow, and in-app **messaging/chat**

**Onboarding & personalization**
- Multi-step onboarding that captures a **taste profile** (interests, cuisines, demographics) powering recommendations and "People Like You"

**Owner Portal (live)**
- Dashboard & analytics, **deals** management, **reviews + responses**, **reservations** management, establishment profile, **announcements** to followers, **QR check-in**

**Account, privacy & compliance**
- Email + social sign-in, **account deletion** (with anonymization), GDPR data export, ATT consent, accessibility (WCAG-oriented)

## 4. Partner ecosystem (roadmap)

Beyond venue owners, the supply side is already modeled and will get self-service interfaces, **one role at a time**, on the shared backend:

| Role | Interface | Core capability |
|---|---|---|
| Entertainer | `zupurb_entertainer` (web) | Profile, availability, real bookings, messaging |
| Service Vendor | `zupurb_vendor` (web) | Profile, service packages, inquiries & quotes |
| Brand / Sponsor | `zupurb_brand` (web) | Offers/deals, sponsored placement, redemptions |
| Influencer / Creator | In-app | Creator program, verified badge, analytics, disclosure |

*(Detailed in `PARTNER_ROLES_PLAN`, `PARTNER_ROLES_SOW`, `PARTNER_ROLES_SPEC`.)*

## 5. Technology & integrations

- **Foundation:** Firebase / Google Cloud (auth, database, serverless logic, storage, push, analytics, crash reporting) — already operational.
- **To activate at launch/scale:** Apple Developer & Google Play, Google Maps, SendGrid (email), a receipt-scanning vendor, RevenueCat (subscriptions), Tremendous (gift cards), Algolia (search), AWS Rekognition (image moderation), Branch (referrals), plus optional trust/ops services. *(Full list in `THIRD_PARTY_SERVICES.md`.)*

## 6. Current status (honest snapshot)

- ✅ **Consumer app runs end-to-end** as a demo: reads live data across Explore, venues, reviews, deals, profile, points; onboarding persists a taste profile; account deletion calls the backend.
- ✅ **Owner Portal is live** with real management flows.
- 🟡 **In active development:** several consumer **write/interaction flows** (submit review, create reservation, redeem, follow/favorites, chat send) and the **paid tier** (needs RevenueCat products); some screens still render mock data.
- ⏳ **Not yet store-published** — pending developer accounts + launch third-party keys.
- ⚠️ **Key dependency:** deploy access to the live Firebase project (`zupurb-9580f`) is currently limited and needs resolving to ship backend changes.

## 7. Roadmap (near-term)

1. **Resolve backend deploy access** + finish wiring core write flows (reviews, reservations, redemption).
2. **Partner Phase A** — shared backend foundation (roles, claims, bookings), then the **Entertainer** app, then Vendor, Brand, and the in-app Creator program.
3. **Launch readiness** — provision store & third-party accounts, wire the paid tier, submit to the App Store & Google Play.

---

*Companion documents: `PARTNER_ROLES_PLAN`, `PARTNER_ROLES_SOW`, `PARTNER_ROLES_SPEC`, `THIRD_PARTY_SERVICES`, `FEATURE_INVENTORY` (all in `/docs`).*
