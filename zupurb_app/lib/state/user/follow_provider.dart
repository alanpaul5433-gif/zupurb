import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists which users the current user follows, locally on the device, so the
/// follow state survives app restarts. Mirrors review_likes_provider.dart.
const _kFollowedUserIdsKey = 'followed_user_ids';

class FollowNotifier extends Notifier<Set<String>> {
  bool _loaded = false;

  @override
  Set<String> build() {
    _load();
    return <String>{};
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    if (_loaded) return; // a toggle already initialised state; don't clobber it
    state = (prefs.getStringList(_kFollowedUserIdsKey) ?? const <String>[]).toSet();
    _loaded = true;
  }

  bool isFollowing(String userId) => state.contains(userId);

  Future<void> toggle(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    if (!_loaded) {
      state = (prefs.getStringList(_kFollowedUserIdsKey) ?? const <String>[]).toSet();
      _loaded = true;
    }
    final next = Set<String>.from(state);
    if (!next.add(userId)) next.remove(userId);
    state = next;
    await prefs.setStringList(_kFollowedUserIdsKey, next.toList());
  }
}

final followProvider =
    NotifierProvider<FollowNotifier, Set<String>>(FollowNotifier.new);
