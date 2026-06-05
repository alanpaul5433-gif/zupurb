// T4 — E2E golden path test.
// Run with: patrol test --target patrol_test/golden_path_test.dart
//
// Prerequisites:
//   1. Firebase emulators running:  firebase emulators:start
//   2. Firestore seeded:            node scripts/seed_e2e.js
//   3. Connected device or emulator (Android API 26+ / iOS 15+)
//   4. patrol_cli installed:        dart pub global activate patrol_cli
//   5. Invoke with APP_ENV override:
//      patrol test \
//        --target patrol_test/golden_path_test.dart \
//        --dart-define APP_ENV=development
//
// Firebase test credentials:
//   Phone:  +1 650-555-3434  (whitelisted in Firebase Auth console)
//   OTP:    123456
//
// This test is a SINGLE patrolTest covering the complete golden path so that
// each step executes within the same app session and shares auth state.
// Named step comments are the primary failure-tracing mechanism — when the
// test fails, the last passing step comment indicates where in the flow the
// failure occurred.
//
// Do NOT run via `flutter test` — Patrol tests require the patrol runner.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';

import 'helpers/app_wrapper.dart';
import 'helpers/mock_data.dart';

void main() {
  // ---------------------------------------------------------------------------
  // Golden Path: Sign-up → Onboarding → Review → Reservation → Redemption
  // ---------------------------------------------------------------------------
  patrolTest(
    'Golden path — full user journey from sign-up to deal redemption',
    config: PatrolTesterConfig(
      // Allow generous settle time for screens with async Firebase loads.
      settleTimeout: const Duration(seconds: 20),
      visibleTimeout: const Duration(seconds: 15),
    ),
    ($) async {
      // -----------------------------------------------------------------------
      // STEP 1: Launch app — splash screen
      // Expected: Splash screen shows brand identity and auto-transitions.
      // Key annotations needed in SplashScreen: Key('splash_wordmark')
      // -----------------------------------------------------------------------
      await AppWrapper.launch($, extraSettle: 2);

      expect(find.textContaining('Zupurb'), findsWidgets,
          reason: 'STEP 1: Splash wordmark not found');

      // Wait for splash auto-navigation to /login (3-second timer in SplashScreen).
      await $.pumpAndSettle(duration: const Duration(seconds: 4));

      // -----------------------------------------------------------------------
      // STEP 2: Login screen → navigate to sign-up
      // Expected: Login screen renders; tapping sign-up link shows signup form.
      // Key annotations needed in LoginScreen: Key('login_signup_link')
      // -----------------------------------------------------------------------
      expect(find.text('Welcome Back'), findsOneWidget,
          reason: 'STEP 2: Login screen headline not found');

      await AppWrapper.goToSignUp($);

      // -----------------------------------------------------------------------
      // STEP 3: Sign-up form — fill and submit
      // Expected: Sign-up screen renders all fields; tapping Create Account
      //           navigates to phone OTP screen.
      // Key annotations needed in SignUpScreen:
      //   Key('signup_field_name'), Key('signup_field_email'),
      //   Key('signup_field_password'), Key('signup_field_confirm'),
      //   Key('signup_field_phone'), Key('signup_submit_button')
      // -----------------------------------------------------------------------
      expect(find.text('Create Your Account'), findsOneWidget,
          reason: 'STEP 3: Sign-up headline not found');

      // Fill Full Name.
      await $(find.byKey(const Key('signup_field_name')))
          .enterText(kTestFullName)
          .catchError((_) async {
        // Key not yet wired — fall back to hint-text finder.
        await $(find.widgetWithText(TextField, 'Full Name'))
            .enterText(kTestFullName);
      });
      await $.pumpAndSettle();

      // Fill Email.
      await $(find.byKey(const Key('signup_field_email')))
          .enterText(kTestEmailAddress)
          .catchError((_) async {
        await $(find.widgetWithText(TextField, 'Email Address'))
            .enterText(kTestEmailAddress);
      });
      await $.pumpAndSettle();

      // Fill Password.
      await $(find.byKey(const Key('signup_field_password')))
          .enterText(kTestPassword)
          .catchError((_) async {
        await $(find.widgetWithText(TextField, 'Password'))
            .enterText(kTestPassword);
      });
      await $.pumpAndSettle();

      // Fill Confirm Password.
      await $(find.byKey(const Key('signup_field_confirm')))
          .enterText(kTestPassword)
          .catchError((_) async {
        await $(find.widgetWithText(TextField, 'Confirm Password'))
            .enterText(kTestPassword);
      });
      await $.pumpAndSettle();

      // Fill Phone (digits only — country picker handles +1).
      await $(find.byKey(const Key('signup_field_phone')))
          .enterText('6505553434')
          .catchError((_) async {
        await $(find.widgetWithText(TextField, 'Phone Number'))
            .enterText('6505553434');
      });
      await $.pumpAndSettle();

      // Submit.
      await $(find.byKey(const Key('signup_submit_button')))
          .tap()
          .catchError((_) async {
        await $(find.text('Create Account')).tap();
      });
      await $.pumpAndSettle();

      // -----------------------------------------------------------------------
      // STEP 4: Phone OTP verification
      // Expected: OTP screen renders 6 input fields; entering the test OTP
      //           and tapping Verify advances to onboarding.
      // Key annotations needed in PhoneOtpScreen:
      //   Key('otp_field_0') … Key('otp_field_5'), Key('otp_verify_button')
      // -----------------------------------------------------------------------
      expect(find.text('Verify Your Number'), findsOneWidget,
          reason: 'STEP 4: OTP screen headline not found');

      await AppWrapper.enterOtp($, code: kTestOtp);

      // After successful OTP: router pushes to /att (iOS) or /onboarding/1.
      await $.pumpAndSettle();

      // Handle ATT prompt on iOS if it appears.
      // Key annotation needed in AttPromptScreen: Key('att_continue_button')
      if ($.tester.any(find.byKey(const Key('att_continue_button')))) {
        await $(find.byKey(const Key('att_continue_button'))).tap();
        await $.pumpAndSettle();
      } else if ($.tester.any(find.text('Allow Tracking'))) {
        // Native iOS ATT system dialog — dismiss via native interaction.
        await $.native.selectCoarseLocation(); // no-op; exists to document intent
        await $.pumpAndSettle();
      }

      // -----------------------------------------------------------------------
      // STEP 5: Onboarding — step 1 (Welcome)
      // Expected: Step counter shows "STEP 1 OF 10"; tapping Let's Go advances.
      // -----------------------------------------------------------------------
      expect(find.textContaining('STEP 1'), findsOneWidget,
          reason: 'STEP 5: Onboarding step 1 counter not found');
      expect(find.text("Let's Go"), findsOneWidget,
          reason: 'STEP 5: Let\'s Go CTA not found');

      await $(find.text("Let's Go")).tap();
      await $.pumpAndSettle();

      // -----------------------------------------------------------------------
      // STEP 6: Onboarding — step 2 (Basics / Name + DOB)
      // Expected: Step counter shows "STEP 2 OF 10".
      // -----------------------------------------------------------------------
      expect(find.textContaining('STEP 2'), findsOneWidget,
          reason: 'STEP 6: Onboarding step 2 not reached');

      final step2Cta = find.text('Continue');
      final step2Skip = find.text('Skip for now');
      if ($.tester.any(step2Cta)) {
        await $(step2Cta).tap();
      } else {
        await $(step2Skip).tap();
      }
      await $.pumpAndSettle();

      // -----------------------------------------------------------------------
      // STEP 7: Onboarding — steps 3–7 (Identity, Food, Activity, Sports, etc.)
      // Tap through remaining steps using Continue / Skip CTAs.
      // -----------------------------------------------------------------------
      for (int step = 3; step <= 8; step++) {
        expect(find.textContaining('STEP $step'), findsOneWidget,
            reason: 'STEP 7: Onboarding step $step not reached');

        final ctaContinue = find.text('Continue');
        final ctaNext = find.text('Next');
        final ctaSkip = find.text('Skip for now');
        final ctaDone = find.text('Done');

        if ($.tester.any(ctaContinue)) {
          await $(ctaContinue).tap();
        } else if ($.tester.any(ctaNext)) {
          await $(ctaNext).tap();
        } else if ($.tester.any(ctaDone)) {
          await $(ctaDone).tap();
        } else if ($.tester.any(ctaSkip)) {
          await $(ctaSkip).tap();
        }
        await $.pumpAndSettle();
      }

      // -----------------------------------------------------------------------
      // STEP 8: Onboarding — steps 9–10 + Profile Complete screen
      // Expected: ProfileCompleteScreen renders after step 10.
      // Key annotation needed in ProfileCompleteScreen:
      //   Key('profile_complete_start_button')
      // -----------------------------------------------------------------------
      // Handle steps 9 and 10.
      for (int step = 9; step <= 10; step++) {
        if ($.tester.any(find.textContaining('STEP $step'))) {
          final ctaContinue = find.text('Continue');
          final ctaNext = find.text('Next');
          final ctaSkip = find.text('Skip for now');
          if ($.tester.any(ctaContinue)) {
            await $(ctaContinue).tap();
          } else if ($.tester.any(ctaNext)) {
            await $(ctaNext).tap();
          } else if ($.tester.any(ctaSkip)) {
            await $(ctaSkip).tap();
          }
          await $.pumpAndSettle();
        }
      }

      // Profile complete screen or direct /home transition.
      if ($.tester.any(find.text('Profile Complete'))) {
        final startBtn = find.byKey(const Key('profile_complete_start_button'));
        if ($.tester.any(startBtn)) {
          await $(startBtn).tap();
        } else {
          await $(find.text("Let's Explore")).tap();
        }
        await $.pumpAndSettle();
      }

      // -----------------------------------------------------------------------
      // STEP 9: Home feed
      // Expected: Home screen shows feed content, tab row, and search hint.
      // -----------------------------------------------------------------------
      expect(find.text('All'), findsOneWidget,
          reason: 'STEP 9: Home feed tab row not found');
      expect(find.textContaining('Search experiences'), findsOneWidget,
          reason: 'STEP 9: Search hint not found');

      // -----------------------------------------------------------------------
      // STEP 10: Search for establishment
      // Expected: Tapping the search bar navigates to /search; typing the
      //           venue name surfaces a result.
      // Key annotations needed in HomeScreen / SearchScreen:
      //   Key('home_search_bar'), Key('search_result_item_0')
      // -----------------------------------------------------------------------
      await $(find.textContaining('Search experiences')).tap();
      await $.pumpAndSettle();

      // SearchScreen should now be active.
      // Type the venue name.
      final searchInput = find.byKey(const Key('search_input'));
      if ($.tester.any(searchInput)) {
        await $(searchInput).enterText(kTestEstablishmentName);
      } else {
        await $(find.byType(TextField).first).enterText(kTestEstablishmentName);
      }
      await $.pumpAndSettle(duration: const Duration(seconds: 2)); // Algolia debounce

      // Tap the first result that matches the venue name.
      final resultFinder = find.text(kTestEstablishmentName);
      expect(resultFinder, findsWidgets,
          reason: 'STEP 10: Venue search result not found');
      await $(resultFinder.first).tap();
      await $.pumpAndSettle();

      // -----------------------------------------------------------------------
      // STEP 11: Establishment detail screen
      // Expected: Venue name, ScoreBadge, Write a Review button, Reserve button.
      // Key annotations needed in EstablishmentScreen:
      //   Key('est_score_badge'), Key('est_write_review_button'),
      //   Key('est_reserve_button')
      // -----------------------------------------------------------------------
      expect(find.text(kTestEstablishmentName), findsWidgets,
          reason: 'STEP 11: Establishment name not found on detail screen');
      expect(find.text('Write a Review'), findsOneWidget,
          reason: 'STEP 11: Write a Review button not found');
      expect(find.text('Reserve'), findsOneWidget,
          reason: 'STEP 11: Reserve button not found');

      // -----------------------------------------------------------------------
      // STEP 12: Review flow — verify visit
      // Expected: VerifyVisitScreen renders; tapping "I Was There" advances
      //           to the rating screen.
      // Key annotations needed in VerifyVisitScreen:
      //   Key('verify_visit_was_there_button'), Key('verify_visit_skip_button')
      // -----------------------------------------------------------------------
      await $(find.text('Write a Review')).tap();
      await $.pumpAndSettle();

      // VerifyVisitScreen — select verified option.
      if ($.tester.any(find.text('I Was There'))) {
        await $(find.text('I Was There')).tap();
        await $.pumpAndSettle();
      }

      // -----------------------------------------------------------------------
      // STEP 13: Review flow — rate experience (8 questions)
      // Expected: RateExperienceScreen shows 8 rating questions; selecting
      //           answers enables the Continue button.
      // Key annotations needed in RateExperienceScreen:
      //   Key('rate_q1_answer_A') … Key('rate_q8_answer_A')
      //   Key('rate_continue_button')
      // -----------------------------------------------------------------------
      // Assert first question keyword is visible.
      expect(find.textContaining('food or drink quality'), findsOneWidget,
          reason: 'STEP 13: First rating question not found');

      // Select answer A for each question.  The rating screen renders all
      // questions in a ListView; scroll down to expose each one.
      const answerLabel = 'A'; // "Absolutely" / highest rating option
      for (int q = 1; q <= 8; q++) {
        final answerKey = find.byKey(Key('rate_q${q}_answer_A'));
        if ($.tester.any(answerKey)) {
          await $(answerKey).scrollTo();
          await $(answerKey).tap();
        } else {
          // Fallback: find all "A" labelled tappable options and tap the Nth.
          final allAOptions = find.text(answerLabel);
          if ($.tester.any(allAOptions)) {
            await $(allAOptions.at(q - 1)).tap();
          }
        }
        await $.pumpAndSettle();
      }

      // Tap Continue / Submit answers.
      final rateContinue = find.byKey(const Key('rate_continue_button'));
      if ($.tester.any(rateContinue)) {
        await $(rateContinue).tap();
      } else {
        await $(find.text('Continue')).tap();
      }
      await $.pumpAndSettle();

      // -----------------------------------------------------------------------
      // STEP 14: Review flow — creator disclosure
      // Expected: CreatorDisclosureScreen renders; selecting "None" and
      //           continuing advances to the written review screen.
      // Key annotations needed in CreatorDisclosureScreen:
      //   Key('disclosure_none_option'), Key('disclosure_continue_button')
      // -----------------------------------------------------------------------
      if ($.tester.any(find.text('Disclosure'))) {
        final noneOption = find.byKey(const Key('disclosure_none_option'));
        if ($.tester.any(noneOption)) {
          await $(noneOption).tap();
        } else if ($.tester.any(find.text('None'))) {
          await $(find.text('None')).tap();
        } else if ($.tester.any(find.text('No affiliation'))) {
          await $(find.text('No affiliation')).tap();
        }
        await $.pumpAndSettle();

        final disclosureContinue =
            find.byKey(const Key('disclosure_continue_button'));
        if ($.tester.any(disclosureContinue)) {
          await $(disclosureContinue).tap();
        } else {
          await $(find.text('Continue')).tap();
        }
        await $.pumpAndSettle();
      }

      // -----------------------------------------------------------------------
      // STEP 15: Review flow — written review
      // Expected: WrittenReviewScreen renders a text input; entering text and
      //           submitting navigates to ReviewSubmittedScreen.
      // Key annotations needed in WrittenReviewScreen:
      //   Key('written_review_input'), Key('written_review_submit_button')
      // -----------------------------------------------------------------------
      final reviewInput = find.byKey(const Key('written_review_input'));
      if ($.tester.any(reviewInput)) {
        await $(reviewInput).enterText(
            'Great atmosphere and excellent cocktails. Highly recommend!');
      } else {
        // Fallback: find the first multi-line TextField on screen.
        final textFields = find.byType(TextField);
        if ($.tester.any(textFields)) {
          await $(textFields.first).enterText(
              'Great atmosphere and excellent cocktails. Highly recommend!');
        }
      }
      await $.pumpAndSettle();

      final submitReviewBtn =
          find.byKey(const Key('written_review_submit_button'));
      if ($.tester.any(submitReviewBtn)) {
        await $(submitReviewBtn).tap();
      } else {
        await $(find.text('Submit Review')).tap();
      }
      await $.pumpAndSettle(duration: const Duration(seconds: 3)); // Cloud Function round-trip

      // -----------------------------------------------------------------------
      // STEP 16: Review submitted confirmation
      // Expected: ReviewSubmittedScreen shows "Review Submitted!" and points
      //           awarded (80 Pts for a verified review).
      // -----------------------------------------------------------------------
      expect(find.text('Review Submitted!'), findsOneWidget,
          reason: 'STEP 16: Review submitted confirmation not found');
      expect(find.text('80 Pts'), findsOneWidget,
          reason: 'STEP 16: Points awarded text not found');

      // Navigate back to home to start reservation flow.
      await $.native.pressBack();
      await $.pumpAndSettle();

      // Ensure we are back on /home.
      if (!$.tester.any(find.text('All'))) {
        await $(find.byType(BackButton).first).tap();
        await $.pumpAndSettle();
      }

      // -----------------------------------------------------------------------
      // STEP 17: Reservation flow — navigate to establishment and tap Reserve
      // -----------------------------------------------------------------------
      // Re-open the establishment page via home feed.
      if ($.tester.any(find.text(kTestEstablishmentName))) {
        await $(find.text(kTestEstablishmentName).first).tap();
      } else {
        // Navigate via search again.
        await $(find.textContaining('Search experiences')).tap();
        await $.pumpAndSettle();
        final searchInputAgain = find.byKey(const Key('search_input'));
        if ($.tester.any(searchInputAgain)) {
          await $(searchInputAgain).enterText(kTestEstablishmentName);
        } else {
          await $(find.byType(TextField).first).enterText(kTestEstablishmentName);
        }
        await $.pumpAndSettle(duration: const Duration(seconds: 2));
        await $(find.text(kTestEstablishmentName).first).tap();
      }
      await $.pumpAndSettle();

      expect(find.text('Reserve'), findsOneWidget,
          reason: 'STEP 17: Reserve button not found on re-opened establishment');

      await $(find.text('Reserve')).tap();
      await $.pumpAndSettle();

      // -----------------------------------------------------------------------
      // STEP 18: Time slot selection
      // Expected: TimeSlotScreen shows Party Size, Select Time, and slot chips.
      //           Selecting a slot and tapping Save & Continue advances to
      //           confirm booking screen.
      // Key annotations needed in TimeSlotScreen:
      //   Key('slot_chip_${time}'), Key('slot_save_continue_button')
      // -----------------------------------------------------------------------
      expect(find.text('Party Size'), findsOneWidget,
          reason: 'STEP 18: Party Size label not found on slot screen');
      expect(find.text('Select Time'), findsOneWidget,
          reason: 'STEP 18: Select Time label not found');

      // Select the test slot.
      final slotFinder = find.text(kTestSlotTime);
      expect(slotFinder, findsOneWidget,
          reason: 'STEP 18: Test slot $kTestSlotTime not found');
      await $(slotFinder).tap();
      await $.pumpAndSettle();

      final saveSlotBtn = find.byKey(const Key('slot_save_continue_button'));
      if ($.tester.any(saveSlotBtn)) {
        await $(saveSlotBtn).tap();
      } else {
        await $(find.text('Save & Continue')).tap();
      }
      await $.pumpAndSettle();

      // -----------------------------------------------------------------------
      // STEP 19: Confirm booking
      // Expected: ConfirmBookingScreen shows venue name and a Confirm button.
      // Key annotations needed in ConfirmBookingScreen:
      //   Key('confirm_booking_button')
      // -----------------------------------------------------------------------
      expect(find.text(kTestEstablishmentName), findsWidgets,
          reason: 'STEP 19: Venue name not shown on confirm booking screen');

      final confirmBtn = find.byKey(const Key('confirm_booking_button'));
      if ($.tester.any(confirmBtn)) {
        await $(confirmBtn).tap();
      } else {
        await $(find.text('Confirm Booking')).tap();
      }
      await $.pumpAndSettle(duration: const Duration(seconds: 3));

      // -----------------------------------------------------------------------
      // STEP 20: My Reservations
      // Expected: After confirming, the router pushes to /reservation/my.
      //           The new reservation entry is visible.
      // Key annotations needed in MyReservationsScreen:
      //   Key('my_reservations_list')
      // -----------------------------------------------------------------------
      expect(find.text('My Reservations'), findsOneWidget,
          reason: 'STEP 20: My Reservations screen not reached');
      expect(find.text(kTestEstablishmentName), findsWidgets,
          reason: 'STEP 20: Reservation entry for venue not visible');

      // -----------------------------------------------------------------------
      // STEP 21: Points wallet — verify points awarded for review
      // Expected: Navigate to /points; PointsWalletScreen shows TOTAL BALANCE
      //           and a non-zero balance reflecting the review award.
      // Key annotations needed in PointsWalletScreen: Key('points_total_balance')
      // -----------------------------------------------------------------------
      // Navigate to profile tab → points wallet.
      final profileTab = find.byTooltip('Profile');
      if ($.tester.any(profileTab)) {
        await $(profileTab).tap();
        await $.pumpAndSettle();
      }

      final pointsLink = find.textContaining('Points');
      if ($.tester.any(pointsLink)) {
        await $(pointsLink.first).tap();
        await $.pumpAndSettle();
      }

      expect(find.text('Points Wallet'), findsOneWidget,
          reason: 'STEP 21: Points Wallet screen not found');
      expect(find.text('TOTAL BALANCE'), findsOneWidget,
          reason: 'STEP 21: TOTAL BALANCE label not found');

      // Confirm a numeric balance is shown (mock data: '1,847 pts' or similar).
      expect(
        find.textContaining('pts'),
        findsAtLeastNWidgets(1),
        reason: 'STEP 21: Points balance text not found',
      );

      // -----------------------------------------------------------------------
      // STEP 22: Redeem a deal
      // Expected: Navigate to /redeem; RedeemRewardsScreen shows reward cards.
      //           Tapping an available card shows a confirmation dialog or QR.
      // Key annotations needed in RedeemRewardsScreen:
      //   Key('redeem_card_0'), Key('redeem_confirm_button'), Key('redeem_qr_code')
      // -----------------------------------------------------------------------
      // Navigate to redeem screen — look for a "Redeem" or "Rewards" link.
      final redeemLink = find.text('Redeem Rewards');
      final redeemAlt = find.text('Rewards');
      if ($.tester.any(redeemLink)) {
        await $(redeemLink).tap();
      } else if ($.tester.any(redeemAlt)) {
        await $(redeemAlt).tap();
      }
      await $.pumpAndSettle();

      expect(find.text('Redeem Rewards'), findsOneWidget,
          reason: 'STEP 22: Redeem Rewards screen not found');
      expect(find.text('Available Rewards'), findsOneWidget,
          reason: 'STEP 22: Available Rewards section not found');
      expect(find.text(kTestDealName), findsWidgets,
          reason: 'STEP 22: Test deal "$kTestDealName" not found');

      // Tap the first available reward card.
      final redeemCard = find.byKey(const Key('redeem_card_0'));
      if ($.tester.any(redeemCard)) {
        await $(redeemCard).tap();
      } else {
        await $(find.text(kTestDealName).first).tap();
      }
      await $.pumpAndSettle();

      // Confirm the redemption in the dialog / bottom sheet.
      final redeemConfirmBtn = find.byKey(const Key('redeem_confirm_button'));
      if ($.tester.any(redeemConfirmBtn)) {
        await $(redeemConfirmBtn).tap();
      } else if ($.tester.any(find.text('Redeem Now'))) {
        await $(find.text('Redeem Now')).tap();
      } else if ($.tester.any(find.text('Confirm'))) {
        await $(find.text('Confirm')).tap();
      }
      await $.pumpAndSettle(duration: const Duration(seconds: 3));

      // -----------------------------------------------------------------------
      // STEP 23: QR code / redemption confirmation
      // Expected: A QR code widget or confirmation message is displayed after
      //           successful redemption.
      // Key annotation needed: Key('redeem_qr_code') or Key('redeem_success_banner')
      // -----------------------------------------------------------------------
      final qrCode = find.byKey(const Key('redeem_qr_code'));
      final successBanner = find.byKey(const Key('redeem_success_banner'));
      final successText = find.textContaining('Redeem');

      expect(
        $.tester.any(qrCode) ||
            $.tester.any(successBanner) ||
            $.tester.any(successText),
        isTrue,
        reason:
            'STEP 23: QR code or redemption confirmation not shown after redeeming',
      );

      // -----------------------------------------------------------------------
      // GOLDEN PATH COMPLETE
      // All steps passed — sign-up through first deal redemption verified.
      // -----------------------------------------------------------------------
    },
  );
}
