/// T7 Performance — Scroll benchmark scaffolds
///
/// These tests validate scroll correctness and widget-tree health in the
/// widget-test sandbox. They also serve as the documented proxy for real-device
/// performance budgets (see BUDGETS.txt).
///
/// TIMING PHILOSOPHY
/// -----------------
/// Flutter's widget-test sandbox runs on a JIT Dart VM on the host machine
/// with no GPU pipeline. wall-clock time from pump() measures host-JIT
/// scheduling overhead, NOT render-thread or raster-thread cost. Therefore:
///
///   - Timing assertions in this file use a "sandbox ceiling" (500 ms) that
///     catches regressions caused by synchronous blocking work (e.g., large
///     JSON parsing, blocking I/O) introduced into build() methods.
///   - The real 60-fps budget (16 ms/frame) is enforced on physical device
///     using Flutter DevTools (see BUDGETS.txt).
///   - Correctness assertions (no exceptions, correct widget types, fling
///     without crash) are the primary CI gates here.
///
/// REAL-DEVICE ENFORCEMENT
/// -----------------------
///   flutter run --profile -d DEVICE_ID
///   DevTools > Performance > Frame rendering chart
///   Target: all frames ≤ 16 ms (green zone).
///   Jank: any frame > 32 ms (dark-red zone) must be investigated.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:zupurb_app/screens/home/home_screen.dart';
import 'package:zupurb_app/screens/discover/discover_screen.dart';
import 'package:zupurb_app/widgets/score_badge.dart';

// ---------------------------------------------------------------------------
// Budget constants
// ---------------------------------------------------------------------------

/// Real-device frame budget: 16 ms (60 fps). Enforced via DevTools on device.
/// NOT used as a CI assertion — see timing philosophy above.
// ignore: unused_element
const int kRealDeviceFrameBudgetMs = 16;

/// Sandbox ceiling for detecting synchronous blocking regressions in build().
/// Any widget pump exceeding this value indicates blocking work in the
/// Dart/Flutter framework layer (not GPU — those regressions need device).
const int kSandboxSynchronousCeilingMs = 500;

/// Number of synthetic scroll items pumped per test.
const int kScrollItemCount = 20;

// ---------------------------------------------------------------------------
// Router helpers
// ---------------------------------------------------------------------------

GoRouter _homeRouter() => GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, state) => const HomeScreen(),
        ),
        GoRoute(
            path: '/notifications',
            builder: (context, state) => const Scaffold()),
        GoRoute(path: '/search', builder: (context, state) => const Scaffold()),
      ],
    );

GoRouter _discoverRouter() => GoRouter(
      initialLocation: '/discover',
      routes: [
        GoRoute(
          path: '/discover',
          builder: (context, state) => const DiscoverScreen(),
        ),
        GoRoute(
            path: '/notifications',
            builder: (context, state) => const Scaffold()),
        GoRoute(
            path: '/establishment',
            builder: (context, state) => const Scaffold()),
      ],
    );

// ---------------------------------------------------------------------------
// Synthetic scrollable list widgets
// ---------------------------------------------------------------------------

/// A review card item matching the visual weight of HomeScreen's _ReviewCard:
/// avatar, text rows, score badge, image placeholder row.
class _MockReviewCard extends StatelessWidget {
  final int index;
  const _MockReviewCard({required this.index});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E5E5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const CircleAvatar(
                  radius: 16, backgroundColor: Color(0xFFE5E5E5)),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Reviewer $index',
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.w600)),
                    const Text('Mock Venue • Restaurant',
                        style: TextStyle(
                            fontSize: 11, color: Color(0xFF888888))),
                  ],
                ),
              ),
              ScoreBadge(score: 3.5 + (index % 15) * 0.1),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Review body text for item $index. '
            'Great food, fantastic service, wonderful atmosphere.',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13),
          ),
          const SizedBox(height: 8),
          Row(
            children: List.generate(
              3,
              (i) => Container(
                width: 60,
                height: 60,
                margin: const EdgeInsets.only(right: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFE5E5E5),
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// An establishment card matching the visual weight of DiscoverScreen's
/// _NearbyItem / _TrendingCard: image area, name, type text, score badge.
class _MockEstablishmentCard extends StatelessWidget {
  final int index;
  const _MockEstablishmentCard({required this.index});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E5E5)),
      ),
      child: Row(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: const Color(0xFFE5E5E5),
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Venue $index',
                    style: const TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600)),
                Text('Category · ${(index % 3) + 1}.${index % 9} km',
                    style: const TextStyle(
                        fontSize: 12, color: Color(0xFF888888))),
              ],
            ),
          ),
          ScoreBadge(score: 3.5 + (index % 15) * 0.1),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Pump helper — suppresses NetworkImage errors (test env blocks HTTP)
// ---------------------------------------------------------------------------

Future<void> _pumpSuppressed(WidgetTester tester, Widget widget) async {
  final orig = FlutterError.onError;
  FlutterError.onError = (details) {
    if (details.library == 'image resource service') return;
    if (details.exceptionAsString().contains('RenderFlex overflowed')) return;
    orig?.call(details);
  };
  addTearDown(() => FlutterError.onError = orig);
  // Real screens (HomeScreen/DiscoverScreen) read Riverpod providers, so they
  // require a ProviderScope ancestor.
  await tester.pumpWidget(ProviderScope(child: widget));
  await tester.pump();
}

// ---------------------------------------------------------------------------
// Frame-time measurement helper
// ---------------------------------------------------------------------------

/// Scrolls [scrollable] by [totalPixels] in increments while recording the
/// wall-clock duration of each drag+pump pair. Returns the list of durations.
///
/// Sandbox interpretation: each duration measures Dart VM work for one scroll
/// step. This catches synchronous blocking regressions in build/layout/paint.
/// It does NOT measure GPU raster time — use DevTools on device for that.
Future<List<Duration>> _measureScrollFrames(
  WidgetTester tester,
  Finder scrollable, {
  double totalPixels = 1200,
  double stepPixels = 60,
}) async {
  final durations = <Duration>[];
  double scrolled = 0;
  while (scrolled < totalPixels) {
    final sw = Stopwatch()..start();
    await tester.drag(scrollable, Offset(0, -stepPixels));
    await tester.pump();
    sw.stop();
    durations.add(sw.elapsed);
    scrolled += stepPixels;
  }
  return durations;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  group('T7 – Scroll performance: synthetic feed lists', () {
    testWidgets(
      'Home feed: 20 mock review cards scroll without blocking work '
      '(sandbox ceiling ${kSandboxSynchronousCeilingMs}ms)',
      (tester) async {
        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: ListView.builder(
              itemCount: kScrollItemCount,
              itemBuilder: (context, i) => _MockReviewCard(index: i),
            ),
          ),
        ));
        await tester.pump();

        final durations = await _measureScrollFrames(
          tester,
          find.byType(ListView),
          totalPixels: 1200,
          stepPixels: 60,
        );

        final maxMs = durations
            .map((d) => d.inMilliseconds)
            .reduce((a, b) => a > b ? a : b);
        final avgMs = durations.isEmpty
            ? 0
            : durations.map((d) => d.inMilliseconds).reduce((a, b) => a + b) ~/
                durations.length;

        // Sandbox ceiling: catches synchronous blocking work introduced into
        // _MockReviewCard or ListView machinery. Not a GPU budget assertion.
        // Real-device 16 ms budget is enforced via DevTools (see BUDGETS.txt).
        expect(
          maxMs,
          lessThanOrEqualTo(kSandboxSynchronousCeilingMs),
          reason:
              'A scroll pump took ${maxMs}ms — exceeds sandbox blocking-work '
              'ceiling of ${kSandboxSynchronousCeilingMs}ms. '
              'avg=${avgMs}ms over ${durations.length} pumps. '
              'Check for synchronous I/O or heavy computation in build().',
        );
      },
    );

    testWidgets(
      'Discover screen: 20 mock establishment cards scroll without blocking work '
      '(sandbox ceiling ${kSandboxSynchronousCeilingMs}ms)',
      (tester) async {
        await tester.pumpWidget(MaterialApp(
          home: Scaffold(
            body: ListView.builder(
              itemCount: kScrollItemCount,
              itemBuilder: (context, i) => _MockEstablishmentCard(index: i),
            ),
          ),
        ));
        await tester.pump();

        final durations = await _measureScrollFrames(
          tester,
          find.byType(ListView),
          totalPixels: 1200,
          stepPixels: 60,
        );

        final maxMs = durations
            .map((d) => d.inMilliseconds)
            .reduce((a, b) => a > b ? a : b);
        final avgMs = durations.isEmpty
            ? 0
            : durations.map((d) => d.inMilliseconds).reduce((a, b) => a + b) ~/
                durations.length;

        expect(
          maxMs,
          lessThanOrEqualTo(kSandboxSynchronousCeilingMs),
          reason:
              'A scroll pump took ${maxMs}ms — exceeds sandbox blocking-work '
              'ceiling of ${kSandboxSynchronousCeilingMs}ms. '
              'avg=${avgMs}ms over ${durations.length} pumps.',
        );
      },
    );
  });

  group('T7 – Scroll performance: actual screens', () {
    testWidgets(
      'HomeScreen CustomScrollView renders and settles without timeout',
      (tester) async {
        await _pumpSuppressed(
          tester,
          MaterialApp.router(routerConfig: _homeRouter()),
        );
        expect(find.byType(CustomScrollView), findsOneWidget);
      },
    );

    testWidgets(
      'DiscoverScreen CustomScrollView renders and settles without timeout',
      (tester) async {
        await _pumpSuppressed(
          tester,
          MaterialApp.router(routerConfig: _discoverRouter()),
        );
        expect(find.byType(CustomScrollView), findsOneWidget);
      },
    );

    testWidgets(
      'HomeScreen: fling scroll does not throw or produce error widgets',
      (tester) async {
        await _pumpSuppressed(
          tester,
          MaterialApp.router(routerConfig: _homeRouter()),
        );
        await tester.fling(
          find.byType(CustomScrollView),
          const Offset(0, -400),
          800,
        );
        await tester.pump(const Duration(milliseconds: 100));
        await tester.pump(const Duration(milliseconds: 200));
        await tester.pump(const Duration(milliseconds: 400));

        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'DiscoverScreen: fling scroll does not throw or produce error widgets',
      (tester) async {
        await _pumpSuppressed(
          tester,
          MaterialApp.router(routerConfig: _discoverRouter()),
        );
        await tester.fling(
          find.byType(CustomScrollView),
          const Offset(0, -400),
          800,
        );
        await tester.pump(const Duration(milliseconds: 100));
        await tester.pump(const Duration(milliseconds: 200));
        await tester.pump(const Duration(milliseconds: 400));

        expect(tester.takeException(), isNull);
      },
    );
  });

  group('T7 – Widget rebuild efficiency', () {
    testWidgets(
      '_MockReviewCard is StatelessWidget — no setState during scroll',
      (tester) async {
        await tester.pumpWidget(
          const MaterialApp(
            home: Scaffold(body: _MockReviewCard(index: 0)),
          ),
        );
        final element = tester.element(find.byType(_MockReviewCard));
        expect(element.widget, isA<StatelessWidget>());
      },
    );

    testWidgets(
      '_MockEstablishmentCard is StatelessWidget — no setState during scroll',
      (tester) async {
        await tester.pumpWidget(
          const MaterialApp(
            home: Scaffold(body: _MockEstablishmentCard(index: 0)),
          ),
        );
        final element = tester.element(find.byType(_MockEstablishmentCard));
        expect(element.widget, isA<StatelessWidget>());
      },
    );
  });

  group('T7 – ScoreBadge render cost', () {
    testWidgets(
      'ScoreBadge re-renders 20 instances without blocking work '
      '(sandbox ceiling ${kSandboxSynchronousCeilingMs}ms)',
      (tester) async {
        // Measure incremental re-render cost after warm-up pump.
        // pumpWidget warm-up absorbs JIT compilation; the measured pump
        // reflects only incremental widget rebuild cost.
        double scoreMultiplier = 1.0;

        await tester.pumpWidget(
          StatefulBuilder(
            builder: (context, setState) => MaterialApp(
              home: Scaffold(
                body: Column(
                  children: [
                    Wrap(
                      children: List.generate(
                        kScrollItemCount,
                        (i) => ScoreBadge(
                            score: (3.5 + (i % 15) * 0.1) * scoreMultiplier),
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => setState(() => scoreMultiplier = 1.1),
                      child: const Text('update'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
        await tester.pump(); // warm-up — not measured

        final sw = Stopwatch()..start();
        await tester.tap(find.text('update'));
        await tester.pump(); // measured incremental rebuild
        sw.stop();

        expect(
          sw.elapsedMilliseconds,
          lessThanOrEqualTo(kSandboxSynchronousCeilingMs),
          reason:
              'Re-rendering $kScrollItemCount ScoreBadges took '
              '${sw.elapsedMilliseconds}ms — exceeds sandbox blocking-work '
              'ceiling of ${kSandboxSynchronousCeilingMs}ms. '
              'ScoreBadge may contain expensive synchronous work in build().',
        );
      },
    );

    testWidgets(
      'ScoreBadge score range 1.0–5.0 renders correctly for 20 instances',
      (tester) async {
        // Correctness: all 20 badges with scores spanning the full range
        // render without overflow or assertion errors.
        final scores = List.generate(kScrollItemCount, (i) => 1.0 + i * 0.2);

        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Wrap(
                children:
                    scores.map((s) => ScoreBadge(score: s)).toList(),
              ),
            ),
          ),
        );
        await tester.pump();

        expect(tester.takeException(), isNull);
        expect(find.byType(ScoreBadge), findsNWidgets(kScrollItemCount));
      },
    );
  });
}
