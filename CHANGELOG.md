# Changelog

All notable changes to Zupurb are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-05-06

### Added

#### Frontend — Phase 1A + 1B
- Implemented all screens from Figma mockups (Phase 1A): onboarding, home feed, venue detail, deal cards, leaderboard, profile, rewards, settings, and admin views.
- Applied P0/P1/P2 audit fixes (Phase 1B): corrected scoring labels, missing navigation routes, and accessibility gaps logged in FIX_LIST.md.

#### Backend — B1–B12
- Firestore data models: users, venues, deals, reviews, badges, referrals, leaderboard snapshots.
- Cloud Functions: deal scoring engine, leaderboard recalculation (scheduled), referral attribution, badge award triggers, notification dispatch, account deletion handler.
- App Check enforced on all production callable functions.
- Firestore security rules covering all collections with role-based access.

#### Integrations — I1–I12
- Google Maps SDK + Places Autocomplete for venue discovery.
- OCR pipeline (Google Vision API) for receipt scanning.
- AI deal summarisation (Vertex AI / Gemini).
- RevenueCat IAP/subscription integration (StoreKit + Play Billing).
- FCM push notifications with flutter_local_notifications foreground display.
- Firebase Analytics event tracking + screen tracking.
- Firebase Crashlytics crash and non-fatal error reporting.
- Deep linking: Android App Links + iOS Universal Links with referral code persistence.
- Apple Sign-In (required by App Store alongside Google Sign-In).
- ATT prompt wired before Analytics fires on iOS.
- Privacy Policy and Terms of Service URL launchers.
- Statuspage embed for service health.

#### Testing — T1–T11
- Unit tests for scoring engine, badge logic, referral attribution, and Firestore rule paths.
- Widget tests for all primary screens and navigation flows.
- Integration tests (Patrol) covering critical user journeys: sign-up, deal redemption, leaderboard update.
- T9 store policy compliance checklist: age gate, account deletion, CCPA Do-Not-Sell, IAP policy, privacy labels.
- Crashlytics and Sentry verified receiving test events in staging.

#### Deployment — D1–D9
- **D1** GitHub Actions CI: analyze, test, debug build matrix (Android + iOS).
- **D2** Code signing: Fastlane match (iOS App Store + development), Play App Signing keystore documented.
- **D3** Firebase App Distribution nightly builds from `develop` branch.
- **D4** TestFlight external beta + Play Closed Testing lanes.
- **D5** Staging Firebase project with seeded venue and deal data.
- **D6** Production readiness audit: all T9 gates green, privacy labels accurate, demo account documented.
- **D7** Store submission: Fastlane `deliver` (iOS) + `supply` initial upload (Android).
- **D8** Post-submission monitoring: Crashlytics + Sentry alerting, Statuspage live, PagerDuty on-call rotation, rollback playbook documented.
- **D9** Release management: `bump_version.sh` (semver + build number), `generate_release_notes.sh` (conventional-commit categorisation), `release.yml` GitHub Actions tag-push workflow, Play staged rollout lanes (5/20/50/100%), iOS phased release lane.

---

[1.0.0]: https://github.com/zupurb/zupurb-app/releases/tag/v1.0.0
