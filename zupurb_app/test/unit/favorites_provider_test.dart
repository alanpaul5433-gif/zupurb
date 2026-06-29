/// Unit tests for lib/state/favorites/favorites_provider.dart
///
/// FavoritesNotifier persists favourited establishment ids to SharedPreferences
/// (a seam with a built-in test mock — `SharedPreferences.setMockInitialValues`),
/// so it is genuinely unit-testable without Firestore. Covers:
///   - build() seeds empty, then asynchronously loads stored ids
///   - isFavorite reflects current state
///   - toggle adds, then removes (idempotent flip), and persists each time
///   - an early toggle (before the build-time load resolves) seeds from disk
///     first so it never clobbers stored ids
///   - distinct ids accumulate and persist
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zupurb_app/state/favorites/favorites_provider.dart';

const _kKey = 'favorite_establishment_ids';

Future<List<String>?> _stored() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getStringList(_kKey);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  ProviderContainer makeContainer() {
    final c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  group('FavoritesNotifier', () {
    test('build() starts empty when nothing is stored', () {
      SharedPreferences.setMockInitialValues({});
      final c = makeContainer();
      expect(c.read(favoritesProvider), isEmpty);
    });

    test('asynchronously loads stored ids on build', () async {
      SharedPreferences.setMockInitialValues({
        _kKey: ['est-1', 'est-2'],
      });
      final c = makeContainer();
      // First read is the synchronous empty seed.
      expect(c.read(favoritesProvider), isEmpty);

      // Let the fire-and-forget _load() resolve.
      await pumpEventQueue();

      expect(c.read(favoritesProvider), {'est-1', 'est-2'});
      expect(c.read(favoritesProvider.notifier).isFavorite('est-1'), isTrue);
      expect(c.read(favoritesProvider.notifier).isFavorite('nope'), isFalse);
    });

    test('toggle adds a favourite and persists it', () async {
      SharedPreferences.setMockInitialValues({});
      final c = makeContainer();
      final n = c.read(favoritesProvider.notifier);

      await n.toggle('est-A');

      expect(c.read(favoritesProvider), {'est-A'});
      expect(n.isFavorite('est-A'), isTrue);
      expect(await _stored(), ['est-A']);
    });

    test('toggling the same id twice removes it and persists empty', () async {
      SharedPreferences.setMockInitialValues({});
      final c = makeContainer();
      final n = c.read(favoritesProvider.notifier);

      await n.toggle('est-A');
      await n.toggle('est-A');

      expect(c.read(favoritesProvider), isEmpty);
      expect(n.isFavorite('est-A'), isFalse);
      expect(await _stored(), isEmpty);
    });

    test('an early toggle seeds from disk and does not clobber stored ids',
        () async {
      SharedPreferences.setMockInitialValues({
        _kKey: ['stored-1'],
      });
      final c = makeContainer();
      // Toggle immediately (before awaiting the build-time load) to exercise
      // the seed-from-disk guard inside toggle().
      await c.read(favoritesProvider.notifier).toggle('new-2');

      expect(c.read(favoritesProvider), {'stored-1', 'new-2'});
      expect((await _stored())!.toSet(), {'stored-1', 'new-2'});
    });

    test('distinct ids accumulate and persist', () async {
      SharedPreferences.setMockInitialValues({});
      final c = makeContainer();
      final n = c.read(favoritesProvider.notifier);

      await n.toggle('a');
      await n.toggle('b');
      await n.toggle('c');

      expect(c.read(favoritesProvider), {'a', 'b', 'c'});
      expect((await _stored())!.toSet(), {'a', 'b', 'c'});
    });
  });
}
