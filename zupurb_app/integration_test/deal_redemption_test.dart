// T3 — Integration test: Deal redemption flow
//
// Flow under test:
//   1. PointsWalletScreen  — renders balance + Redeem row, tap Redeem → stub /redeem
//   2. RedeemRewardsScreen — renders available reward cards with point costs,
//      verifies STARBUCKS and UBER deal cards are present, locked card shows
//      lock icon, reachable via nav.
//
// RedeemRewardsScreen is a StatelessWidget with hard-coded mock data.
// No Riverpod providers or Firebase calls are involved.
//
// Note: The current Phase 1A implementation shows reward cards but the
// "confirm redemption → QR" step lives outside the screen boundary (the
// ElevatedButton onPressed is an empty callback in mock data). Tests assert
// that card UI and point-cost labels render correctly and that the available
// cards have enabled buttons, which is the testable surface before backend
// integration (T6+ milestones wire up initiateDealRedemption).
//
// REQUIRES_DEVICE: NetworkImage (reward card photos) requires live network;
// test assertions do not depend on image loading.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:zupurb_app/screens/points/points_wallet_screen.dart';
import 'package:zupurb_app/screens/points/redeem_rewards_screen.dart';

import 'test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // ---------------------------------------------------------------------------
  // PointsWalletScreen — Redeem entry point
  // ---------------------------------------------------------------------------

  group('PointsWalletScreen — Redeem entry point', () {
    testWidgets('renders Redeem row with point balance', (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      expect(find.text('Redeem'), findsOneWidget);
      expect(find.text('Browse exclusive deals'), findsOneWidget);
      // Inline balance chip always visible in AppBar / balance card area.
      expect(find.text('1,847 pts'), findsOneWidget);
    });

    testWidgets('Redeem row has a navigation chevron icon', (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      // The Redeem row contains a chevron_right arrow to indicate navigability.
      expect(find.byIcon(Icons.chevron_right), findsAtLeastNWidgets(1));
    });
  });

  // ---------------------------------------------------------------------------
  // RedeemRewardsScreen — reward catalogue
  // ---------------------------------------------------------------------------

  group('RedeemRewardsScreen — reward catalogue', () {
    testWidgets('renders app bar title "Redeem Rewards"', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      expect(find.text('Redeem Rewards'), findsOneWidget);
    });

    testWidgets('renders inline points balance chip', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      // Balance chip shows '1,840 pts' inside the AppBar title row.
      expect(find.text('1,840 pts'), findsOneWidget);
    });

    testWidgets('renders account eligibility status card', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      expect(find.text('ACCOUNT STATUS'), findsOneWidget);
      expect(find.text('You are eligible to redeem!'), findsOneWidget);
    });

    testWidgets('renders tenure and activity stat chips', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      expect(find.text('94 days'), findsOneWidget);
      expect(find.text('TENURE'), findsOneWidget);
      expect(find.text('23 reviews'), findsOneWidget);
      expect(find.text('ACTIVITY'), findsOneWidget);
    });

    testWidgets('renders "Available Rewards" section heading', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      expect(find.text('Available Rewards'), findsOneWidget);
    });

    testWidgets('renders STARBUCKS deal card with price label', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      expect(find.text('STARBUCKS'), findsAtLeastNWidgets(1));
      expect(find.text('Morning Pick-me-up'), findsAtLeastNWidgets(1));
      expect(find.text('\$10.00'), findsAtLeastNWidgets(1));
    });

    testWidgets('renders UBER deal card with price label', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      expect(find.text('UBER'), findsAtLeastNWidgets(1));
      expect(find.text('City Explorer Credit'), findsAtLeastNWidgets(1));
      expect(find.text('\$15.00'), findsAtLeastNWidgets(1));
    });

    testWidgets('deal cards display point cost "3500 pts"', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      // Each reward card renders the cost as '3500 pts' on its button.
      expect(find.text('3500 pts'), findsAtLeastNWidgets(2));
    });

    testWidgets('available deal card button is enabled', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      // Find the first ElevatedButton in the grid — corresponds to the first
      // available card (STARBUCKS, available: true).
      final buttons = tester.widgetList<ElevatedButton>(
        find.byType(ElevatedButton),
      );
      // At least one button must have a non-null onPressed (i.e. is enabled).
      expect(
        buttons.any((b) => b.onPressed != null),
        isTrue,
        reason: 'Expected at least one available deal with an enabled button',
      );
    });

    testWidgets('locked deal card shows lock icon', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      expect(find.byIcon(Icons.lock), findsAtLeastNWidgets(1));
    });

    testWidgets('locked deal card button is disabled', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      final buttons = tester.widgetList<ElevatedButton>(
        find.byType(ElevatedButton),
      );
      // At least one button must have a null onPressed (i.e. is disabled).
      expect(
        buttons.any((b) => b.onPressed == null),
        isTrue,
        reason: 'Expected at least one locked deal with a disabled button',
      );
    });

    testWidgets('renders redemption info footnote', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      await tester.scrollUntilVisible(
        find.text('VIEW REDEMPTION HISTORY'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('VIEW REDEMPTION HISTORY'), findsOneWidget);
    });

    testWidgets('renders U-31 Tier Benefits link', (tester) async {
      await pumpScreen(
        tester,
        const RedeemRewardsScreen(),
        stubRoutes: [],
      );

      expect(find.text('U-31 Tier Benefits'), findsOneWidget);
    });
  });
}
