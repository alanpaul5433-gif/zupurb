// T3 — Integration test: Points wallet display
//
// Verifies that PointsWalletScreen renders:
//   - Total balance card (1,847 pts / $5.54 value)
//   - Points expiry warning banner
//   - Recent Activity section with transaction list items
//   - Action cards (Buy Points, Gift a Deal, Redeem)
//   - Elite Tier Status upgrade card
//
// PointsWalletScreen is a StatelessWidget with hard-coded mock data.
// No Riverpod providers or Firebase calls are involved.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:zupurb_app/screens/points/points_wallet_screen.dart';

import 'test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('PointsWalletScreen — balance and transaction display', () {
    testWidgets('renders total balance', (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      expect(find.text('TOTAL BALANCE'), findsOneWidget);
      expect(find.text('1,847 pts'), findsOneWidget);
      expect(find.text('\$5.54 value'), findsOneWidget);
    });

    testWidgets('renders points expiry warning banner', (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      expect(find.text('Points Expiring Soon'), findsOneWidget);
    });

    testWidgets('renders Redeem row with navigation chevron', (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      expect(find.text('Redeem'), findsOneWidget);
      expect(find.text('Browse exclusive deals'), findsOneWidget);
    });

    testWidgets('renders action cards: Buy Points and Gift a Deal', (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      expect(find.text('Buy Points'), findsOneWidget);
      expect(find.text('Gift a Deal'), findsOneWidget);
    });

    testWidgets('renders Recent Activity heading', (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      await tester.scrollUntilVisible(
        find.text('Recent Activity'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('Recent Activity'), findsOneWidget);
    });

    testWidgets('renders transaction history items', (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      await tester.scrollUntilVisible(
        find.text('Verified review'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('Verified review'), findsOneWidget);
      expect(find.text('+80'), findsOneWidget);

      await tester.scrollUntilVisible(
        find.text('Deal redeemed'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('Deal redeemed'), findsOneWidget);
      expect(find.text('-3,500'), findsOneWidget);

      await tester.scrollUntilVisible(
        find.text('Referral Bonus'),
        200,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('Referral Bonus'), findsOneWidget);
      expect(find.text('+500'), findsOneWidget);
    });

    testWidgets('renders Elite Tier Status card', (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      await tester.scrollUntilVisible(
        find.text('Elite Tier Status'),
        300,
        scrollable: find.byType(Scrollable).first,
      );

      expect(find.text('Elite Tier Status'), findsOneWidget);
      expect(find.text('Upgrade Now'), findsOneWidget);
    });

    testWidgets('Points Wallet screen has correct app bar title', (tester) async {
      await pumpScreen(
        tester,
        const PointsWalletScreen(),
        stubRoutes: ['/redeem'],
      );

      expect(find.text('Points Wallet'), findsOneWidget);
    });
  });
}
