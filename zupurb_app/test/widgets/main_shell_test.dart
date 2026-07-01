/// Widget tests for lib/widgets/main_shell.dart
/// MainShell is a StatelessWidget shell that renders the routed child + a 5-item
/// bottom nav wired to go_router. Tests mount it inside a minimal GoRouter
/// ShellRoute and assert: nav items + child render, the active item tracks the
/// location, and tapping a nav item navigates (context.go) to the right route.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:zupurb_app/models/user_profile.dart';
import 'package:zupurb_app/state/user/user_profile_provider.dart';
import 'package:zupurb_app/widgets/main_shell.dart';

import '../helpers/test_app_harness.dart';

const _profile = UserProfile(
  uid: 'u1',
  displayName: 'Test User',
  followersCount: 0,
  followingCount: 0,
  reviewCount: 0,
  pointsBalance: 0,
  loyaltyTier: 'bronze',
  onboardingComplete: true,
);

GoRouter _router() => GoRouter(
      initialLocation: '/home',
      routes: [
        ShellRoute(
          builder: (_, _, child) => MainShell(child: child),
          routes: [
            GoRoute(
                path: '/home',
                builder: (_, _) => const Center(child: Text('HOME-BODY'))),
            GoRoute(
                path: '/search',
                builder: (_, _) => const Center(child: Text('SEARCH-BODY'))),
            GoRoute(
                path: '/discover',
                builder: (_, _) => const Center(child: Text('DISCOVER-BODY'))),
            GoRoute(
                path: '/messages',
                builder: (_, _) => const Center(child: Text('MESSAGES-BODY'))),
            GoRoute(
                path: '/profile',
                builder: (_, _) => const Center(child: Text('PROFILE-BODY'))),
          ],
        ),
      ],
    );

Future<void> _pump(WidgetTester tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...firebaseNeutralisingOverrides(),
        userProfileProvider.overrideWith((ref) => Stream.value(_profile)),
      ],
      child: MaterialApp.router(routerConfig: _router()),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async => setUpTestFirebase());

  group('MainShell', () {
    testWidgets('renders the five bottom-nav items', (tester) async {
      await _pump(tester);
      expect(find.text('Home'), findsOneWidget);
      expect(find.text('Search'), findsOneWidget);
      expect(find.text('Discover'), findsOneWidget);
      expect(find.text('Messages'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);
    });

    testWidgets('renders the routed child body', (tester) async {
      await _pump(tester);
      expect(find.text('HOME-BODY'), findsOneWidget);
    });

    testWidgets('Home is the active tab at /home (filled icon)',
        (tester) async {
      await _pump(tester);
      // Active tab uses the filled icon; inactive tabs use the *_outlined icon.
      expect(find.byIcon(Icons.home), findsOneWidget);
      expect(find.byIcon(Icons.search_outlined), findsOneWidget);
      expect(find.byIcon(Icons.search), findsNothing);
    });

    testWidgets('tapping Search navigates and updates the active tab',
        (tester) async {
      await _pump(tester);

      await tester.tap(find.text('Search'));
      await tester.pumpAndSettle();

      expect(find.text('SEARCH-BODY'), findsOneWidget);
      expect(find.text('HOME-BODY'), findsNothing);
      // Search now active (filled), Home inactive (outlined).
      expect(find.byIcon(Icons.search), findsOneWidget);
      expect(find.byIcon(Icons.home_outlined), findsOneWidget);
      expect(find.byIcon(Icons.home), findsNothing);
    });

    testWidgets('tapping Discover navigates to the discover route',
        (tester) async {
      await _pump(tester);

      await tester.tap(find.text('Discover'));
      await tester.pumpAndSettle();

      expect(find.text('DISCOVER-BODY'), findsOneWidget);
      expect(find.byIcon(Icons.explore), findsOneWidget); // active filled icon
    });
  });
}
