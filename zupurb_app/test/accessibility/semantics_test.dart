// T6 Accessibility — Semantics assertions
//
// Verifies that key interactive widgets expose meaningful semantic labels
// to assistive technologies (VoiceOver / TalkBack).
//
// Run with:
//   flutter test test/accessibility/semantics_test.dart

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:zupurb_app/widgets/score_badge.dart';
import 'package:zupurb_app/widgets/app_button.dart';
import 'package:zupurb_app/screens/reservation/time_slot_screen.dart';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

GoRouter _timeSlotRouter() => GoRouter(
      initialLocation: '/slots',
      routes: [
        GoRoute(path: '/slots', builder: (context, state) => const TimeSlotScreen()),
        GoRoute(path: '/reservation/confirm', builder: (context, state) => const Scaffold()),
      ],
    );

/// Pumps a widget while suppressing network-image load errors that are
/// expected in the test environment (HTTP returns 400).
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

// ---------------------------------------------------------------------------
// ScoreBadge semantics
// ---------------------------------------------------------------------------

void main() {
  group('ScoreBadge — semantics', () {
    late SemanticsHandle handle;

    setUp(() {
      handle = WidgetsBinding.instance.ensureSemantics();
    });

    tearDown(() => handle.dispose());

    testWidgets('has a semantics label containing the score value', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 4.2)));

      final node = tester.getSemantics(find.byType(ScoreBadge));
      expect(
        node.label,
        contains('4.2'),
        reason: 'Screen reader should announce the numeric score',
      );
    });

    testWidgets('semantics label includes "out of 5" context', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 3.7)));

      final node = tester.getSemantics(find.byType(ScoreBadge));
      expect(node.label, contains('out of 5'));
    });

    testWidgets('semantics label contains "Score:" prefix', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 5.0)));

      final node = tester.getSemantics(find.byType(ScoreBadge));
      expect(
        node.label.toLowerCase(),
        startsWith('score:'),
        reason: 'Label must start with "Score:" so context is clear',
      );
    });

    testWidgets('score badge with size=48 still has correct label', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 4.4, size: 48)));

      final node = tester.getSemantics(find.byType(ScoreBadge));
      expect(node.label, contains('4.4'));
    });
  });

  // ---------------------------------------------------------------------------
  // AppButton semantics
  // ---------------------------------------------------------------------------

  group('AppButton — semantics', () {
    late SemanticsHandle handle;

    setUp(() {
      handle = WidgetsBinding.instance.ensureSemantics();
    });

    tearDown(() => handle.dispose());

    testWidgets('Reserve button has non-empty semantic label', (tester) async {
      await tester.pumpWidget(_wrap(AppButton(label: 'Reserve', onTap: () {})));

      final node = tester.getSemantics(find.text('Reserve'));
      expect(node.label.isNotEmpty, isTrue);
      expect(node.label, 'Reserve');
    });

    testWidgets('Continue button has non-empty semantic label', (tester) async {
      await tester.pumpWidget(_wrap(AppButton(label: 'Continue', onTap: () {})));

      final node = tester.getSemantics(find.text('Continue'));
      expect(node.label, 'Continue');
    });

    testWidgets('Verify & Continue button has non-empty semantic label', (tester) async {
      await tester.pumpWidget(
        _wrap(AppButton(label: 'Verify & Continue', onTap: () {})),
      );

      final node = tester.getSemantics(find.text('Verify & Continue'));
      expect(node.label, 'Verify & Continue');
    });

    testWidgets('disabled AppButton still exposes label', (tester) async {
      await tester.pumpWidget(
        _wrap(const AppButton(label: 'Save & Continue', enabled: false)),
      );

      final node = tester.getSemantics(find.text('Save & Continue'));
      expect(node.label, 'Save & Continue');
    });

    testWidgets('AppButton Search label is non-empty and readable', (tester) async {
      await tester.pumpWidget(_wrap(AppButton(label: 'Search', onTap: () {})));

      final node = tester.getSemantics(find.text('Search'));
      expect(node.label, 'Search');
    });
  });

  // ---------------------------------------------------------------------------
  // TimeSlotScreen — party size button semantics
  // ---------------------------------------------------------------------------

  group('TimeSlotScreen — party size button semantics', () {
    late SemanticsHandle handle;

    setUp(() {
      handle = WidgetsBinding.instance.ensureSemantics();
    });

    tearDown(() => handle.dispose());

    testWidgets('Increase party size button has correct label', (tester) async {
      await _pump(tester, MaterialApp.router(routerConfig: _timeSlotRouter()));

      final increaseNode = tester.getSemantics(
        find.bySemanticsLabel('Increase party size'),
      );
      expect(increaseNode.label, 'Increase party size');
    });

    testWidgets('Decrease party size button has correct label', (tester) async {
      await _pump(tester, MaterialApp.router(routerConfig: _timeSlotRouter()));

      final decreaseNode = tester.getSemantics(
        find.bySemanticsLabel('Decrease party size'),
      );
      expect(decreaseNode.label, 'Decrease party size');
    });

    testWidgets('Save & Continue button exposes label', (tester) async {
      await _pump(tester, MaterialApp.router(routerConfig: _timeSlotRouter()));

      final node = tester.getSemantics(find.text('Save & Continue'));
      expect(node.label, 'Save & Continue');
    });

    testWidgets('party size increment is tappable via semantics label', (tester) async {
      await _pump(tester, MaterialApp.router(routerConfig: _timeSlotRouter()));

      // Verify the widget is found by its semantic label (a11y tree intact)
      expect(find.bySemanticsLabel('Increase party size'), findsOneWidget);
      expect(find.bySemanticsLabel('Decrease party size'), findsOneWidget);
    });
  });
}
