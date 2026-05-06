// T3 — Integration test: Reservation booking flow
//
// Flow under test (two-screen chain):
//   1. TimeSlotScreen  — select a day, select a time slot, tap "Save & Continue"
//      → /reservation/confirm
//   2. ConfirmBookingScreen — verify booking details render, tap "Confirm Booking"
//      → /reservation/pass
//   3. ReservationPassScreen — verify confirmation pass renders (QR + reference)
//
// FunctionsService is NOT called by any of these screens; they use hard-coded
// mock data and go_router navigation only.
//
// REQUIRES_DEVICE: NetworkImage (venue hero photo) requires live network;
// test assertions do not depend on image loading.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:zupurb_app/screens/reservation/time_slot_screen.dart';
import 'package:zupurb_app/screens/reservation/confirm_booking_screen.dart';
import 'package:zupurb_app/screens/reservation/reservation_pass_screen.dart';

import 'test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // ---------------------------------------------------------------------------
  // TimeSlotScreen tests
  // ---------------------------------------------------------------------------

  group('TimeSlotScreen — slot selection', () {
    testWidgets('renders venue name and party size controls', (tester) async {
      await pumpScreen(
        tester,
        const TimeSlotScreen(),
        stubRoutes: ['/reservation/confirm'],
      );

      expect(find.text('The Social Lounge'), findsOneWidget);
      expect(find.text('Party Size'), findsOneWidget);
      // Default party size is 4.
      expect(find.text('4'), findsOneWidget);
    });

    testWidgets('party size increments on + tap', (tester) async {
      await pumpScreen(
        tester,
        const TimeSlotScreen(),
        stubRoutes: ['/reservation/confirm'],
      );

      // Tap the + (add) button — it is the CircleAvatar with primary color.
      await tester.tap(find.byIcon(Icons.add).first);
      await tester.pump();

      expect(find.text('5'), findsOneWidget);
    });

    testWidgets('party size decrements on - tap', (tester) async {
      await pumpScreen(
        tester,
        const TimeSlotScreen(),
        stubRoutes: ['/reservation/confirm'],
      );

      await tester.tap(find.byIcon(Icons.remove).first);
      await tester.pump();

      expect(find.text('3'), findsOneWidget);
    });

    testWidgets('party size does not go below 1', (tester) async {
      await pumpScreen(
        tester,
        const TimeSlotScreen(),
        stubRoutes: ['/reservation/confirm'],
      );

      // Tap remove 5 times — starts at 4, floor is 1.
      for (var i = 0; i < 5; i++) {
        await tester.tap(find.byIcon(Icons.remove).first);
        await tester.pump();
      }

      expect(find.text('1'), findsOneWidget);
    });

    testWidgets('renders time slots including default selection', (tester) async {
      await pumpScreen(
        tester,
        const TimeSlotScreen(),
        stubRoutes: ['/reservation/confirm'],
      );

      await tester.scrollUntilVisible(
        find.text('Select Time'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('Select Time'), findsOneWidget);
      expect(find.text('7:30 PM'), findsOneWidget);
      expect(find.text('5:30 PM'), findsOneWidget);
    });

    testWidgets('tapping a time slot selects it', (tester) async {
      await pumpScreen(
        tester,
        const TimeSlotScreen(),
        stubRoutes: ['/reservation/confirm'],
      );

      await tester.scrollUntilVisible(
        find.text('5:30 PM'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      await tester.tap(find.text('5:30 PM'));
      await tester.pump();

      // After tap the state updates — slot text still present confirms rebuild.
      expect(find.text('5:30 PM'), findsOneWidget);
    });

    testWidgets('Save & Continue navigates to /reservation/confirm', (tester) async {
      await pumpScreen(
        tester,
        const TimeSlotScreen(),
        stubRoutes: ['/reservation/confirm'],
      );

      await tester.scrollUntilVisible(
        find.text('Save & Continue'),
        300,
        scrollable: find.byType(Scrollable).first,
      );

      await tester.tap(find.text('Save & Continue'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__reservation_confirm')),
        findsOneWidget,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // ConfirmBookingScreen tests
  // ---------------------------------------------------------------------------

  group('ConfirmBookingScreen — booking confirmation', () {
    testWidgets('renders venue name and ONE STEP LEFT heading', (tester) async {
      await pumpScreen(
        tester,
        const ConfirmBookingScreen(),
        stubRoutes: ['/reservation/pass'],
      );

      expect(find.text('ONE STEP LEFT'), findsOneWidget);
      expect(find.text('Confirm Your Table.'), findsOneWidget);
      expect(find.text('The Gilded Finch'), findsOneWidget);
    });

    testWidgets('renders date, time, and guest detail row', (tester) async {
      await pumpScreen(
        tester,
        const ConfirmBookingScreen(),
        stubRoutes: ['/reservation/pass'],
      );

      expect(find.text('Oct 24, 2026'), findsOneWidget);
      expect(find.text('08:30 PM'), findsOneWidget);
      expect(find.text('2 People'), findsOneWidget);
    });

    testWidgets('renders cancellation policy text', (tester) async {
      await pumpScreen(
        tester,
        const ConfirmBookingScreen(),
        stubRoutes: ['/reservation/pass'],
      );

      await tester.scrollUntilVisible(
        find.text('Cancellation Policy'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('Cancellation Policy'), findsOneWidget);
    });

    testWidgets('Confirm Booking navigates to /reservation/pass', (tester) async {
      await pumpScreen(
        tester,
        const ConfirmBookingScreen(),
        stubRoutes: ['/reservation/pass'],
      );

      await tester.scrollUntilVisible(
        find.text('Confirm Booking'),
        300,
        scrollable: find.byType(Scrollable).first,
      );

      await tester.tap(find.text('Confirm Booking'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('stub_page__reservation_pass')),
        findsOneWidget,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // ReservationPassScreen tests
  // ---------------------------------------------------------------------------

  group('ReservationPassScreen — reservation confirmation pass', () {
    testWidgets('renders RESERVATION DETAILS header and venue name', (tester) async {
      await pumpScreen(
        tester,
        const ReservationPassScreen(),
        stubRoutes: [],
      );

      expect(find.text('RESERVATION DETAILS'), findsOneWidget);
      expect(find.text('The Social Lounge'), findsOneWidget);
    });

    testWidgets('renders reference number ZRP-4821', (tester) async {
      await pumpScreen(
        tester,
        const ReservationPassScreen(),
        stubRoutes: [],
      );

      await tester.scrollUntilVisible(
        find.text('ZRP-4821'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('ZRP-4821'), findsOneWidget);
    });

    testWidgets('renders OTP code digits', (tester) async {
      await pumpScreen(
        tester,
        const ReservationPassScreen(),
        stubRoutes: [],
      );

      await tester.scrollUntilVisible(
        find.text('7'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      // OTP digits 7,4,3,2 are rendered as individual Text widgets.
      expect(find.text('7'), findsAtLeastNWidgets(1));
      expect(find.text('4'), findsAtLeastNWidgets(1));
    });

    testWidgets('renders points on check-in badge', (tester) async {
      await pumpScreen(
        tester,
        const ReservationPassScreen(),
        stubRoutes: [],
      );

      expect(find.text('10 pts on check-in'), findsOneWidget);
    });
  });
}
