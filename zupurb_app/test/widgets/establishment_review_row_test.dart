// Tests the review row section of EstablishmentScreen.
// _ReviewRow is a private class; it is exercised through EstablishmentScreen
// which hard-codes two review rows with known data.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:zupurb_app/screens/establishment/establishment_screen.dart';
import 'package:zupurb_app/widgets/score_badge.dart';

GoRouter _buildRouter() => GoRouter(
      initialLocation: '/establishment',
      routes: [
        GoRoute(
          path: '/establishment',
          builder: (_, __) => const EstablishmentScreen(),
        ),
        GoRoute(path: '/review/verify', builder: (_, __) => const Scaffold()),
        GoRoute(path: '/reservation/slots', builder: (_, __) => const Scaffold()),
      ],
    );

Widget _wrap() => MaterialApp.router(routerConfig: _buildRouter());

/// Pumps [widget] while suppressing NetworkImageLoadException — Flutter test
/// env blocks all HTTP (returns 400). Suppressor stays active via [addTearDown].
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
  group('EstablishmentScreen – review rows', () {
    testWidgets('renders Recent Reviews header', (tester) async {
      await _pump(tester, _wrap());
      expect(find.text('Recent Reviews'), findsOneWidget);
    });

    testWidgets('renders first reviewer name', (tester) async {
      await _pump(tester, _wrap());
      expect(find.text('Sarah M.'), findsOneWidget);
    });

    testWidgets('renders second reviewer name', (tester) async {
      await _pump(tester, _wrap());
      expect(find.text('Marcus T.'), findsOneWidget);
    });

    testWidgets('renders review timestamps', (tester) async {
      await _pump(tester, _wrap());
      expect(find.text('2d ago'), findsOneWidget);
      expect(find.text('5d ago'), findsOneWidget);
    });

    testWidgets('renders ScoreBadge for each review row', (tester) async {
      await _pump(tester, _wrap());
      // EstablishmentScreen header has one ScoreBadge(4.4) + 2 review rows → 3 total
      expect(find.byType(ScoreBadge), findsNWidgets(3));
    });

    testWidgets('review text is truncated with ellipsis (maxLines: 2)', (tester) async {
      await _pump(tester, _wrap());
      final reviewTexts = tester
          .widgetList<Text>(find.text('Had an incredible dinner here last night...'))
          .toList();
      expect(reviewTexts, isNotEmpty);
      expect(reviewTexts.first.overflow, TextOverflow.ellipsis);
      expect(reviewTexts.first.maxLines, 2);
    });

    testWidgets('establishment score badge shows 4.4', (tester) async {
      await _pump(tester, _wrap());
      expect(find.text('4.4'), findsOneWidget);
    });
  });
}
