// Tests the review row section of EstablishmentScreen. The screen reads
// establishmentProvider + establishmentReviewsProvider (live Firestore streams)
// and falls back to hard-coded header (score 4.4, "The Social Lounge") + two
// review rows when those are null/empty.
//
// Migrated (QA-5a) onto the shared harness: wrapScreen() supplies ProviderScope
// + Firebase neutralisation; the two family providers are overridden to
// null/empty so the deterministic fallback content renders with no backend.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/review.dart';
import 'package:zupurb_app/screens/establishment/establishment_screen.dart';
import 'package:zupurb_app/state/establishments/establishments_provider.dart';
import 'package:zupurb_app/state/reviews/reviews_provider.dart';
import 'package:zupurb_app/widgets/score_badge.dart';

import '../helpers/test_app_harness.dart';

const _estId = 'social-lounge';

Widget _wrap() => wrapScreen(
      const EstablishmentScreen(id: _estId),
      overrides: [
        establishmentProvider(_estId).overrideWith((ref) => Stream.value(null)),
        // Keep reviews in the loading state (stream never emits) — the screen's
        // loading branch renders the two hard-coded rows these tests assert.
        establishmentReviewsProvider(_estId)
            .overrideWith((ref) => const Stream<List<Review>>.empty()),
      ],
      stubRoutes: const ['/review/verify', '/reservation/slots'],
    );

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
  // Mocks Firebase core so `*.instance` getters (Firestore/Auth/etc.) reached
  // during EstablishmentScreen's build no longer throw [core/no-app].
  setUpAll(() async {
    await setUpTestFirebase();
  });

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
