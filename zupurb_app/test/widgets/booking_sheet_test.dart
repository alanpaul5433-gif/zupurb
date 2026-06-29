/// Widget tests for lib/widgets/booking_sheet.dart
/// Opens the sheet via the public showBookingSheet(), asserts the form renders,
/// and verifies a submit calls FunctionsService.requestBooking with the expected
/// args via a mocktail-mocked functionsServiceProvider (clean DI seam).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:zupurb_app/core/services/functions_service.dart';
import 'package:zupurb_app/models/entertainer.dart';
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/widgets/booking_sheet.dart';

class MockFunctionsService extends Mock implements FunctionsService {}

const _entertainer = Entertainer(
  id: 'ent-dj-1',
  name: 'DJ Marquez',
  role: 'DJ',
  tagline: 'Bringing the heat to every floor',
  imageUrl: '', // empty -> avatar fallback (no network image in tests)
  city: 'New York',
  rating: 4.8,
);

/// Host page with a button that opens the booking sheet for [_entertainer].
Widget _host(MockFunctionsService fns) {
  return ProviderScope(
    overrides: [functionsServiceProvider.overrideWithValue(fns)],
    child: MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: ElevatedButton(
              onPressed: () =>
                  showBookingSheet(context, entertainer: _entertainer),
              child: const Text('open-sheet'),
            ),
          ),
        ),
      ),
    ),
  );
}

Future<void> _openSheet(WidgetTester tester, MockFunctionsService fns) async {
  await tester.pumpWidget(_host(fns));
  await tester.tap(find.text('open-sheet'));
  await tester.pumpAndSettle();
}

void main() {
  group('BookingSheet – rendering', () {
    testWidgets('renders the entertainer header (name, role · city, rating)',
        (tester) async {
      await _openSheet(tester, MockFunctionsService());

      expect(find.text('DJ Marquez'), findsOneWidget);
      expect(find.text('DJ · New York'), findsOneWidget);
      expect(find.text('4.8'), findsOneWidget); // rating.toStringAsFixed(1)
      expect(find.text('Bringing the heat to every floor'), findsOneWidget);
    });

    testWidgets('renders the request form fields and labels', (tester) async {
      await _openSheet(tester, MockFunctionsService());

      expect(find.text('Request a booking'), findsOneWidget);
      expect(find.text('Preferred date'), findsOneWidget);
      expect(find.text('Select a date'), findsOneWidget); // empty date placeholder
      expect(find.text('Message (optional)'), findsOneWidget);
      // Exactly one editable field (the message TextField).
      expect(find.byType(TextField), findsOneWidget);
    });

    testWidgets('renders an enabled "Send request" submit button',
        (tester) async {
      await _openSheet(tester, MockFunctionsService());

      final button = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Send request'),
      );
      // No required-field gating in this sheet: submit is enabled immediately.
      expect(button.onPressed, isNotNull);
    });
  });

  group('BookingSheet – submission', () {
    testWidgets(
        'valid submit calls requestBooking with entertainer + message + non-empty key',
        (tester) async {
      final fns = MockFunctionsService();
      when(() => fns.requestBooking(
            targetType: any(named: 'targetType'),
            targetId: any(named: 'targetId'),
            idempotencyKey: any(named: 'idempotencyKey'),
            requestedDate: any(named: 'requestedDate'),
            message: any(named: 'message'),
          )).thenAnswer((_) async => {'bookingId': 'b1', 'status': 'pending'});

      await _openSheet(tester, fns);

      await tester.enterText(find.byType(TextField), 'Need a DJ for my party');
      await tester.ensureVisible(
        find.widgetWithText(ElevatedButton, 'Send request'),
      );
      await tester.tap(find.widgetWithText(ElevatedButton, 'Send request'));
      await tester.pump(); // _submitting = true frame
      await tester.pump(); // mock future resolves -> pop + snackbar

      final captured = verify(() => fns.requestBooking(
            targetType: captureAny(named: 'targetType'),
            targetId: captureAny(named: 'targetId'),
            idempotencyKey: captureAny(named: 'idempotencyKey'),
            requestedDate: captureAny(named: 'requestedDate'),
            message: captureAny(named: 'message'),
          )).captured;

      expect(captured[0], 'entertainer'); // targetType
      expect(captured[1], 'ent-dj-1'); // targetId
      expect(captured[2], isA<String>()); // idempotencyKey (uuid v4)
      expect((captured[2] as String).isNotEmpty, isTrue);
      expect(captured[3], isNull); // requestedDate — no date picked
      expect(captured[4], 'Need a DJ for my party'); // message (raw; service trims)

      // Flush the floating SnackBar's 3s auto-dismiss timer to avoid a
      // pending-timer failure at teardown.
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
    });

    testWidgets('submit with no message still passes an empty message string',
        (tester) async {
      final fns = MockFunctionsService();
      when(() => fns.requestBooking(
            targetType: any(named: 'targetType'),
            targetId: any(named: 'targetId'),
            idempotencyKey: any(named: 'idempotencyKey'),
            requestedDate: any(named: 'requestedDate'),
            message: any(named: 'message'),
          )).thenAnswer((_) async => {'bookingId': 'b2', 'status': 'pending'});

      await _openSheet(tester, fns);
      await tester.ensureVisible(
        find.widgetWithText(ElevatedButton, 'Send request'),
      );
      await tester.tap(find.widgetWithText(ElevatedButton, 'Send request'));
      await tester.pump();
      await tester.pump();

      final captured = verify(() => fns.requestBooking(
            targetType: captureAny(named: 'targetType'),
            targetId: captureAny(named: 'targetId'),
            idempotencyKey: captureAny(named: 'idempotencyKey'),
            requestedDate: captureAny(named: 'requestedDate'),
            message: captureAny(named: 'message'),
          )).captured;
      expect(captured[4], ''); // empty message field -> '' (service trims later)

      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();
    });
  });
}
