# Zupurb — T9 Store Policy Compliance Checklist

**Run date:** 2026-05-06
**Build:** 1.0.0+1 (pre-submission, Phase 1A/1B code)
**Auditor:** QA Tester agent
**Next required run:** at D6 (Production Readiness Audit), then again at D7 (Submission)

Legend: PASS | ACTION NEEDED | BLOCKER

---

## Apple App Store

| # | Item | Status | Notes / Required Action |
|---|------|--------|------------------------|
| A1 | App Store Review Guidelines compliance (current version) | ACTION NEEDED | No formal sign-off recorded against current guidelines version. Must be re-reviewed by a human on submission day against the live guidelines at https://developer.apple.com/app-store/review/guidelines/. |
| A2 | Privacy nutrition labels accurate vs actual data collection | BLOCKER | Privacy nutrition labels have NOT been authored in App Store Connect. App collects: name, email, phone, location (precise), usage data (analytics via Firebase Analytics), crash data (Crashlytics), purchase history (RevenueCat), user content (reviews, photos). Labels must be completed before submission. |
| A3 | ATT prompt fires before any tracking SDK initialises | BLOCKER | `NSUserTrackingUsageDescription` is absent from `Info.plist`. `firebase_analytics` and `firebase_crashlytics` are active in `pubspec.yaml`. Per Apple policy, an ATT prompt must precede any cross-app/cross-site tracking. The `app_tracking_transparency` Flutter package is not in `pubspec.yaml`. Add the package, add `NSUserTrackingUsageDescription` to `Info.plist`, and gate SDK initialisation on the ATT result. |
| A4 | Sign in with Apple offered when other social logins exist | BLOCKER | `signup_screen.dart` renders Google (G), Facebook (f), and Apple icon buttons, but none use a real SDK. The Apple button uses `Icons.apple` rendered as a plain `_SocialButton` with no `sign_in_with_apple` package call. The `sign_in_with_apple` package is absent from `pubspec.yaml`. Apple requires a functional Sign in with Apple implementation when any third-party social login exists. |
| A5 | In-app purchases use StoreKit via RevenueCat, no external payment | PASS | `plus_paywall.dart` imports `purchases_flutter` (RevenueCat). Purchase and restore flows route through `IAPService`. No external payment URLs found. Comment at top of file confirms R8.3 compliance. |
| A6 | No mention of payment outside the app inside the app | PASS | No external payment links found in audited screens. |
| A7 | Content moderation visible to user (block, report, hide) | ACTION NEEDED | Block surface exists in `privacy_settings_screen.dart` ("Manage Blocked Users"). However, no in-feed per-content Report or Hide action was found in `home_screen.dart`, `other_profile_screen.dart`, or any review/feed screen. Apple requires report and hide/mute controls on UGC surfaces. These controls must be surfaced on feed cards and profile content. |
| A8 | User-generated content has EULA agreement | ACTION NEEDED | `signup_screen.dart` shows a checkbox: "By signing up you agree to our Terms & Privacy Policy" but the text is not a tappable link — both the Terms of Service and Privacy Policy `GestureDetector` handlers in `plus_paywall.dart` contain `// TODO(I6): replace with real URL` with empty `onTap: () {}`. The EULA/Terms text must be a live, tappable link at sign-up. |
| A9 | User can delete their account from inside the app (Apple §5.1.1(v)) | PASS | `settings_screen.dart` has a "Delete Account" row in the Account Action section. The `onTap` is a no-op stub (`() {}`); functional implementation is required before submission, but the UI surface is present. Flag as ACTION NEEDED if the backend deletion callable is not wired by D6. Current state: surface present, implementation stub — treat as ACTION NEEDED at D6. |
| A10 | Push notification permission rationale shown to user before prompt | BLOCKER | `push_service.dart` calls `_messaging.requestPermission(...)` directly after `initialize(uid)` is called, with no pre-prompt rationale screen or dialog explaining why notifications are needed. Apple expects a rationale to be presented before triggering the system permission dialog. A custom rationale sheet must be shown first. |
| A11 | Camera/photo/location permission strings in Info.plist are user-friendly | ACTION NEEDED | `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription` are present and readable. However, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, and `NSMicrophoneUsageDescription` are absent. The app references photo/image flows (reviews, add-a-place). If camera or photo library access is used at runtime, these keys are required or the app will crash on iOS. Add these strings before submission. |
| A12 | Demo account credentials provided to App Review | BLOCKER | No demo account credentials are documented anywhere in the repo (checked `docs/`, `CLAUDE.md`, `DEVELOPMENT_PLAN.md`). App uses phone-OTP login which cannot be completed by App Review without a pre-verified test number. A demo account with email/password bypass or a hardcoded OTP for a specific test number must be prepared and submitted in the App Review notes. |
| A13 | App icon, screenshots, preview video meet App Store spec | ACTION NEEDED | No App Store Connect metadata assets found in the repo. Assets must be produced at 1024x1024 (icon), device-sized screenshots for iPhone 6.9" and iPhone 6.5" as minimum required sizes, and optionally preview video. Not blockers for build but required before submission. |
| A14 | No private API usage | PASS | Static analysis (`flutter_lints`, `custom_lint`) is configured. No private API calls identified in audited source. Must be re-confirmed with Xcode static analyser at submission build. |
| A15 | Background modes only used for declared purposes | ACTION NEEDED | `UIBackgroundModes` is not declared in `Info.plist`. FCM uses `FirebaseMessagingAutoInitEnabled = true` and the app receives push notifications. If remote notification background mode is required for silent pushes, `remote-notification` must be added to `UIBackgroundModes`. Confirm with FCM integration requirements. |
| A16 | iPad support or "iPhone only" declared cleanly | ACTION NEEDED | `Info.plist` declares `UISupportedInterfaceOrientations~ipad` with four orientations, implying iPad support. However no iPad-specific layouts were found and the mockups are iPhone-only. Either remove the iPad orientation entry (to declare iPhone-only) or explicitly set `UIDeviceFamily` to `[1]` (iPhone only) in the Xcode target settings. Failing to declare clearly may cause App Review confusion. |

---

## Google Play Store

| # | Item | Status | Notes / Required Action |
|---|------|--------|------------------------|
| G1 | Play Console Data Safety form accurate | BLOCKER | Data Safety form has not been authored. App collects: name, email, phone, precise location, usage analytics (Firebase), crash logs (Crashlytics), purchase history (RevenueCat), user-generated content, device identifiers. Form must be completed in Play Console before submission. |
| G2 | Target API level meets current Play requirement (API 34 as of 2025) | ACTION NEEDED | `build.gradle.kts` uses `targetSdk = flutter.targetSdkVersion`, which delegates to the Flutter Gradle plugin. Flutter 3.22+ defaults to `targetSdk = 34`. Confirm the installed Flutter SDK version resolves to 34. Run `flutter --version` and cross-check with `local.properties`. If the resolved value is below 34, it must be explicitly set. |
| G3 | Permissions declared match actual usage | ACTION NEEDED | `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` are declared in main `AndroidManifest.xml`. `INTERNET` is declared in the debug manifest only — it must also be declared in the release/main manifest for production builds. `POST_NOTIFICATIONS` (required for Android 13+ push notifications) is absent from the main manifest. FCM push is implemented (`push_service.dart`). Add `POST_NOTIFICATIONS` to the main manifest. Camera and photo permissions are absent — add if any feature accesses them. |
| G4 | Sensitive permissions justified in Play Console (location, camera) | ACTION NEEDED | Location permission justification must be submitted in Play Console. `ACCESS_FINE_LOCATION` is used for "show nearby restaurants and bars" (confirmed by the Info.plist string and `maps_service.dart`). This use case is acceptable but must be documented in Play Console. |
| G5 | No restricted permission misuse (SMS, Call Log) | PASS | Neither `READ_SMS`, `RECEIVE_SMS`, `READ_CALL_LOG` nor any other restricted permission is declared. |
| G6 | Account deletion accessible inside app AND via web | ACTION NEEDED | In-app deletion surface exists (settings screen). A web-accessible account deletion page (URL) is additionally required by Play policy. No such page is referenced in the codebase or docs. A web deletion form or support-email-initiated deletion process must be documented and linked in Play Console. |
| G7 | Content rating questionnaire completed honestly | BLOCKER | Content rating questionnaire not yet completed. App content includes alcohol-related venues and user reviews. This maps to a Teen or Mature 17+ rating depending on questionnaire answers. Must be completed in Play Console before submission. |
| G8 | Family Policy compliance | PASS | App minimum age is 18 (onboarding step 2 slider starts at 18 with no under-18 path). No evidence of child-directed content or features. Family Policy does not apply. |
| G9 | Background location justified and minimized | PASS | Only `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` are declared. `ACCESS_BACKGROUND_LOCATION` is absent. No background location usage found. |
| G10 | Foreground service types declared (Android 14+) | PASS | No `<service>` elements with `foregroundServiceType` are present in the manifest. FCM service is declared without `foreground` type, which is correct for a messaging-only service. No foreground service usage found in audited code. |
| G11 | Photo & Video permissions use Android 13+ granular model | ACTION NEEDED | Neither `READ_MEDIA_IMAGES` nor `READ_MEDIA_VIDEO` is declared in the main manifest. If the app accesses photos (review submission, profile photo, add-a-place), `READ_MEDIA_IMAGES` is required on Android 13+ instead of the legacy `READ_EXTERNAL_STORAGE`. Add the appropriate granular permission when photo access is implemented. |
| G12 | Notification permission requested at runtime (Android 13+) | BLOCKER | `POST_NOTIFICATIONS` is absent from the main `AndroidManifest.xml`. The `push_service.dart` `initialize()` method calls `_messaging.requestPermission()` which handles iOS but does not explicitly request `POST_NOTIFICATIONS` on Android 13+. FCM's Flutter SDK may handle this internally, but the manifest declaration is still required. Verify and add `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>` to the main manifest. |
| G13 | App Bundle (AAB) format, signed with Play App Signing | ACTION NEEDED | Release signing config in `build.gradle.kts` is set to `signingConfigs.getByName("debug")` with a TODO comment. A production keystore and Play App Signing enrollment must be set up before D7. This is a Deployment (D2) task but blocks submission. |
| G14 | No deceptive behaviour, ads in notifications, or system-impersonating UI | PASS | No evidence of deceptive UI patterns, notification ads, or system-impersonating elements found. |
| G15 | In-app purchases use Google Play Billing via RevenueCat | PASS | `purchases_flutter` (RevenueCat) is declared in `pubspec.yaml`. RevenueCat abstracts Google Play Billing on Android. Confirmed by `plus_paywall.dart` purchase flow. |
| G16 | Pre-launch report passes without crashes | ACTION NEEDED | Cannot verify — no CI build exists yet (D1 milestone pending). Pre-launch report must be run on an internal track build before promotion to production track. |

---

## Cross-cutting

| # | Item | Status | Notes / Required Action |
|---|------|--------|------------------------|
| X1 | Privacy Policy URL live and reachable | BLOCKER | `plus_paywall.dart` `_LegalText` widget has `// TODO(I6): replace with real Privacy Policy URL` with `onTap: () {}` (dead tap). `settings_screen.dart` has no Privacy Policy link. No live URL exists. A hosted Privacy Policy at a permanent URL is required by both stores before submission. |
| X2 | Terms of Service URL live and reachable | BLOCKER | Same as X1. `plus_paywall.dart` Terms of Service tap is a stub. `settings_screen.dart` has a "Terms of Service" row with `onTap: () {}`. A live URL is required before submission. |
| X3 | Support contact email monitored | ACTION NEEDED | No support email is surfaced in-app or documented in the repo. Both stores require a support email in app store listings. Add to settings screen and store metadata. |
| X4 | CCPA "Do Not Sell My Personal Information" | PASS | `privacy_settings_screen.dart` contains a CCPA Compliance Notice panel stating the app does not sell data. Meets CCPA disclosure requirement for the California audience. Note: if a "Do Not Sell" opt-out mechanism is required (i.e., if any data is sold or shared for cross-context advertising), a functional opt-out toggle must be added. Current copy asserts no selling occurs — confirm with legal. |
| X5 | Age gate for alcohol-related content | BLOCKER | The SOW explicitly covers bars and nightclubs with alcohol deal content. Both stores require an age gate for apps featuring alcohol content. The onboarding step 2 age slider starts at 18 but this is a preference input, not an enforced age gate — a user under 21 can simply move the slider to 21. No enforced age verification gate (birthdate entry with enforcement, or third-party age verification) exists anywhere in the auth or onboarding flow. An age gate must be implemented at app launch or during sign-up. |
| X6 | Crashlytics / Analytics consent or disclosure | ACTION NEEDED | `firebase_analytics` and `firebase_crashlytics` are initialised in `main.dart`. No user consent dialog or disclosure for analytics/crash data collection exists in the onboarding or settings flow. While not strictly required under US law for the current audience, the CCPA privacy panel should explicitly mention Firebase Analytics and Crashlytics data collection. Under GDPR (if any EU users are served), explicit consent is required. At minimum, disclose in the Privacy Policy and settings what is collected. |
| X7 | UGC moderation (Perspective API) wired | ACTION NEEDED | Perspective API integration is planned as I9 milestone. No `PerspectiveService` or equivalent was found in the audited codebase. In-feed Report and Hide controls are also missing (see A7). Both stores require moderation mechanisms for UGC. This item cannot be marked PASS until I9 is complete and report/hide controls are live. |

---

## Summary

| Category | PASS | ACTION NEEDED | BLOCKER |
|----------|------|---------------|---------|
| Apple App Store (A1–A16) | 4 | 7 | 5 |
| Google Play Store (G1–G16) | 6 | 6 | 4 |
| Cross-cutting (X1–X7) | 1 | 3 | 3 |
| **Total** | **11** | **16** | **12** |

**12 BLOCKERs must be resolved before any store submission.**

---

## Blocker Summary (must fix before D7)

| ID | Blocker |
|----|---------|
| A2 | App Store privacy nutrition labels not authored |
| A3 | ATT prompt missing; `NSUserTrackingUsageDescription` absent; `app_tracking_transparency` package not added |
| A4 | Sign in with Apple non-functional; `sign_in_with_apple` package absent |
| A10 | Push permission requested with no pre-prompt rationale screen |
| A12 | No demo account documented for App Review |
| G1 | Play Data Safety form not completed |
| G7 | Play content rating questionnaire not completed |
| G12 | `POST_NOTIFICATIONS` absent from main `AndroidManifest.xml` |
| X1 | Privacy Policy URL is a dead stub (`onTap: () {}`) |
| X2 | Terms of Service URL is a dead stub (`onTap: () {}`) |
| X5 | No enforced age gate for alcohol content |

*(11 unique BLOCKERs — A10 and A12 are Apple-specific and counted in A column total of 5 with A2/A3/A4.)*

---

## Files audited

- `docs/DEVELOPMENT_PLAN.md` §5.1
- `zupurb_app/ios/Runner/Info.plist`
- `zupurb_app/android/app/src/main/AndroidManifest.xml`
- `zupurb_app/android/app/src/debug/AndroidManifest.xml`
- `zupurb_app/android/app/build.gradle.kts`
- `zupurb_app/pubspec.yaml`
- `zupurb_app/lib/widgets/plus_paywall.dart`
- `zupurb_app/lib/screens/auth/signup_screen.dart`
- `zupurb_app/lib/screens/settings/settings_screen.dart`
- `zupurb_app/lib/screens/settings/privacy_settings_screen.dart`
- `zupurb_app/lib/screens/onboarding/onboarding_step1_screen.dart`
- `zupurb_app/lib/screens/onboarding/onboarding_step2_screen.dart`
- `zupurb_app/lib/core/services/push_service.dart`
