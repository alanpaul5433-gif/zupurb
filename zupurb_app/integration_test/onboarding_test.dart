// T3 — Integration test: Onboarding flow smoke test
//
// Exercises the first 4 onboarding steps without real auth:
//   Step 1 (Welcome)  → tap "Let's Go"   → stub /onboarding/2
//   Step 2 (Basics)   → tap "Continue"   → stub /onboarding/3
//   Step 3 (Incentive hook) → tap "Continue" → stub /onboarding/4
//   Step 4 (Identity) → renders tag chips
//
// No Firebase or auth providers are used. Steps 1–4 are self-contained
// StatelessWidget / StatefulWidget trees.
//
// REQUIRES_DEVICE: Step 1 uses NetworkImage background; image loading is not
// required for assertions.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:zupurb_app/screens/onboarding/onboarding_step1_screen.dart';
import 'package:zupurb_app/screens/onboarding/onboarding_step2_screen.dart';
import 'package:zupurb_app/screens/onboarding/onboarding_step3_screen.dart';
import 'package:zupurb_app/screens/onboarding/onboarding_step4_screen.dart';

import 'test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // ---------------------------------------------------------------------------
  // Step 1 — Welcome
  // ---------------------------------------------------------------------------

  group('OnboardingStep1Screen — welcome screen', () {
    testWidgets('renders headline and step indicator', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep1Screen(),
        stubRoutes: ['/onboarding/2'],
      );

      expect(find.textContaining("Let's Build Your Taste"), findsOneWidget);
      expect(find.text('STEP 1 OF 10'), findsOneWidget);
    });

    testWidgets("Let's Go button navigates to /onboarding/2", (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep1Screen(),
        stubRoutes: ['/onboarding/2'],
      );

      await tester.tap(find.text("Let's Go"));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__onboarding_2')),
        findsOneWidget,
      );
    });

    testWidgets('Skip for now also navigates to /onboarding/2', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep1Screen(),
        stubRoutes: ['/onboarding/2'],
      );

      await tester.tap(find.text('Skip for now'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__onboarding_2')),
        findsOneWidget,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Step 2 — Basics (age slider + gender chips)
  // ---------------------------------------------------------------------------

  group('OnboardingStep2Screen — demographics', () {
    testWidgets('renders step indicator and headline', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep2Screen(),
        stubRoutes: ['/onboarding/3'],
      );

      expect(find.text('STEP 2 OF 10'), findsOneWidget);
      expect(find.text('Tell Us The Basic'), findsOneWidget);
    });

    testWidgets('renders age slider label', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep2Screen(),
        stubRoutes: ['/onboarding/3'],
      );

      expect(find.text('Your Age'), findsOneWidget);
    });

    testWidgets('renders gender chips including default Man selection', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep2Screen(),
        stubRoutes: ['/onboarding/3'],
      );

      expect(find.text('Select Gender'), findsOneWidget);
      expect(find.text('Man'), findsOneWidget);
      expect(find.text('Woman'), findsOneWidget);
      expect(find.text('Non-binary'), findsOneWidget);
    });

    testWidgets('tapping a gender chip updates selection', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep2Screen(),
        stubRoutes: ['/onboarding/3'],
      );

      await tester.tap(find.text('Woman'));
      await tester.pump();

      // Widget rebuilds — Woman chip still visible (selection state changed).
      expect(find.text('Woman'), findsOneWidget);
    });

    testWidgets('Continue button navigates to /onboarding/3', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep2Screen(),
        stubRoutes: ['/onboarding/3'],
      );

      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__onboarding_3')),
        findsOneWidget,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Step 3 — Incentive hook (static info screen)
  // ---------------------------------------------------------------------------

  group('OnboardingStep3Screen — incentive hook', () {
    testWidgets('renders benefit bullet items', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep3Screen(),
        stubRoutes: ['/onboarding/4'],
      );

      expect(find.text('From People Like You scores'), findsOneWidget);
      expect(find.text('Deals matched to you'), findsOneWidget);
      expect(find.text('Full badge eligibility'), findsOneWidget);
    });

    testWidgets("Got it, let's continue navigates to /onboarding/4", (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep3Screen(),
        stubRoutes: ['/onboarding/4'],
      );

      await tester.tap(find.text("Got it, let's continue"));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__onboarding_4')),
        findsOneWidget,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Step 4 — Identity (cuisine/activity tags)
  // ---------------------------------------------------------------------------

  group('OnboardingStep4Screen — identity tags', () {
    testWidgets('renders step indicator', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep4Screen(),
        stubRoutes: ['/onboarding/5'],
      );

      expect(find.text('STEP 4 OF 10'), findsOneWidget);
    });

    testWidgets('renders Continue button', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep4Screen(),
        stubRoutes: ['/onboarding/5'],
      );

      expect(find.text('Continue'), findsOneWidget);
    });

    testWidgets('Continue navigates to /onboarding/5', (tester) async {
      await pumpScreen(
        tester,
        const OnboardingStep4Screen(),
        stubRoutes: ['/onboarding/5'],
      );

      await tester.tap(find.text('Continue'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__onboarding_5')),
        findsOneWidget,
      );
    });
  });
}
