/// Unit tests for lib/state/user/follow_provider.dart
///
/// FollowNotifier persists the set of followed user ids in SharedPreferences,
/// so it is fully unit-testable with SharedPreferences.setMockInitialValues
/// (no Firebase needed). Covers:
///   - default state is empty; isFollowing → false
///   - toggle() adds an id (isFollowing true) and persists it
///   - toggle() the same id again removes it and clears persistence
///   - toggling several distinct ids accumulates them
///   - preloaded ids are restored on build (_load)
///   - state survives a "restart" (a fresh notifier re-reads persisted ids)
///   - toggle() before _load resolves merges with — does not clobber —
///     the persisted set (the `_loaded` guard)
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:zupurb_app/state/user/follow_provider.dart';

const _kKey = 'followed_user_ids';

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    // Drop any cached SharedPreferences instance so each test re-reads the
    // mock store set below (otherwise the static cache leaks across tests).
    SharedPreferences.resetStatic();
  });

  group('empty start', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    test('initial state is an empty set; isFollowing is false', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(followProvider), isEmpty);
      expect(
        container.read(followProvider.notifier).isFollowing('u1'),
        isFalse,
      );
    });

    test('toggle adds an id, reports following, and persists it', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(followProvider.notifier);

      await notifier.toggle('u1');

      expect(notifier.isFollowing('u1'), isTrue);
      expect(container.read(followProvider), {'u1'});
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getStringList(_kKey), ['u1']);
    });

    test('toggling the same id twice removes it and clears persistence',
        () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(followProvider.notifier);

      await notifier.toggle('u1');
      await notifier.toggle('u1');

      expect(notifier.isFollowing('u1'), isFalse);
      expect(container.read(followProvider), isEmpty);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getStringList(_kKey), isEmpty);
    });

    test('toggling several distinct ids accumulates them', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(followProvider.notifier);

      await notifier.toggle('a');
      await notifier.toggle('b');
      await notifier.toggle('c');

      expect(container.read(followProvider), {'a', 'b', 'c'});
    });
  });

  group('persistence', () {
    test('restores previously followed ids on build', () async {
      SharedPreferences.setMockInitialValues({
        _kKey: <String>['x', 'y'],
      });
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(followProvider); // force build → schedules _load
      await Future<void>.delayed(Duration.zero); // let _load resolve

      expect(container.read(followProvider), {'x', 'y'});
      expect(
        container.read(followProvider.notifier).isFollowing('x'),
        isTrue,
      );
    });

    test('state survives a restart (fresh notifier re-reads persisted ids)',
        () async {
      SharedPreferences.setMockInitialValues({});

      final c1 = ProviderContainer();
      await c1.read(followProvider.notifier).toggle('keep');
      c1.dispose();

      // A new container == app restart; the SharedPreferences store is shared.
      final c2 = ProviderContainer();
      addTearDown(c2.dispose);
      c2.read(followProvider);
      await Future<void>.delayed(Duration.zero);

      expect(c2.read(followProvider), {'keep'});
    });

    test('toggle before _load resolves merges with the persisted set',
        () async {
      SharedPreferences.setMockInitialValues({
        _kKey: <String>['persisted'],
      });
      final container = ProviderContainer();
      addTearDown(container.dispose);

      // Read the notifier (build schedules _load) and toggle immediately,
      // before _load has resolved. The `_loaded` guard must ensure the
      // persisted id is not clobbered.
      final notifier = container.read(followProvider.notifier);
      await notifier.toggle('new');

      expect(container.read(followProvider), {'persisted', 'new'});
      final prefs = await SharedPreferences.getInstance();
      expect(
        prefs.getStringList(_kKey),
        containsAll(<String>['persisted', 'new']),
      );
    });
  });
}
