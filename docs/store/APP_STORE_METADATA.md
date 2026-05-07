# App Store Metadata — Zupurb (iOS)

> Milestone: D3
> Last updated: 2026-05-07
> Status: Draft — pending screenshots, Privacy Policy live URL, and T9 gate before submission

---

## Listing Fields

| Field | Value | Limit | Status |
|---|---|---|---|
| App Name | Zupurb | 30 chars | OK (6 chars) |
| Subtitle | Discover. Dine. Earn Rewards. | 30 chars | OK (30 chars) |
| Bundle ID | com.zupurb.app | — | Confirm with dev |
| SKU | ZUPURB-001 | — | Placeholder |
| Primary Category | Food & Drink | — | Set |
| Secondary Category | Lifestyle | — | Set |
| Age Rating | 17+ | — | Alcohol/nightlife references |
| Primary Language | English (U.S.) | — | Set |
| Privacy Policy URL | https://zupurb.com/privacy | Required | PLACEHOLDER — must be live before submission |
| Support URL | https://zupurb.com/support | Required | PLACEHOLDER — must be live before submission |
| Marketing URL | https://zupurb.com | Optional | Placeholder |

---

## Description (4000-char limit)

```
Zupurb is your ultimate guide to dining and nightlife in your city. Whether you're hunting for a hidden gem restaurant, planning a night out, or earning rewards for every visit — Zupurb puts it all in one place.

DISCOVER WHAT'S AROUND YOU
Browse thousands of restaurants, bars, lounges, and entertainment venues. Filter by cuisine, distance, price range, vibe, or dietary preferences. Every listing is enriched with real photos, hours, menus, and community reviews.

EARN POINTS ON EVERY VISIT
Every verified check-in and review earns you Zupurb loyalty points. The more you engage — writing detailed reviews, adding photos, completing challenges — the faster your points stack up. Points never expire as long as your account is active.

REDEEM REWARDS THAT MATTER
Turn your points into real value. Redeem for gift cards, exclusive discounts at partner venues, priority reservation access, and more. Your loyalty has never been worth more.

WRITE REVIEWS THAT COUNT
Zupurb's Universal Authenticity Rating (UAR) system rewards honest, detailed reviews. Our anti-fraud engine verifies real visits via check-in QR codes and OTP confirmation, so every review you read is from someone who was actually there.

BOOK RESERVATIONS INSTANTLY
Find availability and confirm your table in seconds — no phone tag, no waiting. Manage all your upcoming reservations in one dashboard. Check in on arrival with a single tap or scan.

COLLECT BADGES AND CLIMB THE RANKS
Earn badges for milestones: first review, 10 verified visits, top reviewer in your neighborhood, and more. The Founder Badge is reserved for the first 150 members to join — are you in?

ZUPURB PLUS — UNLOCK EXCLUSIVE BENEFITS
Upgrade to Zupurb Plus for premium perks: priority booking windows, exclusive venue offers, early access to new features, and elevated point multipliers on every review. Members-only benefits that serious diners love.

TRUST THE COMMUNITY
Every establishment on Zupurb carries a community trust score built from verified reviews. No fake stars, no paid placements. Just honest ratings from real diners who checked in and shared their experience.

JOIN THE ZUPURB COMMUNITY
Follow local food creators, share your dining adventures, and discover what your network is eating tonight. Zupurb is social dining discovery built for people who actually go out.

---
Available on iPhone and iPad. Requires iOS 14.0 or later.
```

Character count target: ~1,800 characters. Remaining budget (~2,200 chars) is reserved for localized versions and future feature additions.

---

## Keywords (100-char limit)

```
restaurant,dining,food,rewards,nightlife,reservations,loyalty,reviews,discover,points,bars,eat
```

Character count: 94 chars (within limit).

Note: Apple keyword field does not accept spaces after commas in some tooling — strip spaces before upload.

---

## What's New (Version 1.0.0)

```
Welcome to Zupurb! Discover great places, earn loyalty points, and share your experiences.
```

---

## Promotional Text (170-char limit, updateable without resubmission)

```
Find your next favorite spot. Earn points. Book a table. Zupurb makes every night out better.
```

---

## App Store Connect Settings Checklist

- [ ] Age Rating questionnaire completed — select 17+ (Frequent/Intense Alcohol, Tobacco, or Drug Use references)
- [ ] Privacy nutrition labels completed (see section below)
- [ ] In-App Purchases listed: Zupurb Plus Monthly, Zupurb Plus Annual
- [ ] Demo account credentials entered (required for Apple Review)
  - Email: review@zupurb.com (placeholder — create before submission)
  - Password: (document in secure vault, not here)
- [ ] App Review notes: "Age gate is present on onboarding. Demo account is pre-verified with sample data."
- [ ] Phased release: Enable 7-day phased release for version 1.0.0

---

## Privacy Nutrition Labels (App Store Connect — Data Used to Track You / Data Linked to You)

Complete this section accurately. Mismatches between declared labels and actual SDK behavior are a common rejection reason.

| Data Type | Collected | Linked to User | Used for Tracking | Notes |
|---|---|---|---|---|
| Name | Yes | Yes | No | Profile display name |
| Email Address | Yes | Yes | No | Auth, transactional email |
| Phone Number | Yes | Yes | No | OTP verification |
| Photos/Videos | Yes | Yes | No | Review photos uploaded by user |
| Location (Precise) | Yes | Yes | No | Nearby venue discovery |
| Location (Coarse) | Yes | Yes | No | City-level personalization |
| User Content (Reviews) | Yes | Yes | No | Core app feature |
| Identifiers (User ID) | Yes | Yes | No | Account linking |
| Usage Data | Yes | Yes | No | Analytics, feature improvement |
| Crash Data | Yes | No | No | Crashlytics, Sentry |
| Payment Info | No | — | — | IAP handled by StoreKit; Zupurb never sees card data |

Review against actual Firebase Analytics, Crashlytics, Sentry, and any ad SDKs before submission. ATT prompt is required if any tracking occurs across apps/sites.

---

## Localization Scope (v1.0)

English (U.S.) only at launch. Localization infrastructure to be added in a future milestone.
