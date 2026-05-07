// T4 — E2E test mock data.
// Shared constants used across all patrol_test files.
//
// Firebase Phone Auth test credentials:
//   Phone:  +1 650-555-3434  (whitelisted in Firebase Auth console)
//   OTP:    123456            (fixed code for test phone)
//
// These values must match the entries in the Firebase Emulator / Auth console
// test phone number list.  Never use production phone numbers in E2E tests.

/// Firebase Auth test phone number (E.164 format, no spaces).
const String kTestPhone = '+16505553434';

/// Firebase Auth fixed OTP for [kTestPhone].
const String kTestOtp = '123456';

/// Pre-existing test account email (used for login flow tests).
const String kTestEmail = 'e2e_user@zupurb.test';

/// Password for [kTestEmail].
const String kTestPassword = 'E2eTest!99';

/// Full name used during sign-up flow.
const String kTestFullName = 'E2E Test User';

/// Local part of test email (used to fill the Email field during sign-up).
const String kTestEmailAddress = 'e2e_user+new@zupurb.test';

/// Mock establishment ID used in deep-link / route tests.
/// Must exist as a seeded document in the Firebase Emulator Firestore.
const String kTestEstablishmentId = 'est_social_lounge_001';

/// Display name of the test establishment (matches seeded Firestore doc).
const String kTestEstablishmentName = 'The Social Lounge';

/// A valid time slot text that must exist in the mock slot grid for
/// [kTestEstablishmentId].
const String kTestSlotTime = '7:00 PM';

/// Mock deal name to select on the Redeem Rewards screen.
/// Must match an 'available: true' reward card in mock data / Firestore seed.
const String kTestDealName = 'Morning Pick-me-up';

/// Expected points balance string shown on the Points Wallet screen after the
/// golden path completes.  Update if the seeded balance changes.
const String kTestPointsBalance = '1,847 pts';

/// Deep-link URL scheme for Zupurb (Branch.io configured scheme).
const String kDeepLinkScheme = 'zupurb://';
