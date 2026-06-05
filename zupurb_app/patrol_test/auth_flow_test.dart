// T4 — E2E auth flow tests.
// Run with: patrol test --target patrol_test/auth_flow_test.dart
//
// Prerequisites:
//   1. Firebase emulators running:  firebase emulators:start
//   2. Firestore seeded:            node scripts/seed_e2e.js
//   3. Connected device or emulator (Android API 26+ / iOS 15+)
//   4. patrol_cli installed:        dart pub global activate patrol_cli
//   5. Invoke with APP_ENV override:
//      patrol test \
//        --target patrol_test/auth_flow_test.dart \
//        --dart-define APP_ENV=development
//
// Firebase test credentials:
//   Phone:  +1 650-555-3434  (whitelisted in Firebase Auth console)
//   OTP:    123456
//   Existing account email: e2e_user@zupurb.test / E2eTest!99
//
// Each patrolTest is independent; it launches a fresh app instance and is
// responsible for bringing the UI to the state it needs.
//
// Do NOT run via `flutter test` — Patrol tests require the patrol runner.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';

import 'helpers/app_wrapper.dart';
import 'helpers/mock_data.dart';

void main() {
  // ---------------------------------------------------------------------------
  // Test 1: Sign-up with phone number → OTP → lands on onboarding step 1
  // ---------------------------------------------------------------------------
  patrolTest(
    'Sign-up with phone number → OTP verification → onboarding step 1',
    config: PatrolTesterConfig(
      settleTimeout: const Duration(seconds: 20),
      visibleTimeout: const Duration(seconds: 15),
    ),
    ($) async {
      await AppWrapper.launch($, extraSettle: 2);

      // Splash → Login.
      await $.pumpAndSettle(duration: const Duration(seconds: 4));
      expect(find.text('Welcome Back'), findsOneWidget,
          reason: 'Login screen not found after splash');

      // Navigate to sign-up.
      await AppWrapper.goToSignUp($);
      expect(find.text('Create Your Account'), findsOneWidget,
          reason: 'Sign-up screen headline not found');

      // Fill sign-up form.
      // Key annotations needed in SignUpScreen:
      //   Key('signup_field_name'), Key('signup_field_email'),
      //   Key('signup_field_password'), Key('signup_field_confirm'),
      //   Key('signup_field_phone'), Key('signup_submit_button')
      final nameField = find.byKey(const Key('signup_field_name'));
      if ($.tester.any(nameField)) {
        await $(nameField).enterText(kTestFullName);
      } else {
        await $(find.widgetWithText(TextField, 'Full Name'))
            .enterText(kTestFullName);
      }

      final emailField = find.byKey(const Key('signup_field_email'));
      if ($.tester.any(emailField)) {
        await $(emailField).enterText(kTestEmailAddress);
      } else {
        await $(find.widgetWithText(TextField, 'Email Address'))
            .enterText(kTestEmailAddress);
      }

      final passwordField = find.byKey(const Key('signup_field_password'));
      if ($.tester.any(passwordField)) {
        await $(passwordField).enterText(kTestPassword);
      } else {
        await $(find.widgetWithText(TextField, 'Password'))
            .enterText(kTestPassword);
      }

      final confirmField = find.byKey(const Key('signup_field_confirm'));
      if ($.tester.any(confirmField)) {
        await $(confirmField).enterText(kTestPassword);
      } else {
        await $(find.widgetWithText(TextField, 'Confirm Password'))
            .enterText(kTestPassword);
      }

      final phoneField = find.byKey(const Key('signup_field_phone'));
      if ($.tester.any(phoneField)) {
        await $(phoneField).enterText('6505553434');
      } else {
        await $(find.widgetWithText(TextField, 'Phone Number'))
            .enterText('6505553434');
      }
      await $.pumpAndSettle();

      // Submit form.
      final submitBtn = find.byKey(const Key('signup_submit_button'));
      if ($.tester.any(submitBtn)) {
        await $(submitBtn).tap();
      } else {
        await $(find.text('Create Account')).tap();
      }
      await $.pumpAndSettle();

      // OTP screen.
      expect(find.text('Verify Your Number'), findsOneWidget,
          reason: 'OTP screen not shown after sign-up form submission');

      await AppWrapper.enterOtp($, code: kTestOtp);

      // Handle ATT prompt if on iOS.
      await $.pumpAndSettle();
      if ($.tester.any(find.byKey(const Key('att_continue_button')))) {
        await $(find.byKey(const Key('att_continue_button'))).tap();
        await $.pumpAndSettle();
      }

      // Should land on onboarding step 1.
      expect(find.textContaining('STEP 1'), findsOneWidget,
          reason: 'Onboarding step 1 not shown after OTP verification');
      expect(find.text("Let's Go"), findsOneWidget,
          reason: 'Let\'s Go CTA not found on onboarding step 1');
    },
  );

  // ---------------------------------------------------------------------------
  // Test 2: Login with existing account → lands on home screen
  // ---------------------------------------------------------------------------
  patrolTest(
    'Login with existing account → lands on home feed',
    config: PatrolTesterConfig(
      settleTimeout: const Duration(seconds: 20),
      visibleTimeout: const Duration(seconds: 15),
    ),
    ($) async {
      await AppWrapper.launch($, extraSettle: 2);

      // Splash → Login.
      await $.pumpAndSettle(duration: const Duration(seconds: 4));
      expect(find.text('Welcome Back'), findsOneWidget,
          reason: 'Login screen not found after splash');

      // Fill email / phone and password.
      // Key annotations needed in LoginScreen:
      //   Key('login_field_identifier') — accepts email or phone
      //   Key('login_field_password')
      //   Key('login_submit_button')
      final identifierField = find.byKey(const Key('login_field_identifier'));
      if ($.tester.any(identifierField)) {
        await $(identifierField).enterText(kTestEmail);
      } else {
        // Fallback: first TextField on the screen is the email/phone field.
        await $(find.byType(TextField).first).enterText(kTestEmail);
      }
      await $.pumpAndSettle();

      final passwordField = find.byKey(const Key('login_field_password'));
      if ($.tester.any(passwordField)) {
        await $(passwordField).enterText(kTestPassword);
      } else {
        await $(find.widgetWithText(TextField, 'Password'))
            .enterText(kTestPassword);
      }
      await $.pumpAndSettle();

      final loginBtn = find.byKey(const Key('login_submit_button'));
      if ($.tester.any(loginBtn)) {
        await $(loginBtn).tap();
      } else {
        await $(find.text('Sign In')).tap();
      }
      await $.pumpAndSettle(duration: const Duration(seconds: 5));

      // After successful login the router redirects to /home.
      expect(find.text('All'), findsOneWidget,
          reason: 'Home feed tab row not found after login');
      expect(find.textContaining('Search experiences'), findsOneWidget,
          reason: 'Home feed search hint not found after login');
    },
  );

  // ---------------------------------------------------------------------------
  // Test 3: Forgot password flow
  // Expected: Tapping "Forgot password?" on the login screen navigates to
  //           ForgotPasswordScreen; entering an email and tapping Send shows
  //           the email-sent confirmation screen.
  // ---------------------------------------------------------------------------
  patrolTest(
    'Forgot password flow → email sent confirmation',
    config: PatrolTesterConfig(
      settleTimeout: const Duration(seconds: 20),
      visibleTimeout: const Duration(seconds: 15),
    ),
    ($) async {
      await AppWrapper.launch($, extraSettle: 2);

      // Splash → Login.
      await $.pumpAndSettle(duration: const Duration(seconds: 4));
      expect(find.text('Welcome Back'), findsOneWidget,
          reason: 'Login screen not found after splash');

      // Tap "Forgot password?" link.
      // Key annotation needed in LoginScreen: Key('login_forgot_password_link')
      final forgotLink = find.byKey(const Key('login_forgot_password_link'));
      if ($.tester.any(forgotLink)) {
        await $(forgotLink).tap();
      } else {
        await $(find.text('Forgot password?')).tap();
      }
      await $.pumpAndSettle();

      // ForgotPasswordScreen should now be active.
      // Key annotation needed in ForgotPasswordScreen:
      //   Key('forgot_password_email_field'), Key('forgot_password_send_button')
      expect(find.textContaining('Reset'), findsOneWidget,
          reason: 'ForgotPasswordScreen not found — missing Reset headline');

      final emailInput = find.byKey(const Key('forgot_password_email_field'));
      if ($.tester.any(emailInput)) {
        await $(emailInput).enterText(kTestEmail);
      } else {
        await $(find.widgetWithText(TextField, 'Email Address'))
            .enterText(kTestEmail);
      }
      await $.pumpAndSettle();

      final sendBtn = find.byKey(const Key('forgot_password_send_button'));
      if ($.tester.any(sendBtn)) {
        await $(sendBtn).tap();
      } else {
        await $(find.text('Send Reset Link')).tap();
      }
      await $.pumpAndSettle(duration: const Duration(seconds: 3));

      // EmailSentScreen should appear.
      // Key annotation needed in EmailSentScreen: Key('email_sent_headline')
      expect(
        $.tester.any(find.byKey(const Key('email_sent_headline'))) ||
            $.tester.any(find.textContaining('Check your email')) ||
            $.tester.any(find.textContaining('Email Sent')),
        isTrue,
        reason: 'Email sent confirmation screen not shown after forgot password',
      );
    },
  );

  // ---------------------------------------------------------------------------
  // Test 4: Sign out → lands on sign-up / login screen
  // Expected: Signing out from the settings or profile screen navigates the
  //           user back to /login or /signup (not /home).
  // ---------------------------------------------------------------------------
  patrolTest(
    'Sign out from settings → lands on login screen',
    config: PatrolTesterConfig(
      settleTimeout: const Duration(seconds: 20),
      visibleTimeout: const Duration(seconds: 15),
    ),
    ($) async {
      // This test assumes the app starts with the test account already signed
      // in (Firebase emulator persists auth across sessions within the same
      // test run).  If not authenticated, it logs in first.
      await AppWrapper.launch($, extraSettle: 2);
      await $.pumpAndSettle(duration: const Duration(seconds: 4));

      // If on login screen, log in first.
      if ($.tester.any(find.text('Welcome Back'))) {
        final identifierField =
            find.byKey(const Key('login_field_identifier'));
        if ($.tester.any(identifierField)) {
          await $(identifierField).enterText(kTestEmail);
        } else {
          await $(find.byType(TextField).first).enterText(kTestEmail);
        }

        final passwordField = find.byKey(const Key('login_field_password'));
        if ($.tester.any(passwordField)) {
          await $(passwordField).enterText(kTestPassword);
        } else {
          await $(find.widgetWithText(TextField, 'Password'))
              .enterText(kTestPassword);
        }

        final loginBtn = find.byKey(const Key('login_submit_button'));
        if ($.tester.any(loginBtn)) {
          await $(loginBtn).tap();
        } else {
          await $(find.text('Sign In')).tap();
        }
        await $.pumpAndSettle(duration: const Duration(seconds: 5));
      }

      // Verify we are on /home.
      expect(find.text('All'), findsOneWidget,
          reason: 'Home feed not reached before sign-out test');

      // Navigate to Settings.
      // Key annotation needed in BottomNavBar or MainShell: Key('nav_settings')
      final settingsTab = find.byTooltip('Settings');
      final settingsIcon = find.byKey(const Key('nav_settings'));
      if ($.tester.any(settingsIcon)) {
        await $(settingsIcon).tap();
      } else if ($.tester.any(settingsTab)) {
        await $(settingsTab).tap();
      } else {
        // Navigate via profile tab → settings gear icon.
        final profileTab = find.byTooltip('Profile');
        if ($.tester.any(profileTab)) {
          await $(profileTab).tap();
          await $.pumpAndSettle();
        }
        final settingsGear = find.byIcon(Icons.settings_outlined);
        if ($.tester.any(settingsGear)) {
          await $(settingsGear.first).tap();
          await $.pumpAndSettle();
        }
      }
      await $.pumpAndSettle();

      expect(find.text('Settings'), findsOneWidget,
          reason: 'Settings screen not reached before sign-out');

      // Tap "Sign Out".
      // Key annotation needed in SettingsScreen: Key('settings_sign_out_button')
      final signOutBtn = find.byKey(const Key('settings_sign_out_button'));
      if ($.tester.any(signOutBtn)) {
        await $(signOutBtn).tap();
      } else {
        await $(find.text('Sign Out')).tap();
      }
      await $.pumpAndSettle();

      // Confirm dialog if present.
      final confirmSignOut = find.text('Sign Out');
      if ($.tester.any(confirmSignOut)) {
        await $(confirmSignOut.last).tap();
        await $.pumpAndSettle();
      }
      await $.pumpAndSettle(duration: const Duration(seconds: 2));

      // Auth guard should redirect to /login.
      expect(
        $.tester.any(find.text('Welcome Back')) ||
            $.tester.any(find.text('Create Your Account')) ||
            $.tester.any(find.text('Sign In')),
        isTrue,
        reason: 'Login/sign-up screen not shown after sign-out',
      );

      // Confirm user cannot reach /home without re-authenticating.
      // Attempt back-press — should stay on auth screen or go no further.
      await $.native.pressBack();
      await $.pumpAndSettle();

      expect(
        $.tester.any(find.text('Welcome Back')) ||
            $.tester.any(find.text('Create Your Account')) ||
            $.tester.any(find.text('Sign In')),
        isTrue,
        reason:
            'User reached authenticated screen after sign-out via back-press',
      );
    },
  );
}
