/// Unit tests for lib/state/reviews/review_likes_provider.dart
///
/// ReviewLikesNotifier persists liked review ids to SharedPreferences (a seam
/// with a built-in test mock — `SharedPreferences.setMockInitialValues`), so it
/// is genuinely unit-testable without Firestore. Covers:
///   - build() starts empty, then loads stored ids asynchronously
///   - isLiked reflects current state
///   - toggle adds, then removes (idempotent flip), and persists each time
///   - an early toggle seeds from disk first so it never clobbers stored ids
///   - distinct ids accumulate
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zupurb_app/state/reviews/review_likes_provider.dart';

const _kKey = 'liked_review_ids';

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

  group('ReviewLikesNotifier', () {
    test('build() starts empty when nothing is stored', () {
      SharedPreferences.setMockInitialValues({});
      final c = makeContainer();
      expect(c.read(reviewLikesProvider), isEmpty);
    });

    test('asynchronously loads stored ids on build', () async {
      SharedPreferences.setMockInitialValues({
        _kKey: ['r1', 'r2'],
      });
      final c = makeContainer();
      // First read is the synchronous empty seed.
      expect(c.read(reviewLikesProvider), isEmpty);

      // Let the fire-and-forget _load() resolve.
      await pumpEventQueue();

      expect(c.read(reviewLikesProvider), {'r1', 'r2'});
      expect(c.read(reviewLikesProvider.notifier).isLiked('r1'), isTrue);
      expect(c.read(reviewLikesProvider.notifier).isLiked('nope'), isFalse);
    });

    test('toggle adds a like and persists it', () async {
      SharedPreferences.setMockInitialValues({});
      final c = makeContainer();
      final n = c.read(reviewLikesProvider.notifier);

      await n.toggle('rev-A');

      expect(c.read(reviewLikesProvider), {'rev-A'});
      expect(n.isLiked('rev-A'), isTrue);
      expect(await _stored(), ['rev-A']);
    });

    test('toggling the same id twice removes it and persists empty', () async {
      SharedPreferences.setMockInitialValues({});
      final c = makeContainer();
      final n = c.read(reviewLikesProvider.notifier);

      await n.toggle('rev-A');
      await n.toggle('rev-A');

      expect(c.read(reviewLikesProvider), isEmpty);
      expect(n.isLiked('rev-A'), isFalse);
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
      await c.read(reviewLikesProvider.notifier).toggle('new-2');

      expect(c.read(reviewLikesProvider), {'stored-1', 'new-2'});
      expect((await _stored())!.toSet(), {'stored-1', 'new-2'});
    });

    test('distinct ids accumulate', () async {
      SharedPreferences.setMockInitialValues({});
      final c = makeContainer();
      final n = c.read(reviewLikesProvider.notifier);

      await n.toggle('a');
      await n.toggle('b');
      await n.toggle('c');

      expect(c.read(reviewLikesProvider), {'a', 'b', 'c'});
      expect((await _stored())!.toSet(), {'a', 'b', 'c'});
    });
  });
}
