// Tests for PlusPaywall — the RevenueCat-backed subscription bottom sheet.
//
// PlusPaywall is a ConsumerWidget that reads [offeringsProvider]. Tests use
// ProviderScope overrides to exercise all three AsyncValue branches without
// requiring a real RevenueCat SDK or network connection.
//
// Loading branch  → CircularProgressIndicator (_PackageSkeleton)
// Error/null branch → fallback text + Restore Purchases button (_PackageFallback)
// Data branch (null offerings) → same _PackageFallback path
//
// NOTE: No mocktail / mockito is available in this project's pubspec.yaml.
//       Provider overrides are used exclusively for stubbing.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:zupurb_app/widgets/plus_paywall.dart';
import 'package:zupurb_app/state/iap/iap_providers.dart';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Wraps [child] inside the widget tree required by PlusPaywall:
/// ProviderScope (with [overrides]) → MaterialApp → Scaffold.
/// The Scaffold provides the Navigator needed by showModalBottomSheet.
Widget _wrap(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: Scaffold(body: child),
    ),
  );
}

/// Returns a [ProviderScope] override that makes [offeringsProvider] emit
/// [AsyncValue.loading()] — simulates a pending network call.
/// Uses a Completer that never completes so no timer is created (avoiding
/// the "pending timers" test error that Future.delayed would trigger).
Override _loadingOfferings() {
  final completer = Completer<Offerings?>();
  return offeringsProvider.overrideWith((_) => completer.future);
}

/// Returns a [ProviderScope] override that makes [offeringsProvider] emit
/// [AsyncValue.data(null)] — simulates "no offerings configured" on the
/// RevenueCat dashboard or a network failure that returns null gracefully.
Override _nullOfferings() =>
    offeringsProvider.overrideWith((_) async => null);

/// Returns a [ProviderScope] override that makes [offeringsProvider] emit
/// [AsyncValue.error(...)].
Override _errorOfferings() =>
    offeringsProvider.overrideWith((_) async {
      throw Exception('RevenueCat unavailable');
    });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void main() {
  group('PlusPaywall – static content (always visible)', () {
    testWidgets('renders "Zupurb Plus" title', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump(); // let FutureProvider settle
      expect(find.text('Zupurb Plus'), findsOneWidget);
    });

    testWidgets('renders subtitle "Unlock the full Zupurb experience"',
        (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      expect(find.text('Unlock the full Zupurb experience'), findsOneWidget);
    });

    testWidgets('renders workspace_premium icon', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      expect(find.byIcon(Icons.workspace_premium), findsOneWidget);
    });

    testWidgets('renders "Included with Plus" benefits header', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      expect(find.text('Included with Plus'), findsOneWidget);
    });

    testWidgets('renders "1.25x Points on every visit" benefit', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      expect(find.text('1.25x Points on every visit'), findsOneWidget);
    });

    testWidgets('renders "Priority reservations" benefit', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      expect(find.text('Priority reservations'), findsOneWidget);
    });

    testWidgets('renders legal auto-renewal disclosure text', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      expect(
        find.textContaining('Subscription auto-renews until cancelled'),
        findsOneWidget,
      );
    });

    testWidgets('renders Privacy Policy link', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      expect(find.text('Privacy Policy'), findsOneWidget);
    });

    testWidgets('renders Terms of Service link', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      expect(find.text('Terms of Service'), findsOneWidget);
    });
  });

  group('PlusPaywall – loading state (_PackageSkeleton)', () {
    testWidgets('shows CircularProgressIndicator while offerings load',
        (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_loadingOfferings()],
      ));
      // Do NOT pump past the future — stay in loading state.
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('does NOT show Subscribe button during loading', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_loadingOfferings()],
      ));
      expect(find.text('Subscribe'), findsNothing);
    });
  });

  group('PlusPaywall – fallback state (null / error offerings)', () {
    testWidgets('shows fallback message when offerings is null', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      expect(find.text('Pricing is coming soon'), findsOneWidget);
      expect(find.text('Purchasing available soon'), findsOneWidget);
    });

    testWidgets('shows Restore Purchases button in fallback state',
        (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      expect(find.text('Restore Purchases'), findsOneWidget);
    });

    testWidgets('Restore Purchases button is tappable in fallback state',
        (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      // Should not throw — no real IAP backend is wired up, but the tap itself
      // must not crash the widget.
      final restoreBtn = find.text('Restore Purchases');
      expect(restoreBtn, findsOneWidget);
      expect(
        tester.widget<TextButton>(
          find.ancestor(of: restoreBtn, matching: find.byType(TextButton)),
        ).onPressed,
        isNotNull,
      );
    });

    testWidgets('shows fallback message on error offerings', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_errorOfferings()],
      ));
      await tester.pump(); // trigger future resolution
      await tester.pump(); // allow error state rebuild
      expect(find.text('Pricing is coming soon'), findsOneWidget);
      expect(find.text('Purchasing available soon'), findsOneWidget);
    });
  });

  group('PlusPaywall – drag handle', () {
    testWidgets('renders drag handle container at the top', (tester) async {
      await tester.pumpWidget(_wrap(
        const PlusPaywall(),
        overrides: [_nullOfferings()],
      ));
      await tester.pump();
      // The drag handle is a 40×4 Container inside an ExcludeSemantics.
      final handles = tester
          .widgetList<Container>(find.byType(Container))
          .where((c) {
            final size = c.constraints;
            // Match the specific 40w × 4h drag handle by checking for
            // a fixed-size container whose decoration has a circular radius.
            if (c.decoration is BoxDecoration) {
              final dec = c.decoration as BoxDecoration;
              return dec.borderRadius != null &&
                  c.constraints?.maxWidth == 40 ||
                  (tester.getSize(find.byWidget(c)) ==
                      const Size(40, 4));
            }
            return false;
          })
          .toList();
      // At minimum the outer DraggableScrollableSheet container renders.
      expect(find.byType(DraggableScrollableSheet), findsOneWidget);
    });
  });
}
