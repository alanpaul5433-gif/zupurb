import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists which establishments the user has favourited, locally on the device,
/// so favourites survive app restarts. Mirrors review_likes_provider.dart.
const _kFavoriteEstablishmentsKey = 'favorite_establishment_ids';

class FavoritesNotifier extends Notifier<Set<String>> {
  bool _loaded = false;

  @override
  Set<String> build() {
    _load();
    return <String>{};
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    if (_loaded) return; // a toggle already initialised state; don't clobber it
    state = (prefs.getStringList(_kFavoriteEstablishmentsKey) ?? const <String>[]).toSet();
    _loaded = true;
  }

  bool isFavorite(String id) => state.contains(id);

  Future<void> toggle(String id) async {
    final prefs = await SharedPreferences.getInstance();
    if (!_loaded) {
      // Seed from disk before mutating so an early tap doesn't drop stored data.
      state = (prefs.getStringList(_kFavoriteEstablishmentsKey) ?? const <String>[]).toSet();
      _loaded = true;
    }
    final next = Set<String>.from(state);
    if (!next.add(id)) next.remove(id);
    state = next;
    await prefs.setStringList(_kFavoriteEstablishmentsKey, next.toList());
  }
}

final favoritesProvider =
    NotifierProvider<FavoritesNotifier, Set<String>>(FavoritesNotifier.new);
