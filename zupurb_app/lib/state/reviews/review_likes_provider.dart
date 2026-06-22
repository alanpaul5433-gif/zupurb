import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists which reviews the user has liked, locally on the device, so a
/// "like" survives app restarts. (Local-first; a backend sync can replace this
/// later without changing call sites.)
const _kLikedReviewsKey = 'liked_review_ids';

class ReviewLikesNotifier extends Notifier<Set<String>> {
  bool _loaded = false;

  @override
  Set<String> build() {
    // Kick off the async load; state starts empty and updates when it resolves.
    _load();
    return <String>{};
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    if (_loaded) return; // a toggle already initialised state; don't clobber it
    state = (prefs.getStringList(_kLikedReviewsKey) ?? const <String>[]).toSet();
    _loaded = true;
  }

  bool isLiked(String reviewId) => state.contains(reviewId);

  /// Toggles the like for [reviewId] and persists the new set.
  Future<void> toggle(String reviewId) async {
    final prefs = await SharedPreferences.getInstance();
    if (!_loaded) {
      // Seed from disk before mutating so an early tap doesn't drop stored data.
      state = (prefs.getStringList(_kLikedReviewsKey) ?? const <String>[]).toSet();
      _loaded = true;
    }
    final next = Set<String>.from(state);
    if (!next.add(reviewId)) next.remove(reviewId); // add returns false if present
    state = next;
    await prefs.setStringList(_kLikedReviewsKey, next.toList());
  }
}

final reviewLikesProvider =
    NotifierProvider<ReviewLikesNotifier, Set<String>>(ReviewLikesNotifier.new);
