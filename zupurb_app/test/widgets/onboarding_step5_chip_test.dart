// Tests the chip-selection behaviour on the Food & Drink onboarding step.
// The chips are inline (not a separate widget class), so they are tested
// through OnboardingStep5Screen.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:zupurb_app/screens/onboarding/onboarding_step5_screen.dart';
import 'package:zupurb_app/theme/colors.dart';

import '../helpers/test_app_harness.dart';

GoRouter _buildRouter() => GoRouter(
      initialLocation: '/onboarding/5',
      routes: [
        GoRoute(
          path: '/onboarding/:step',
          builder: (context, state) => const OnboardingStep5Screen(),
        ),
      ],
    );

// OnboardingStep5Screen is now a ConsumerStatefulWidget reading
// onboardingDraftProvider, so it requires a ProviderScope ancestor. Firebase
// core is mocked (setUpAll) and the boot providers neutralised for safety.
Widget _wrap() => ProviderScope(
      overrides: firebaseNeutralisingOverrides(),
      child: MaterialApp.router(routerConfig: _buildRouter()),
    );

void main() {
  setUpAll(() async {
    await setUpTestFirebase();
  });

  group('OnboardingStep5Screen – chip selection', () {
    testWidgets('renders cuisine chip labels', (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump();
      expect(find.text('Italian'), findsOneWidget);
      expect(find.text('Mexican'), findsOneWidget);
      expect(find.text('Japanese'), findsOneWidget);
      expect(find.text('Thai'), findsOneWidget);
    });

    testWidgets('no cuisine chip is pre-selected initially', (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump();

      // Phantom defaults were intentionally removed: the screen now hydrates
      // from an empty onboarding draft, so an untouched screen starts with no
      // chip selected (submits an empty set rather than fake preferences).
      _assertChipSelected(tester, 'Italian', expected: false);
      _assertChipSelected(tester, 'Mexican', expected: false);
      _assertChipSelected(tester, 'Japanese', expected: false);
    });

    testWidgets('tapping an unselected chip selects it', (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump();

      _assertChipSelected(tester, 'Mexican', expected: false);

      await tester.tap(find.text('Mexican'));
      await tester.pump();

      _assertChipSelected(tester, 'Mexican', expected: true);
    });

    testWidgets('tapping a selected chip deselects it', (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump();

      // Nothing is pre-selected, so first tap to select Italian, then tap again
      // to deselect — verifying the chip toggle works in both directions.
      _assertChipSelected(tester, 'Italian', expected: false);

      await tester.tap(find.text('Italian'));
      await tester.pump();
      _assertChipSelected(tester, 'Italian', expected: true);

      await tester.tap(find.text('Italian'));
      await tester.pump();
      _assertChipSelected(tester, 'Italian', expected: false);
    });

    testWidgets('renders drink chip labels', (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump();
      expect(find.text('Non-alcoholic'), findsOneWidget);
      expect(find.text('Beer'), findsOneWidget);
      expect(find.text('Wine'), findsOneWidget);
      expect(find.text('Cocktails'), findsOneWidget);
    });

    testWidgets('drink chips are initially all unselected', (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump();
      _assertChipSelected(tester, 'Beer', expected: false);
      _assertChipSelected(tester, 'Wine', expected: false);
    });

    testWidgets('tapping a drink chip selects it', (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump();

      await tester.ensureVisible(find.text('Beer'));
      await tester.pump();
      await tester.tap(find.text('Beer'));
      await tester.pump();

      _assertChipSelected(tester, 'Beer', expected: true);
    });

    testWidgets('multiple drink chips can be selected simultaneously',
        (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump();

      await tester.ensureVisible(find.text('Beer'));
      await tester.pump();
      await tester.tap(find.text('Beer'));
      await tester.pump();

      await tester.ensureVisible(find.text('Wine'));
      await tester.pump();
      await tester.tap(find.text('Wine'));
      await tester.pump();

      _assertChipSelected(tester, 'Beer', expected: true);
      _assertChipSelected(tester, 'Wine', expected: true);
    });

    testWidgets('renders step progress indicator', (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump();
      expect(find.text('STEP 5 OF 10'), findsOneWidget);
    });

    testWidgets('renders Continue button', (tester) async {
      await tester.pumpWidget(_wrap());
      await tester.pump();
      expect(find.text('Continue'), findsOneWidget);
    });
  });
}

/// Finds the nearest Container ancestor of the chip with [label] and asserts
/// its background color matches selected/unselected state.
void _assertChipSelected(
  WidgetTester tester,
  String label, {
  required bool expected,
}) {
  final containerFinder = find.ancestor(
    of: find.text(label),
    matching: find.byType(Container),
  );
  // The innermost Container is the chip tile
  final container = tester.widget<Container>(containerFinder.first);
  final decoration = container.decoration as BoxDecoration;
  if (expected) {
    expect(
      decoration.color,
      AppColors.primary,
      reason: 'Chip "$label" should be selected (primary color)',
    );
  } else {
    expect(
      decoration.color,
      isNot(AppColors.primary),
      reason: 'Chip "$label" should NOT be selected',
    );
  }
}
