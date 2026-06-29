/// Widget tests for lib/widgets/favorite_heart_button.dart
/// FavoriteHeartButton is a ConsumerWidget that watches the REAL (SharedPrefs-
/// backed) favoritesProvider: empty heart when not favourited, filled when it
/// is, and tapping toggles + persists. Uses SharedPreferences mock values with
/// resetStatic() in setUp so prefs state never leaks between tests in the isolate.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zupurb_app/widgets/favorite_heart_button.dart';
import 'package:zupurb_app/state/favorites/favorites_provider.dart';

/// Persisted-shape constant mirrored from favorites_provider.dart.
const _kFavoritesKey = 'favorite_establishment_ids';
const _id = 'est-42';

/// Pumps the button inside an explicit container so tests can both render the
/// widget and read provider state directly.
Future<ProviderContainer> _pump(
  WidgetTester tester, {
  String establishmentId = _id,
  bool showSnackBar = false,
}) async {
  final container = ProviderContainer();
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        home: Scaffold(
          body: Center(
            child: FavoriteHeartButton(
              establishmentId: establishmentId,
              showSnackBar: showSnackBar,
            ),
          ),
        ),
      ),
    ),
  );
  // Let the notifier's fire-and-forget _load() resolve and rebuild.
  await tester.pumpAndSettle();
  return container;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    // CRITICAL: without resetStatic() the cached SharedPreferences instance (and
    // its in-memory store) leaks across tests in the same isolate.
    SharedPreferences.resetStatic();
    SharedPreferences.setMockInitialValues({});
  });

  group('FavoriteHeartButton — rendering', () {
    testWidgets('shows empty heart when the venue is not favourited',
        (tester) async {
      await _pump(tester);
      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
      expect(find.byIcon(Icons.favorite), findsNothing);
    });

    testWidgets('shows filled heart when the venue is favourited (seeded prefs)',
        (tester) async {
      SharedPreferences.setMockInitialValues({
        _kFavoritesKey: [_id],
      });
      final container = await _pump(tester);
      expect(find.byIcon(Icons.favorite), findsOneWidget);
      expect(find.byIcon(Icons.favorite_border), findsNothing);
      expect(container.read(favoritesProvider), contains(_id));
    });

    testWidgets('seeded id for a DIFFERENT venue -> this heart stays empty',
        (tester) async {
      SharedPreferences.setMockInitialValues({
        _kFavoritesKey: ['some-other-venue'],
      });
      await _pump(tester);
      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
    });

    testWidgets('exposes an accessible button semantics label', (tester) async {
      await _pump(tester);
      expect(
        tester
            .widget<Semantics>(find
                .descendant(
                  of: find.byType(FavoriteHeartButton),
                  matching: find.byType(Semantics),
                )
                .first)
            .properties
            .label,
        'Add to favourites',
      );
    });
  });

  group('FavoriteHeartButton — toggle', () {
    testWidgets('tapping flips empty -> filled and persists', (tester) async {
      final container = await _pump(tester);
      expect(find.byIcon(Icons.favorite_border), findsOneWidget);

      await tester.tap(find.byType(FavoriteHeartButton));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.favorite), findsOneWidget);
      expect(find.byIcon(Icons.favorite_border), findsNothing);
      expect(container.read(favoritesProvider), {_id});

      // Persisted to SharedPreferences.
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getStringList(_kFavoritesKey), [_id]);
    });

    testWidgets('tapping twice flips back to empty (idempotent)',
        (tester) async {
      final container = await _pump(tester);

      await tester.tap(find.byType(FavoriteHeartButton));
      await tester.pumpAndSettle();
      expect(container.read(favoritesProvider), {_id});

      await tester.tap(find.byType(FavoriteHeartButton));
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.favorite_border), findsOneWidget);
      expect(container.read(favoritesProvider), isEmpty);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getStringList(_kFavoritesKey), isEmpty);
    });

    testWidgets('shows a snackbar when showSnackBar is true', (tester) async {
      await _pump(tester, showSnackBar: true);

      await tester.tap(find.byType(FavoriteHeartButton));
      await tester.pump(); // build the snackbar + start the async toggle
      expect(find.text('Added to favourites'), findsOneWidget);

      // Let the toggle settle and the 1s snackbar timer drain so no timers leak.
      await tester.pumpAndSettle(const Duration(seconds: 2));
    });
  });
}
