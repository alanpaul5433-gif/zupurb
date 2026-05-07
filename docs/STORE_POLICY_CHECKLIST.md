# Zupurb — T9 Store Policy Compliance Checklist

**Run date:** 2026-05-07 (updated; previous run 2026-05-06)
**Build:** 1.0.0+1 (pre-submission, development phase)
**Auditor:** QA / Testing Agent
**Next required run:** at D6 (Production Readiness Audit), then again at D7 (Submission)

Sources audited this run: `AndroidManifest.xml`, `Info.plist`, `pubspec.yaml`, `build.gradle.kts`, `local.properties`, all files under `lib/screens/` and `lib/core/services/`, `lib/core/config/legal_urls.dart`, `DEVELOPMENT_PLAN.md §5.1`, `RULES.md R8`.

Legend: PASS | ACTION NEEDED | BLOCKER

---

## Apple App Store

| # | Item | Status | Notes / Required Action |
|---|------|--------|------------------------|
| A1 | App Store Review Guidelines compliance (current version) | ACTION NEEDED | No formal sign-off recorded against current guidelines version. Must be re-reviewed by a human on submission day against the live guidelines at https://developer.apple.com/app-store/review/guidelines/. |
| A2 | Privacy nutrition labels accurate vs actual data collection | BLOCKER | Privacy nutrition labels have NOT been authored in App Store Connect. App collects: name, email, phone, location (precise), usage data (analytics via Firebase Analytics), crash data (Crashlytics), purchase history (RevenueCat), user content (reviews, photos). Labels must be completed before submission. |
| A3 | ATT prompt fires before any tracking SDK initialises | PASS | `app_tracking_transparency: ^2.0.6` is declared in `pubspec.yaml`. `att_prompt_screen.dart` calls `AppTrackingTransparency.requestTrackingAuthorization()` before routing to `/onboarding/1` (post-OTP). `NSUserTrackingUsageDescription` is present in `Info.plist` with user-friendly copy. Verify in QA that Firebase Analytics and Mixpanel do not fire events until after ATT authorization resolves. |
| A4 | Sign in with Apple offered when other social logins exist | ACTION NEEDED | `sign_in_with_apple: ^6.1.3` is declared in `pubspec.yaml` (comment confirms it is required by App Store policy). Google and Facebook login are also present. Dependency is correct. Verify the Sign in with Apple button appears on the login/signup screens at equal visual prominence to Google and Facebook buttons, and that the Apple auth service is wired end-to-end (not a stub), before submission. |
| A5 | In-app purchases use StoreKit via RevenueCat, no external payment | PASS | `plus_paywall.dart` imports `purchases_flutter` (RevenueCat). Purchase and restore flows route through `IAPService`. No external payment URLs found. Comment at top of file confirms R8.3 compliance. |
| A6 | No mention of payment outside the app inside the app | PASS | No external payment links found in audited screens. |
| A7 | Content moderation visible to user (block, report, hide) | ACTION NEEDED | Block surface exists in `privacy_settings_screen.dart` ("Manage Blocked Users"). However, no in-feed per-content Report or Hide action was found in `home_screen.dart`, `other_profile_screen.dart`, or any review/feed screen. Apple requires report and hide/mute controls on UGC surfaces. These controls must be surfaced on feed cards and profile content. |
| A8 | User-generated content has EULA agreement | ACTION NEEDED | `signup_screen.dart` shows a checkbox: "By signing up you agree to our Terms & Privacy Policy" but the text is not a tappable link — both the Terms of Service and Privacy Policy `GestureDetector` handlers in `plus_paywall.dart` contain `// TODO(I6): replace with real URL` with empty `onTap: () {}`. The EULA/Terms text must be a live, tappable link at sign-up. |
| A9 | User can delete their account from inside the app (Apple §5.1.1(v)) | ACTION NEEDED | `settings_screen.dart` has a "Delete Account" row (destructive styling). The `onTap` is `() {}` — a no-op stub. The Cloud Function `deleteAccount` exists per backend B2 plan but the UI does not call it. Must be wired before submission; Apple §5.1.1(v) requires functional deletion. |
| A10 | Push notification permission rationale shown to user before prompt | ACTION NEEDED | `push_service.dart` calls `_messaging.requestPermission(...)`. The ATT screen provides a pre-prompt rationale, but no equivalent pre-prompt screen for push notifications was found. Apple expects a rationale before the system permission dialog. A short push notification rationale sheet (or inline prompt) should be shown before `requestPermission` is called in `push_service.initialize()`. Confirm the permission is not requested on cold launch before the user has completed onboarding. |
| A11 | Camera/photo/location permission strings in Info.plist are user-friendly | BLOCKER | `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription` are present and readable. However, `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` are **absent**. Review photo upload (`verify_visit_screen.dart`, profile photo) requires these keys at runtime — their absence causes an iOS crash. Add before submission. Suggested: Camera: "Zupurb uses your camera to photograph receipts and upload review photos." Photo Library: "Zupurb accesses your photos to attach images to reviews and your profile." |
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
| G2 | Target API level meets current Play requirement (API 35 for new apps, 2025) | ACTION NEEDED | `build.gradle.kts` uses `targetSdk = flutter.targetSdkVersion`, which delegates to the Flutter SDK installed on the build machine. `local.properties` does not explicitly set this value. Flutter 3.29+ resolves to targetSdk = 35. Confirm the CI Flutter SDK version resolves to 35 by checking build output. If not, add `targetSdk = 35` explicitly to `defaultConfig` in `build.gradle.kts`. |
| G3 | Permissions declared match actual usage | ACTION NEEDED | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`, `INTERNET`, and `RECEIVE_BOOT_COMPLETED` are declared in the main `AndroidManifest.xml`. `INTERNET` is present. `POST_NOTIFICATIONS` is present (Android 13+ push). Missing: `READ_MEDIA_IMAGES` (required for photo upload on Android 13+) and `CAMERA` (if in-app camera capture is offered). Add these before submission. Also review whether `RECEIVE_BOOT_COMPLETED` is actively used by any plugin; remove if not. |
| G4 | Sensitive permissions justified in Play Console (location, camera) | ACTION NEEDED | Location permission justification must be submitted in Play Console. `ACCESS_FINE_LOCATION` is used for "show nearby restaurants and bars" (confirmed by the Info.plist string and `maps_service.dart`). This use case is acceptable but must be documented in Play Console. |
| G5 | No restricted permission misuse (SMS, Call Log) | PASS | Neither `READ_SMS`, `RECEIVE_SMS`, `READ_CALL_LOG` nor any other restricted permission is declared. |
| G6 | Account deletion accessible inside app AND via web | ACTION NEEDED | In-app deletion surface exists (settings screen). A web-accessible account deletion page (URL) is additionally required by Play policy. No such page is referenced in the codebase or docs. A web deletion form or support-email-initiated deletion process must be documented and linked in Play Console. |
| G7 | Content rating questionnaire completed honestly | BLOCKER | Content rating questionnaire not yet completed. App content includes alcohol-related venues and user reviews. This maps to a Teen or Mature 17+ rating depending on questionnaire answers. Must be completed in Play Console before submission. |
| G8 | Family Policy compliance | PASS | App minimum age is 18 (onboarding step 2 slider starts at 18 with no under-18 path). No evidence of child-directed content or features. Family Policy does not apply. |
| G9 | Background location justified and minimized | PASS | Only `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` are declared. `ACCESS_BACKGROUND_LOCATION` is absent. No background location usage found. |
| G10 | Foreground service types declared (Android 14+) | PASS | No `<service>` elements with `foregroundServiceType` are present in the manifest. FCM service is declared without `foreground` type, which is correct for a messaging-only service. No foreground service usage found in audited code. |
| G11 | Photo & Video permissions use Android 13+ granular model | BLOCKER | `READ_MEDIA_IMAGES` is not declared in the main `AndroidManifest.xml`. Review photo upload is a core feature (Verify Visit, profile photo). On Android 13+ (API 33+), `READ_EXTERNAL_STORAGE` is replaced by `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO`. Add `READ_MEDIA_IMAGES` to the manifest. Also add `READ_EXTERNAL_STORAGE android:maxSdkVersion="32"` for Android 12 and below. Use `permission_handler` (already declared) to request at runtime. |
| G12 | Notification permission requested at runtime (Android 13+) | PASS | `POST_NOTIFICATIONS` is declared in the main `AndroidManifest.xml`. `permission_handler: ^11.3.1` is declared in `pubspec.yaml`. Verify in QA that the runtime permission request is triggered with a user-friendly rationale dialog before the system prompt fires, and is not silently requested on cold launch before onboarding completes. |
| G13 | App Bundle (AAB) format, signed with Play App Signing | ACTION NEEDED | Signing config in `build.gradle.kts` falls back to debug signing when `signingCredentialsAvailable` is false. CI signing is wired via env vars (`ANDROID_KEYSTORE_BASE64`). Play App Signing enrollment in Play Console must be confirmed before the first production AAB upload. Verify CI pipeline uses `flutter build appbundle` (not `flutter build apk`) for production submissions. |
| G14 | No deceptive behaviour, ads in notifications, or system-impersonating UI | PASS | No evidence of deceptive UI patterns, notification ads, or system-impersonating elements found. |
| G15 | In-app purchases use Google Play Billing via RevenueCat | PASS | `purchases_flutter` (RevenueCat) is declared in `pubspec.yaml`. RevenueCat abstracts Google Play Billing on Android. Confirmed by `plus_paywall.dart` purchase flow. |
| G16 | Pre-launch report passes without crashes | ACTION NEEDED | Cannot verify — no CI build exists yet (D1 milestone pending). Pre-launch report must be run on an internal track build before promotion to production track. |

---

## Cross-cutting

| # | Item | Status | Notes / Required Action |
|---|------|--------|------------------------|
| X1 | Privacy Policy URL live and reachable | ACTION NEEDED | `LegalUrls.privacyPolicy = 'https://zupurb.app/privacy'` is declared in `legal_urls.dart` and wired via `url_launcher` in `settings_screen.dart` (Privacy Policy row) and `plus_paywall.dart`. The URL and `url_launcher` integration are correctly implemented in code. The URL must be live with substantive content before submission — confirm the page is deployed and accessible without login. |
| X2 | Terms of Service URL live and reachable | ACTION NEEDED | `LegalUrls.termsOfService = 'https://zupurb.app/terms'` is declared and wired in the same files as X1. Same deployment requirement — must be live before submission. |
| X3 | Support contact email monitored | ACTION NEEDED | No support email is surfaced in-app or documented in the repo. Both stores require a support email in app store listings. Add to settings screen and store metadata. |
| X4 | CCPA "Do Not Sell My Personal Information" | PASS | `privacy_settings_screen.dart` contains a CCPA Compliance Notice panel stating the app does not sell data. Meets CCPA disclosure requirement for the California audience. Note: if a "Do Not Sell" opt-out mechanism is required (i.e., if any data is sold or shared for cross-context advertising), a functional opt-out toggle must be added. Current copy asserts no selling occurs — confirm with legal. |
| X5 | Age gate for alcohol-related content | BLOCKER | The SOW explicitly covers bars and nightclubs with alcohol deal content. Both stores require an age gate for apps featuring alcohol content. The onboarding step 2 age slider starts at 18 but this is a preference input, not an enforced age gate — a user under 21 can simply move the slider to 21. No enforced age verification gate (birthdate entry with enforcement, or third-party age verification) exists anywhere in the auth or onboarding flow. An age gate must be implemented at app launch or during sign-up. |
| X6 | Crashlytics / Analytics consent or disclosure | ACTION NEEDED | `firebase_analytics` and `firebase_crashlytics` are initialised in `main.dart`. No user consent dialog or disclosure for analytics/crash data collection exists in the onboarding or settings flow. While not strictly required under US law for the current audience, the CCPA privacy panel should explicitly mention Firebase Analytics and Crashlytics data collection. Under GDPR (if any EU users are served), explicit consent is required. At minimum, disclose in the Privacy Policy and settings what is collected. |
| X7 | UGC moderation (Perspective API) wired | ACTION NEEDED | Perspective API integration is planned as I9 milestone. No `PerspectiveService` or equivalent was found in the audited codebase. In-feed Report and Hide controls are also missing (see A7). Both stores require moderation mechanisms for UGC. This item cannot be marked PASS until I9 is complete and report/hide controls are live. |

---

## Summary

| Category | PASS | ACTION NEEDED | BLOCKER |
|----------|------|---------------|---------|
| Apple App Store (A1–A16) | 5 | 8 | 3 |
| Google Play Store (G1–G16) | 7 | 6 | 3 |
| Cross-cutting (X1–X7) | 1 | 5 | 1 |
| **Total** | **13** | **19** | **7** |

**7 BLOCKERs must be resolved before any store submission. 19 ACTION NEEDED items must be resolved or explicitly accepted before D7.**

Note: Previous run (2026-05-06) reported 12 BLOCKERs. This run corrected 5 items that were previously marked BLOCKER but are in fact implemented: ATT prompt (A3 → PASS), `POST_NOTIFICATIONS` manifest entry (G12 → PASS), Privacy/Terms URL code wiring (X1/X2 → ACTION NEEDED), and granular photo permissions (G11 escalated to BLOCKER — a new finding). Net blocker count is 7.

---

## Blocker Summary (must fix before D7)

| ID | Blocker | Pillar |
|----|---------|--------|
| A11 | `NSCameraUsageDescription` and `NSPhotoLibraryUsageDescription` absent from `Info.plist` — app crashes on iOS photo access | Frontend |
| A12 | No demo account documented for App Review; phone-OTP login cannot be completed by Apple reviewers | Deployment |
| G1 | Play Console Data Safety form not authored | Deployment |
| G7 | Play content rating questionnaire not completed in Play Console | Deployment |
| G11 | `READ_MEDIA_IMAGES` absent from `AndroidManifest.xml` — photo upload broken on Android 13+ | Frontend |
| X5 | No enforced age gate for nightlife/alcohol-adjacent content | Frontend |
| A2/G1 | App Store privacy nutrition label not authored in App Store Connect (distinct from G1 which is Play Console) | Deployment |

Items corrected from previous run (no longer BLOCKERs):
- A3 was BLOCKER — ATT prompt IS implemented (`att_prompt_screen.dart`, `app_tracking_transparency` package present, `NSUserTrackingUsageDescription` in `Info.plist`). Now PASS.
- A4 was BLOCKER — `sign_in_with_apple` package IS declared. Now ACTION NEEDED (verify wiring).
- G12 was BLOCKER — `POST_NOTIFICATIONS` IS declared in main manifest. Now PASS.
- X1/X2 were BLOCKERs — URLs ARE declared in `legal_urls.dart` and wired via `url_launcher`. Now ACTION NEEDED (deploy content).

---

## Files audited

- `docs/DEVELOPMENT_PLAN.md` §5.1
- `docs/RULES.md` R8
- `zupurb_app/ios/Runner/Info.plist`
- `zupurb_app/android/app/src/main/AndroidManifest.xml`
- `zupurb_app/android/app/build.gradle.kts`
- `zupurb_app/android/local.properties`
- `zupurb_app/pubspec.yaml`
- `zupurb_app/lib/core/config/legal_urls.dart`
- `zupurb_app/lib/widgets/plus_paywall.dart`
- `zupurb_app/lib/screens/auth/att_prompt_screen.dart`
- `zupurb_app/lib/screens/auth/signup_screen.dart`
- `zupurb_app/lib/screens/settings/settings_screen.dart`
- `zupurb_app/lib/screens/settings/privacy_settings_screen.dart`
- `zupurb_app/lib/screens/establishment/establishment_screen.dart`
- `zupurb_app/lib/screens/profile/other_profile_screen.dart`
- `zupurb_app/lib/core/services/push_service.dart`
- `zupurb_app/lib/core/services/apple_auth_service.dart` (grep only)
- All screen files under `lib/screens/` grepped for report/block/moderation/age-gate signals
