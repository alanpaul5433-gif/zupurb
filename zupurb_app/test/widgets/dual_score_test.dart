/// Widget tests for lib/widgets/dual_score.dart
/// DualScore is a ConsumerWidget that watches currentUserCohortProvider and,
/// when the viewer's cohort has >= 2 like-minded reviewers for the venue, shows
/// a "People like you" (_PlyPill) beneath the general ScoreBadge.
/// Covers: general-only branch, the cohort-driven PLY branch (present vs
/// absent/null/insufficient-count), and compact vs non-compact rendering.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/dual_score.dart';
import 'package:zupurb_app/widgets/score_badge.dart';
import 'package:zupurb_app/state/user/user_profile_provider.dart';

/// Wraps [child] with the cohort provider overridden to [cohort] (the only
/// provider DualScore watches). Overriding it fully replaces its body, so no
/// Firestore/userProfileProvider is ever touched.
Widget wrap(Widget child, {String? cohort}) => ProviderScope(
      overrides: [currentUserCohortProvider.overrideWithValue(cohort)],
      child: MaterialApp(home: Scaffold(body: Center(child: child))),
    );

double _badgeSize(WidgetTester tester) => tester
    .getSize(
      find
          .descendant(of: find.byType(ScoreBadge), matching: find.byType(Container))
          .first,
    )
    .width;

void main() {
  group('DualScore — general score', () {
    testWidgets('renders the general score badge', (tester) async {
      await tester.pumpWidget(
        wrap(const DualScore(generalScore: 4.2), cohort: null),
      );
      expect(find.byType(ScoreBadge), findsOneWidget);
      expect(find.text('4.2'), findsOneWidget);
    });

    testWidgets('no cohort -> only the badge, no People-like-you pill',
        (tester) async {
      await tester.pumpWidget(
        wrap(
          const DualScore(
            generalScore: 4.2,
            plyByCohort: {'foodies': 4.8},
            plyCountByCohort: {'foodies': 5},
          ),
          cohort: null,
        ),
      );
      expect(find.byIcon(Icons.people_alt), findsNothing);
      expect(find.textContaining('People like you'), findsNothing);
    });

    testWidgets('empty-string cohort is treated as no cohort -> no pill',
        (tester) async {
      await tester.pumpWidget(
        wrap(
          const DualScore(
            generalScore: 4.2,
            plyByCohort: {'': 4.8},
            plyCountByCohort: {'': 5},
          ),
          cohort: '',
        ),
      );
      expect(find.byIcon(Icons.people_alt), findsNothing);
    });
  });

  group('DualScore — People-like-you pill', () {
    testWidgets('cohort + enough reviewers -> pill shows cohort score',
        (tester) async {
      await tester.pumpWidget(
        wrap(
          const DualScore(
            generalScore: 4.2,
            plyByCohort: {'foodies': 4.6},
            plyCountByCohort: {'foodies': 3},
          ),
          cohort: 'foodies',
        ),
      );
      expect(find.byIcon(Icons.people_alt), findsOneWidget);
      expect(find.text('People like you 4.6'), findsOneWidget);
      // General badge still rendered alongside the pill.
      expect(find.text('4.2'), findsOneWidget);
    });

    testWidgets('plyByCohort null -> no pill even with a cohort',
        (tester) async {
      await tester.pumpWidget(
        wrap(const DualScore(generalScore: 4.2), cohort: 'foodies'),
      );
      expect(find.byIcon(Icons.people_alt), findsNothing);
    });

    testWidgets('insufficient like-minded reviewers (count < 2) -> no pill',
        (tester) async {
      await tester.pumpWidget(
        wrap(
          const DualScore(
            generalScore: 4.2,
            plyByCohort: {'foodies': 4.6},
            plyCountByCohort: {'foodies': 1},
          ),
          cohort: 'foodies',
        ),
      );
      expect(find.byIcon(Icons.people_alt), findsNothing);
    });

    testWidgets('plyCountByCohort null -> count defaults to 0 -> no pill',
        (tester) async {
      await tester.pumpWidget(
        wrap(
          const DualScore(
            generalScore: 4.2,
            plyByCohort: {'foodies': 4.6},
          ),
          cohort: 'foodies',
        ),
      );
      expect(find.byIcon(Icons.people_alt), findsNothing);
    });

    testWidgets('cohort key absent from plyByCohort -> no pill',
        (tester) async {
      await tester.pumpWidget(
        wrap(
          const DualScore(
            generalScore: 4.2,
            plyByCohort: {'others': 4.6},
            plyCountByCohort: {'others': 5},
          ),
          cohort: 'foodies',
        ),
      );
      expect(find.byIcon(Icons.people_alt), findsNothing);
    });

    testWidgets('exactly 2 reviewers (boundary) -> pill shows', (tester) async {
      await tester.pumpWidget(
        wrap(
          const DualScore(
            generalScore: 4.2,
            plyByCohort: {'foodies': 4.6},
            plyCountByCohort: {'foodies': 2},
          ),
          cohort: 'foodies',
        ),
      );
      expect(find.byIcon(Icons.people_alt), findsOneWidget);
    });
  });

  group('DualScore — compact vs non-compact', () {
    testWidgets('non-compact uses the default 44 badge size', (tester) async {
      await tester.pumpWidget(
        wrap(const DualScore(generalScore: 3.0), cohort: null),
      );
      expect(_badgeSize(tester), 44.0);
    });

    testWidgets('non-compact honours a custom badgeSize', (tester) async {
      await tester.pumpWidget(
        wrap(const DualScore(generalScore: 3.0, badgeSize: 50), cohort: null),
      );
      expect(_badgeSize(tester), 50.0);
    });

    testWidgets('compact forces the badge to 36 (ignores badgeSize)',
        (tester) async {
      await tester.pumpWidget(
        wrap(
          const DualScore(generalScore: 3.0, compact: true, badgeSize: 50),
          cohort: null,
        ),
      );
      expect(_badgeSize(tester), 36.0);
    });

    testWidgets('compact pill shows just the score, not the full label',
        (tester) async {
      await tester.pumpWidget(
        wrap(
          const DualScore(
            generalScore: 4.2,
            compact: true,
            plyByCohort: {'foodies': 4.6},
            plyCountByCohort: {'foodies': 3},
          ),
          cohort: 'foodies',
        ),
      );
      expect(find.byIcon(Icons.people_alt), findsOneWidget);
      expect(find.text('4.6'), findsOneWidget); // compact pill = score only
      expect(find.textContaining('People like you'), findsNothing);
    });
  });
}
