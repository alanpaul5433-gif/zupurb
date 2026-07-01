import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:zupurb_app/screens/reservation/time_slot_screen.dart';
import 'package:zupurb_app/theme/colors.dart';

GoRouter _buildRouter() => GoRouter(
      initialLocation: '/slots',
      routes: [
        GoRoute(
          path: '/slots',
          builder: (context, state) => const TimeSlotScreen(),
        ),
        GoRoute(path: '/reservation/confirm', builder: (context, state) => const Scaffold()),
      ],
    );

Widget _wrap() => MaterialApp.router(routerConfig: _buildRouter());

/// Pumps [widget] while silencing NetworkImageLoadException errors that occur
/// because the Flutter test environment blocks all HTTP requests (returns 400).
/// The error suppressor stays active for the entire test via [addTearDown].
Future<void> _pump(WidgetTester tester, Widget widget) async {
  final orig = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.library == 'image resource service') return;
    orig?.call(details);
  };
  addTearDown(() => FlutterError.onError = orig);
  await tester.pumpWidget(widget);
  await tester.pump();
}

void main() {
  group('TimeSlotScreen', () {
    testWidgets('renders Select Time heading', (tester) async {
      await _pump(tester, _wrap());
      expect(find.text('Select Time'), findsOneWidget);
    });

    testWidgets('renders all 6 time slot labels', (tester) async {
      await _pump(tester, _wrap());
      expect(find.text('5:30 PM'), findsOneWidget);
      expect(find.text('6:00 PM'), findsOneWidget);
      expect(find.text('7:00 PM'), findsOneWidget);
      expect(find.text('7:30 PM'), findsOneWidget);
      expect(find.text('8:00 PM'), findsOneWidget);
      expect(find.text('9:30 PM'), findsOneWidget);
    });

    testWidgets('default selected slot is 7:30 PM (primary border color)', (tester) async {
      await _pump(tester, _wrap());

      final slotText = find.text('7:30 PM');
      expect(slotText, findsOneWidget);

      final containerFinder = find.ancestor(
        of: slotText,
        matching: find.byType(Container),
      );
      final container = tester.widget<Container>(containerFinder.first);
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.border?.top.color, AppColors.primary);
    });

    testWidgets('tapping a different slot selects it', (tester) async {
      await _pump(tester, _wrap());

      await tester.tap(find.text('5:30 PM'));
      await tester.pump();

      final containerFinder = find.ancestor(
        of: find.text('5:30 PM'),
        matching: find.byType(Container),
      );
      final container = tester.widget<Container>(containerFinder.first);
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.border?.top.color, AppColors.primary);
    });

    // The day selector now generates 14 real calendar dates (commit 8c6fb61),
    // so day-of-month numbers can collide with the party-size count. Scope the
    // count finder to the "Party Size" Row so it stays date-independent.
    Finder partyCount(String n) => find.descendant(
          of: find.widgetWithText(Row, 'Party Size'),
          matching: find.text(n),
        );

    testWidgets('renders party size controls', (tester) async {
      await _pump(tester, _wrap());
      expect(find.text('Party Size'), findsOneWidget);
      expect(partyCount('4'), findsOneWidget);
    });

    testWidgets('increment party size increases count', (tester) async {
      await _pump(tester, _wrap());

      final addButton = find.byWidgetPredicate((w) =>
          w is CircleAvatar && w.backgroundColor == AppColors.primary);
      await tester.tap(addButton);
      await tester.pump();
      expect(partyCount('5'), findsOneWidget);
    });

    testWidgets('decrement party size decreases count', (tester) async {
      await _pump(tester, _wrap());

      final removeButton = find.byWidgetPredicate((w) =>
          w is CircleAvatar && w.backgroundColor == AppColors.border);
      await tester.tap(removeButton);
      await tester.pump();
      expect(partyCount('3'), findsOneWidget);
    });

    testWidgets('renders the 14-day selector tiles', (tester) async {
      await _pump(tester, _wrap());
      // The screen generates 14 consecutive real calendar days (commit 8c6fb61).
      // Asserting weekday labels + tile count keeps this date-independent (no
      // dependence on today's specific day-of-month numbers).
      const weekdays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
      for (final wd in weekdays) {
        expect(find.text(wd), findsWidgets, reason: '$wd tile should render');
      }
      final tileCount = weekdays
          .map((w) => tester.widgetList(find.text(w)).length)
          .fold<int>(0, (a, b) => a + b);
      expect(tileCount, 14, reason: 'day selector renders 14 day tiles');
    });

    testWidgets('renders Save & Continue button', (tester) async {
      await _pump(tester, _wrap());
      expect(find.text('Save & Continue'), findsOneWidget);
    });

    // NOTE: the per-slot points legend ('30 pts' / '10 pts') was removed from
    // TimeSlotScreen in commit 8c6fb61 (no replacement element on the screen),
    // so its assertion was dropped rather than re-pointed at unrelated content.
  });
}
