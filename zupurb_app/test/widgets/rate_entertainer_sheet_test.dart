/// Widget tests for lib/widgets/rate_entertainer_sheet.dart
/// Opens the sheet via showRateEntertainerSheet(), asserts the star picker +
/// note field render, that submit is gated until at least 1 star is chosen, and
/// that a valid submit calls FunctionsService.rateEntertainer (mocktail-mocked
/// via the functionsServiceProvider DI seam).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:zupurb_app/core/services/functions_service.dart';
import 'package:zupurb_app/models/entertainer.dart';
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/widgets/rate_entertainer_sheet.dart';

class MockFunctionsService extends Mock implements FunctionsService {}

const _entertainer = Entertainer(
  id: 'ent-rate-1',
  name: 'DJ Marquez',
  role: 'DJ',
  tagline: 'tag',
  imageUrl: '',
  city: 'New York',
  rating: 4.8,
);

Widget _host(MockFunctionsService fns) {
  return ProviderScope(
    overrides: [functionsServiceProvider.overrideWithValue(fns)],
    child: MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: ElevatedButton(
              onPressed: () =>
                  showRateEntertainerSheet(context, entertainer: _entertainer),
              child: const Text('open-rate'),
            ),
          ),
        ),
      ),
    ),
  );
}

Future<void> _openSheet(WidgetTester tester, MockFunctionsService fns) async {
  await tester.pumpWidget(_host(fns));
  await tester.tap(find.text('open-rate'));
  await tester.pumpAndSettle();
}

ElevatedButton _submitButton(WidgetTester tester) => tester.widget<ElevatedButton>(
      find.widgetWithText(ElevatedButton, 'Submit rating'),
    );

void main() {
  group('RateEntertainerSheet – rendering', () {
    testWidgets('renders the title, subtitle and 5-star picker', (tester) async {
      await _openSheet(tester, MockFunctionsService());

      expect(find.text('Rate DJ Marquez'), findsOneWidget);
      expect(find.text('DJ · New York'), findsOneWidget);
      // 5 star IconButtons, all empty initially.
      expect(find.byType(IconButton), findsNWidgets(5));
      expect(find.byIcon(Icons.star_outline_rounded), findsNWidgets(5));
      expect(find.byIcon(Icons.star_rounded), findsNothing);
    });

    testWidgets('renders the optional note field', (tester) async {
      await _openSheet(tester, MockFunctionsService());
      expect(find.text('Add a note (optional)'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);
    });
  });

  group('RateEntertainerSheet – validation gating', () {
    testWidgets('submit is disabled until at least one star is selected',
        (tester) async {
      await _openSheet(tester, MockFunctionsService());
      expect(_submitButton(tester).onPressed, isNull);
    });

    testWidgets('selecting a star enables submit and fills the stars',
        (tester) async {
      await _openSheet(tester, MockFunctionsService());

      // Tap the 4th star (index 3) -> _stars = 4.
      await tester.tap(find.byType(IconButton).at(3));
      await tester.pump();

      expect(find.byIcon(Icons.star_rounded), findsNWidgets(4));
      expect(find.byIcon(Icons.star_outline_rounded), findsNWidgets(1));
      expect(_submitButton(tester).onPressed, isNotNull);
    });
  });

  group('RateEntertainerSheet – submission', () {
    testWidgets('valid submit calls rateEntertainer with id, stars and text',
        (tester) async {
      final fns = MockFunctionsService();
      when(() => fns.rateEntertainer(
            entertainerId: any(named: 'entertainerId'),
            stars: any(named: 'stars'),
            text: any(named: 'text'),
          )).thenAnswer(
        (_) async => {'reviewId': 'r1', 'rating': 480, 'reviewCount': 3},
      );

      await _openSheet(tester, fns);

      await tester.tap(find.byType(IconButton).at(3)); // 4 stars
      await tester.pump();
      await tester.enterText(find.byType(TextField), 'Great show');
      await tester.ensureVisible(
        find.widgetWithText(ElevatedButton, 'Submit rating'),
      );
      await tester.tap(find.widgetWithText(ElevatedButton, 'Submit rating'));
      await tester.pump();
      await tester.pump();

      final captured = verify(() => fns.rateEntertainer(
            entertainerId: captureAny(named: 'entertainerId'),
            stars: captureAny(named: 'stars'),
            text: captureAny(named: 'text'),
          )).captured;
      expect(captured[0], 'ent-rate-1');
      expect(captured[1], 4);
      expect(captured[2], 'Great show');

      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
    });

    testWidgets('does NOT call rateEntertainer when no star is selected',
        (tester) async {
      final fns = MockFunctionsService();
      await _openSheet(tester, fns);

      // Button is disabled, but tapping it must be a no-op regardless.
      await tester.tap(
        find.widgetWithText(ElevatedButton, 'Submit rating'),
        warnIfMissed: false,
      );
      await tester.pump();

      verifyNever(() => fns.rateEntertainer(
            entertainerId: any(named: 'entertainerId'),
            stars: any(named: 'stars'),
            text: any(named: 'text'),
          ));
    });
  });
}
