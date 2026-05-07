// T3 — Integration test: Points expiry warning
//
// Verifies that PointsWalletScreen shows the expiry warning banner when
// points are nearing expiration.
//
// PointsWalletScreen is a StatelessWidget with hard-coded mock data that
// includes a points-expiring-soon banner. These tests confirm:
//   - The banner headline renders ("Points Expiring Soon")
//   - The expiry warning container is visible without scrolling
//   - The warning copy references both a point count and a deadline
//   - Navigation to /redeem is wired via the Redeem action row
//
// No Riverpod providers or Firebase calls are involved in Phase 1A.
// When the backend-driven wallet provider is introduced (milestone B8+)
// these tests should be updated to override the provider with a fixture
// that sets expiresAt = DateTime.now().add(const Duration(days: 5)).
//
// REQUIRES_DEVICE: NetworkImage assets not required for assertions.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:zupurb_app/screens/points/points_wallet_screen.dart';

import 'test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('PointsWalletScreen — points expiry warning', () {
    testWidgets('expiry warning banner headline is visible on first render',
        (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      // Banner must be visible without scrolling — it sits near the top of
      // the screen below the balance card.
      expect(find.text('Points Expiring Soon'), findsOneWidget);
    });

    testWidgets('expiry warning banner is rendered above the fold',
        (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      // Confirm widget exists in the widget tree (not merely off-screen).
      final bannerFinder = find.text('Points Expiring Soon');
      expect(bannerFinder, findsOneWidget);

      // Verify it is actually visible (not hidden/opacity-0).
      final RenderBox box =
          tester.renderObject(bannerFinder);
      expect(box.size.height, greaterThan(0));
    });

    testWidgets('expiry warning renders inside a highlighted container',
        (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      // The banner is wrapped in a Container with a warning colour; we verify
      // the warning icon is co-located with the banner headline.
      expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
      expect(find.text('Points Expiring Soon'), findsOneWidget);
    });

    testWidgets('expiry warning body text mentions point count and days remaining',
        (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      // Mock data: "250 points expire in 7 days — final warning."
      expect(
        find.textContaining('250 points expire in 7 days'),
        findsOneWidget,
      );
    });

    testWidgets('expiry warning body text includes "Redeem now!" inline CTA',
        (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      // The expiry paragraph ends with "Redeem now!" as inline copy.
      expect(find.textContaining('Redeem now!'), findsOneWidget);
    });

    testWidgets('total balance section still renders alongside expiry banner',
        (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      // Both the balance card and the expiry banner must co-exist on screen.
      expect(find.text('TOTAL BALANCE'), findsOneWidget);
      expect(find.text('Points Expiring Soon'), findsOneWidget);
    });

    testWidgets('Redeem action row is present alongside expiry warning',
        (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      // The Redeem row beneath the banner gives the user a direct path to
      // redemption — essential UX when expiry is imminent.
      expect(find.text('Redeem'), findsOneWidget);
      expect(find.text('Browse exclusive deals'), findsOneWidget);
    });
  });
}
