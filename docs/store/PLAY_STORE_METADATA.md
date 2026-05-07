# Play Store Metadata — Zupurb (Android)

> Milestone: D3
> Last updated: 2026-05-07
> Status: Draft — pending screenshots, Privacy Policy live URL, Data Safety form, and T9 gate before submission

---

## Listing Fields

| Field | Value | Limit | Status |
|---|---|---|---|
| App Name | Zupurb | 30 chars | OK (6 chars) |
| Short Description | Discover restaurants & nightlife. Earn points. Book reservations. | 80 chars | OK (65 chars) |
| Package Name | com.zupurb.app | — | Confirm with dev |
| Category | Food & Drink | — | Set |
| Content Rating | Teen | — | Alcohol references — run IARC questionnaire in Play Console |
| Email | support@zupurb.com | Required | Placeholder — must be monitored before submission |
| Privacy Policy URL | https://zupurb.com/privacy | Required | PLACEHOLDER — must be live before submission |
| Tags | restaurant, food, dining, nightlife, rewards, reservations | Up to 5 | Set |

---

## Full Description (4000-char limit)

```
Zupurb is your go-to app for discovering the best restaurants, bars, and entertainment venues in your city. Find great places, verify your visits, earn loyalty points, and book reservations — all in one beautifully simple experience.

DISCOVER YOUR CITY
Explore thousands of dining and nightlife venues filtered by cuisine type, distance, price, vibe, and your personal taste profile. Curated rails surface trending spots, hidden gems, and editor picks near you.

EARN REAL REWARDS
Every verified check-in earns you Zupurb loyalty points. Write a review, upload a photo, complete a challenge, or refer a friend — your engagement compounds into points you can actually spend. Points are yours to keep as long as your account stays active.

REDEEM FOR WHAT YOU WANT
Swap your points for gift cards, exclusive partner discounts, and priority access perks. No minimum thresholds, no blackout windows. Rewards that feel worth earning.

TRUST THE REVIEWS
Zupurb's Universal Authenticity Rating (UAR) system flags suspicious review patterns and rewards honest, verified voices. Every review carries a trust score. Only users who check in via QR code or OTP earn verified reviewer status — keeping the feed clean and credible.

BOOK IN SECONDS
Browse real-time availability and confirm your reservation instantly. No phone calls, no uncertainty. Manage all upcoming bookings from a single dashboard. Check in on arrival via QR scan or one-time code.

BADGES AND CHALLENGES
Earn milestone badges for your dining achievements: first review, neighborhood champion, verified check-in streaks, and more. The Founder Badge is limited to the first 150 members — a permanent mark of early loyalty.

ZUPURB PLUS MEMBERSHIP
Upgrade to Zupurb Plus for an elevated experience: early booking windows at popular venues, exclusive member-only deals, accelerated point multipliers, and premium discovery filters. Billed monthly or annually through Google Play — cancel anytime.

SOCIAL DISCOVERY
Follow local food creators and trusted reviewers. See what your network is dining on tonight. Share your own experiences with photos, ratings, and written reviews that go beyond the star.

A COMMUNITY YOU CAN TRUST
No sponsored placements. No fake ratings. Just a community of real diners building a credible local food guide together.

---
Requires Android 8.0 (API level 26) or higher.
```

Character count target: ~1,900 characters. Remaining budget (~2,100 chars) reserved for localized variants and feature additions.

---

## Tags (Play Store — select up to 5)

1. restaurant
2. food
3. dining
4. nightlife
5. rewards

---

## Play Store Listing Checklist

- [ ] IARC content rating questionnaire completed in Play Console — expected result: Teen (alcohol, tobacco references)
- [ ] Data Safety form completed (see section below)
- [ ] In-App Products created: Zupurb Plus Monthly, Zupurb Plus Annual (billing via Google Play Billing)
- [ ] Internal testing track configured before promoting to closed/open testing
- [ ] Release notes entered for version 1.0.0 (see below)
- [ ] Staged rollout plan set: 5% → 20% → 50% → 100% (see D9 rollout plan)
- [ ] App signing enrolled in Play App Signing (managed by Google)

---

## Release Notes — Version 1.0.0

```
Welcome to Zupurb! Discover great places, earn loyalty points, and share your experiences.
```

---

## Data Safety Form (Google Play)

Complete this in Play Console under "App content > Data safety." Mismatches with actual SDK behavior trigger policy violations.

| Data Type | Collected | Shared | Optional/Required | Purpose |
|---|---|---|---|---|
| Name | Yes | No | Required | Account profile |
| Email address | Yes | No | Required | Authentication, notifications |
| Phone number | Yes | No | Required | OTP verification |
| Photos/videos | Yes | No | Optional | Review photo uploads |
| Location (precise) | Yes | No | Required | Nearby venue discovery |
| Location (coarse) | Yes | No | Required | City-level personalization |
| App interactions | Yes | No | Required | Analytics, personalization |
| Crash logs | Yes | No | Required | Crashlytics, Sentry diagnostics |
| Financial info | No | — | — | IAP handled entirely by Google Play Billing |

Cross-reference against Firebase Analytics, Crashlytics, Sentry, and Google Maps SDK data practices before submitting the form. If any third-party SDK shares data with third parties, it must be declared.

---

## Promotional Graphic Assets Required

| Asset | Dimensions | Notes |
|---|---|---|
| Hi-res icon | 512 x 512 px PNG | No alpha |
| Feature graphic | 1024 x 500 px JPG/PNG | Displayed above screenshots in some layouts |
| Phone screenshots | See SCREENSHOT_SPECS.md | Minimum 2, recommended 8 |
| 7-inch tablet screenshots | See SCREENSHOT_SPECS.md | Optional but recommended |
| 10-inch tablet screenshots | See SCREENSHOT_SPECS.md | Optional but recommended |

---

## Localization Scope (v1.0)

English (U.S.) only at launch.
