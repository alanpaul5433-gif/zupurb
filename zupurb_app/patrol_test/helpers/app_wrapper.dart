// T4 — E2E app wrapper.
// Launches the Zupurb app in a development/emulator environment so that:
//   - Firebase Auth uses the local emulator (host 10.0.2.2:9099 on Android,
//     localhost:9099 on iOS simulator).
//   - Firestore uses the local emulator (host 10.0.2.2:8080 / localhost:8080).
//   - App Check enforcement is disabled (debug token injected).
//   - Firebase Analytics / Crashlytics are set to test mode (no data sent).
//
// Usage from a patrolTest:
//   await AppWrapper.launch($);
//
// The caller is responsible for calling $.pumpAndSettle() after launch.
//
// Required environment before running:
//   1. Start Firebase emulators:  firebase emulators:start
//   2. Seed Firestore:            node scripts/seed_e2e.js
//   3. Connect device/emulator and run:
//      patrol test --target patrol_test/golden_path_test.dart
//
// Firebase test phone number:  +1 650-555-3434
// Fixed OTP code:              123456
//
// NOTE: APP_ENV is read from --dart-define at patrol invocation:
//   patrol test --dart-define APP_ENV=development ...
// The app reads APP_ENV in firebase_init.dart and routes SDK calls to the
// local emulator when APP_ENV=development.

import 'package:patrol/patrol.dart';
import 'package:zupurb_app/main.dart' as app;

/// Launches the Zupurb app inside a Patrol test environment.
///
/// Call this as the first line of every [patrolTest] body.  It calls
/// [app.main] which initialises Firebase (pointing at the emulator when
/// APP_ENV=development), sets up Riverpod, and pushes the router to /splash.
class AppWrapper {
  AppWrapper._();

  /// Launches the app and waits for the first frame to settle.
  ///
  /// [extraSettle] adds additional settle passes — useful when the splash
  /// screen has a timer-based transition (default 1 extra pass).
  static Future<void> launch(
    PatrolIntegrationTester $, {
    int extraSettle = 1,
  }) async {
    app.main();
    await $.pumpAndSettle();

    for (var i = 0; i < extraSettle; i++) {
      await $.pumpAndSettle();
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  /// Drives from whatever screen is active to /login by tapping the system
  /// back button until the login screen headline is visible, or times out.
  static Future<void> ensureOnLoginScreen(PatrolIntegrationTester $) async {
    const maxBackPresses = 5;
    for (var i = 0; i < maxBackPresses; i++) {
      if ($.tester.any(find.text('Welcome Back'))) return;
      if ($.tester.any(find.text('Sign In'))) return;
      await $.native.pressBack();
      await $.pumpAndSettle();
    }
  }

  /// Navigates to the sign-up screen from the login screen.
  static Future<void> goToSignUp(PatrolIntegrationTester $) async {
    // The login screen has a "Sign up" link at the bottom.
    // Key annotation needed in LoginScreen: Key('login_signup_link')
    final signUpLink = find.text("Sign up");
    final altLink = find.text("Create Account");
    if ($.tester.any(signUpLink)) {
      await $(signUpLink).tap();
    } else if ($.tester.any(altLink)) {
      await $(altLink).tap();
    }
    await $.pumpAndSettle();
  }

  // ---------------------------------------------------------------------------
  // OTP helper
  // ---------------------------------------------------------------------------

  /// Fills the 6-digit OTP input with the test OTP code and taps Verify.
  ///
  /// Expects to be called when PhoneOtpScreen (or OtpScreen) is active.
  /// The OTP widget uses 6 single-character TextFields; each is identified
  /// by Key('otp_field_N') where N is 0–5.
  ///
  /// Key annotations needed in PhoneOtpScreen / OtpScreen:
  ///   Key('otp_field_0') … Key('otp_field_5')
  ///   Key('otp_verify_button')
  static Future<void> enterOtp(
    PatrolIntegrationTester $, {
    String code = '123456',
  }) async {
    assert(code.length == 6, 'OTP code must be exactly 6 digits');

    // Prefer Key-based finders; fall back to positional TextField scan.
    bool usedKeys = false;
    for (var i = 0; i < 6; i++) {
      final keyFinder = find.byKey(Key('otp_field_$i'));
      if ($.tester.any(keyFinder)) {
        await $(keyFinder).enterText(code[i]);
        usedKeys = true;
      }
    }

    if (!usedKeys) {
      // Fallback: find TextFields with maxLength == 1 (OTP box pattern).
      final fields = find.byWidgetPredicate(
        (w) => w is TextField && w.maxLength == 1,
      );
      for (var i = 0; i < 6; i++) {
        await $(fields.at(i)).enterText(code[i]);
        await $.pumpAndSettle();
      }
    }

    await $.pumpAndSettle();

    // Tap verify button — Key('otp_verify_button') or text match.
    final verifyKey = find.byKey(const Key('otp_verify_button'));
    if ($.tester.any(verifyKey)) {
      await $(verifyKey).tap();
    } else {
      await $(find.text('Verify & Continue')).tap();
    }
    await $.pumpAndSettle();
  }
}
