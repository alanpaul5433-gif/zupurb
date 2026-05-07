# Zupurb Beta — Tester Onboarding Guide

Welcome to the Zupurb beta program. This guide gets you set up and tells you what to test and what to avoid.

---

## 1. Installing the App

### iOS — TestFlight

1. On your iPhone, open the App Store and install **TestFlight** (free, by Apple).
2. Tap the invitation link: **https://testflight.apple.com/join/PLACEHOLDER**  
   _(Replace this placeholder with the live invite link before distributing this guide.)_
3. TestFlight opens automatically. Tap **Accept** then **Install**.
4. The Zupurb app installs. An orange dot on the icon means you are running a beta build.
5. Updates arrive automatically when new beta builds are published. TestFlight will notify you.

**Requirements:** iOS 16.0 or later. iPhone 12 or newer recommended.

---

### Android — Google Play Internal Testing

1. You need to be invited by email to the Internal Testing track. Contact the Zupurb team with the Gmail address you want to use.
2. Once invited, open this link on your Android device: **https://play.google.com/apps/internaltest/PLACEHOLDER**  
   _(Replace placeholder with the Play Internal Testing opt-in URL from Play Console.)_
3. Tap **Become a tester**, then tap the link to download the app from the Play Store.
4. The app installs normally. Updates appear in the Play Store as they are published.

**Requirements:** Android 8.0 (API 26) or later.

---

## 2. Test Account Credentials

Use the credentials below to log in. Do not use your personal Apple ID or Google account for testing.

| Field    | Value |
|----------|-------|
| Email    | beta-tester@zupurb-test.com _(placeholder — replace before distribution)_ |
| Password | ZupurbBeta2026! _(placeholder — replace before distribution)_ |
| Notes    | This account has a seeded points balance and one completed review. Use it freely. |

Alternatively, create a new account using your own email address. This is encouraged for testing the sign-up flow (ON-2 through ON-5 in the test scenarios).

**IAP sandbox accounts (for subscription testing):**  
- iOS: Use an Apple Sandbox Tester account. Create one at https://appstoreconnect.apple.com > Users and Access > Sandbox Testers.
- Android: Your real Google account is automatically a test account on the Internal Testing track for in-app purchases.

---

## 3. What to Test

Please work through the test scenarios in `docs/BETA_TESTING_PLAN.md`. The highest-priority flows are:

1. Sign-up and onboarding (fresh install)
2. Search for a venue and open its detail page
3. Submit a review (with and without a receipt photo)
4. Book a reservation and check in
5. View and redeem points
6. Subscribe to Plus (sandbox only)
7. Send a message to another user

You do not need to complete every scenario in one session. Focus on the areas most relevant to your device and usage patterns.

---

## 4. Known Limitations in This Beta

The following are known gaps in the current beta build. Do not file bugs for these items.

| Area | Limitation |
|------|------------|
| Receipt OCR | Accuracy on non-standard receipts is being tuned; some receipts may fail to verify |
| Gift card redemption | Sandbox mode only — no real gift cards are issued |
| Loyalty tiers | UI placeholder shown; tier logic not yet active |
| Localization | English only; placeholder strings may appear in some screens |
| Chat read receipts | Not yet implemented |
| Referral dashboard | UI scaffold only; points attribution in development |
| Push notifications | May arrive with a delay of up to 60 seconds on some devices |

If you are unsure whether something is a known limitation, go ahead and report it anyway.

---

## 5. How to Report Bugs

### Crashes (automatic)

Zupurb uses Firebase Crashlytics. If the app crashes, the crash report is sent automatically. You do not need to do anything extra for crashes — just note what you were doing when it happened in case the team follows up.

### Manual bug reports

Use the feedback form: **https://forms.gle/PLACEHOLDER**  
_(Replace placeholder with the live Google Form URL before distributing this guide.)_

Please include:
- Your device model and OS version (e.g., iPhone 15 Pro, iOS 17.4)
- App version (tap the app icon long-press > App Info on Android, or check TestFlight > Zupurb > Version on iOS)
- What you were doing when the bug occurred
- Steps to reproduce if possible
- A screenshot or screen recording if it helps

**Severity guidance when filling the form:**
- Blocker — app crashes, data is wrong, you cannot complete a core action
- Significant — feature is broken but you can work around it
- Minor — visual glitch, typo, or small UX annoyance

---

## 6. What NOT to Test

**Do not test real payments.** All in-app purchases in the beta build are wired to Apple Sandbox and Google Play test billing environments. Real money will not be charged. Do not attempt to use real payment methods outside the sandbox.

**Do not test real gift card redemption.** The gift card flow is in sandbox mode. No real gift cards will be issued.

**Do not attempt to stress-test or load-test the backend.** This is a beta, not a performance test. The staging backend has rate limits in place.

**Do not share your test account credentials** with anyone outside the beta program.

**Do not publish screenshots or recordings of unreleased features** on social media or public channels. The beta is confidential until the app launches.

---

## 7. Accessibility Testing

If you use assistive technology (VoiceOver on iOS, TalkBack on Android, or large text sizes), your feedback is especially valuable. Please test with your normal accessibility settings enabled and report anything that is difficult to use or read.

---

## 8. Contact

Questions about the beta program: **alanpaul5433@gmail.com**  
Crashlytics crash dashboard: Firebase Console > Zupurb (staging) project  
Bug register: `C:\Projects\Zupurb\docs\FIX_LIST.md` (internal team only)

Thank you for helping make Zupurb better.
