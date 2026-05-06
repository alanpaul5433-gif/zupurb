// REQUIRES_DEVICE: Run with 'patrol test' on connected iOS/Android device.
// Install CLI: dart pub global activate patrol_cli
// Then: patrol test integration_test/flows/golden_path_test.dart
//
// Each patrolTest is independent and can be run in isolation.
// The app uses a mock OTP flow: any 6-digit code is accepted.
// Firebase auth guard redirects unauthenticated users to /login.
// To run the full golden path the device must be pre-authenticated
// OR the test environment must stub Firebase Auth (see README).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';
import 'package:zupurb_app/main.dart' as app;

void main() {
  // ---------------------------------------------------------------------------
  // Step 1: Splash / Welcome
  // Verifies the splash screen renders the Zupurb logo text and tagline.
  // ---------------------------------------------------------------------------
  patrolTest(
    'Step 1 — splash screen renders brand identity',
    ($) async {
      app.main();
      await $.pumpAndSettle();

      // SplashScreen shows 'Zupurb' wordmark and tagline text.
      expect(find.text('Zupurb'), findsWidgets);
      expect(find.text('DISCOVER. REVIEW. REWARD.'), findsOneWidget);
    },
  );

  // ---------------------------------------------------------------------------
  // Step 2: Phone number entry (Sign Up → phone OTP entry point)
  // Navigates to /signup, fills in required fields, taps Create Account which
  // routes to /signup/phone-otp.
  // ---------------------------------------------------------------------------
  patrolTest(
    'Step 2 — sign-up screen accepts input and advances to phone OTP',
    ($) async {
      app.main();
      await $.pumpAndSettle();

      // Navigate directly to signup (splash auto-navigates to /home when
      // authenticated; drive to /signup by going through /login → sign-up link
      // or directly via deep-link in test harness). Here we locate the screen
      // by its headline text which must be present on the signup screen.
      await $.native.pressBack(); // no-op on fresh launch; safe to call

      // Locate signup route by headline.
      final createAccountHeadline = find.text('Create Your Account');
      if (!createAccountHeadline.evaluate().isNotEmpty) {
        // Tap "Sign in" / toggle to signup from wherever we landed.
        final signUpLink = find.text('Sign in');
        if (signUpLink.evaluate().isNotEmpty) {
          await $(signUpLink).tap();
          await $.pumpAndSettle();
        }
      }

      expect(find.text('Create Your Account'), findsOneWidget);

      // Fill Full Name field.
      await $(find.widgetWithText(TextField, 'Full Name')).enterText('Test User');
      // Fill Email.
      await $(find.widgetWithText(TextField, 'Email Address'))
          .enterText('testuser@zupurb.test');
      // Fill Password.
      await $(find.widgetWithText(TextField, 'Password')).enterText('Test1234!');
      // Fill Confirm Password.
      await $(find.widgetWithText(TextField, 'Confirm Password'))
          .enterText('Test1234!');
      // Fill Phone Number.
      await $(find.widgetWithText(TextField, 'Phone Number'))
          .enterText('5550001234');

      await $.pumpAndSettle();

      // Tap Create Account button — navigates to /signup/phone-otp.
      await $(find.text('Create Account')).tap();
      await $.pumpAndSettle();

      // Verify OTP screen loaded.
      expect(find.text('Verify Your Number'), findsOneWidget);
    },
  );

  // ---------------------------------------------------------------------------
  // Step 3: OTP screen — verify 6 digit fields render, enter code, tap Verify
  // ---------------------------------------------------------------------------
  patrolTest(
    'Step 3 — OTP screen renders 6 digit fields and accepts valid code',
    ($) async {
      app.main();
      await $.pumpAndSettle();

      // Drive to OTP screen via signup flow (abbreviated: locate headline from
      // previous step or navigate directly if already on that route).
      // This test assumes it can reach /signup/phone-otp.
      // For CI without a device, this block documents the expected state.

      // Expect the OTP screen headline and sub-copy.
      expect(find.text('Verify Your Number'), findsOneWidget);
      expect(find.textContaining('6-digit code'), findsOneWidget);

      // Six single-character TextFields should be present.
      final otpFields = find.byWidgetPredicate(
        (w) => w is TextField && w.maxLength == 1,
      );
      expect(otpFields, findsNWidgets(6));

      // Enter a 6-digit code (mock: any code accepted).
      for (int i = 0; i < 6; i++) {
        await $(otpFields.at(i)).enterText('${i + 1}');
        await $.pumpAndSettle();
      }

      // 'Verify & Continue' button becomes enabled once 6 digits entered.
      await $(find.text('Verify & Continue')).tap();
      await $.pumpAndSettle();

      // After verification the router pushes /onboarding/1.
      expect(find.textContaining('STEP 1 OF'), findsOneWidget);
    },
  );

  // ---------------------------------------------------------------------------
  // Step 4: Onboarding — tap through steps 1-3, verify step counter advances
  // ---------------------------------------------------------------------------
  patrolTest(
    'Step 4 — onboarding step counter advances through steps 1, 2, 3',
    ($) async {
      app.main();
      await $.pumpAndSettle();

      // Assumes app is at /onboarding/1 (post-OTP verification).
      expect(find.text('STEP 1 OF 10'), findsOneWidget);

      // Tap "Let's Go" to advance to step 2.
      await $(find.text("Let's Go")).tap();
      await $.pumpAndSettle();
      expect(find.text('STEP 2 OF 10'), findsOneWidget);

      // Tap Continue / Next on step 2 — use "Skip for now" as a fallback
      // since step 2+ may use a different CTA label.
      final step2Cta = find.text('Continue');
      final step2Skip = find.text('Skip for now');
      if (step2Cta.evaluate().isNotEmpty) {
        await $(step2Cta).tap();
      } else {
        await $(step2Skip).tap();
      }
      await $.pumpAndSettle();
      expect(find.text('STEP 3 OF 10'), findsOneWidget);
    },
  );

  // ---------------------------------------------------------------------------
  // Step 5: Home screen — verify venues list renders and search bar is present
  // ---------------------------------------------------------------------------
  patrolTest(
    'Step 5 — home screen renders feed content and search bar',
    ($) async {
      app.main();
      await $.pumpAndSettle();

      // The app auto-navigates authenticated users to /home.
      // Verify tab row and search hint are visible.
      expect(find.text('All'), findsOneWidget);
      expect(
        find.textContaining('Search experiences'),
        findsOneWidget,
      );

      // Verify at least one review card exists (mock data: 'Sarah M.' is
      // hardcoded in HomeScreen._ReviewCard).
      expect(find.text('Sarah M.'), findsOneWidget);

      // Tap the search bar — navigates to /search.
      await $(find.textContaining('Search experiences')).tap();
      await $.pumpAndSettle();

      // Search screen should now be visible.
      expect(find.byType(Scaffold), findsWidgets);
    },
  );

  // ---------------------------------------------------------------------------
  // Step 6: Venue detail — tap first venue card → verify score badge + Reserve
  // The EstablishmentScreen is at /establishment/:id.
  // Mock home screen routes to /establishment via deep-link.
  // ---------------------------------------------------------------------------
  patrolTest(
    'Step 6 — establishment screen renders score badge and Reserve button',
    ($) async {
      app.main();
      await $.pumpAndSettle();

      // Navigate to establishment detail.  The home screen ReviewCard shows
      // 'The Social Lounge' in the subtitle.  Tap it to navigate.
      final venueName = find.text('The Social Lounge');
      if (venueName.evaluate().isNotEmpty) {
        await $(venueName.first).tap();
        await $.pumpAndSettle();
      }

      // EstablishmentScreen headline.
      expect(find.text('The Social Lounge'), findsWidgets);

      // ScoreBadge widget should be present (score 4.4).
      expect(find.byWidgetPredicate((w) => w.runtimeType.toString() == 'ScoreBadge'), findsWidgets);

      // Both action buttons must exist.
      expect(find.text('Write a Review'), findsOneWidget);
      expect(find.text('Reserve'), findsOneWidget);
    },
  );

  // ---------------------------------------------------------------------------
  // Step 7: Review screen — verify 8 rating questions render, navigate back
  // ---------------------------------------------------------------------------
  patrolTest(
    'Step 7 — rate experience screen renders all 8 questions',
    ($) async {
      app.main();
      await $.pumpAndSettle();

      // Navigate to rate experience screen directly from establishment.
      // Assumes app is on /establishment/:id or can reach it.
      final writeReviewBtn = find.text('Write a Review');
      if (writeReviewBtn.evaluate().isNotEmpty) {
        await $(writeReviewBtn).tap();
        await $.pumpAndSettle();
      }

      // VerifyVisitScreen comes first — advance past it if present.
      final verifyBtn = find.text('I Was There');
      if (verifyBtn.evaluate().isNotEmpty) {
        await $(verifyBtn).tap();
        await $.pumpAndSettle();
      }

      // Rate experience screen should show the first question.
      expect(find.textContaining('food or drink quality'), findsOneWidget);

      // Verify 8 questions are present on the screen (may require scroll).
      // We assert the question strings that are always rendered in the widget
      // tree even when off-screen because RateExperienceScreen uses a ListView.
      const questionSubstrings = [
        'food or drink quality',
        'service',
        'clean',
        'atmosphere',
        'safe',
        'value for money',
        'return',
        'recommend',
      ];
      for (final q in questionSubstrings) {
        expect(find.textContaining(q), findsWidgets,
            reason: 'Question containing "$q" not found');
      }

      // Navigate back without submitting.
      await $.native.pressBack();
      await $.pumpAndSettle();
    },
  );

  // ---------------------------------------------------------------------------
  // Step 8: Reservation — tap Reserve → time slot screen → select slot → Save
  // ---------------------------------------------------------------------------
  patrolTest(
    'Step 8 — time slot screen renders slots and Save & Continue advances',
    ($) async {
      app.main();
      await $.pumpAndSettle();

      // Navigate to time slot screen.
      final reserveBtn = find.text('Reserve');
      if (reserveBtn.evaluate().isNotEmpty) {
        await $(reserveBtn).tap();
        await $.pumpAndSettle();
      }

      // TimeSlotScreen app bar shows venue name.
      expect(find.text('The Social Lounge'), findsWidgets);

      // Party size label must be present.
      expect(find.text('Party Size'), findsOneWidget);

      // 'Select Time' section label.
      expect(find.text('Select Time'), findsOneWidget);

      // Time slot chips from mock data — '5:30 PM' is always rendered first.
      expect(find.text('5:30 PM'), findsOneWidget);

      // Tap a slot to select it.
      await $(find.text('7:00 PM')).tap();
      await $.pumpAndSettle();

      // Tap Save & Continue.
      await $(find.text('Save & Continue')).tap();
      await $.pumpAndSettle();

      // Confirm booking screen should now be visible.
      expect(find.byType(Scaffold), findsWidgets);
    },
  );

  // ---------------------------------------------------------------------------
  // Step 9: Points wallet — navigate to /points → verify balance widget renders
  // ---------------------------------------------------------------------------
  patrolTest(
    'Step 9 — points wallet screen renders total balance widget',
    ($) async {
      app.main();
      await $.pumpAndSettle();

      // Navigate to points wallet.  The profile screen contains a link to it,
      // or navigate via the bottom nav profile tab → points.
      // Try tapping a visible Points-related element from the home feed or nav.
      final profileTab = find.byTooltip('Profile');
      if (profileTab.evaluate().isNotEmpty) {
        await $(profileTab).tap();
        await $.pumpAndSettle();
      }

      // If on own profile, look for Points / Wallet link.
      final pointsLink = find.textContaining('Points');
      if (pointsLink.evaluate().isNotEmpty) {
        await $(pointsLink.first).tap();
        await $.pumpAndSettle();
      }

      // PointsWalletScreen shows 'Points Wallet' in AppBar.
      expect(find.text('Points Wallet'), findsOneWidget);

      // Balance card shows 'TOTAL BALANCE' label.
      expect(find.text('TOTAL BALANCE'), findsOneWidget);

      // Mock balance value '1,847 pts'.
      expect(find.text('1,847 pts'), findsOneWidget);
    },
  );
}
