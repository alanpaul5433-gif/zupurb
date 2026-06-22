import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/review_comment.dart';

/// Live stream of comments for a review, oldest first.
final reviewCommentsProvider =
    StreamProvider.family<List<ReviewComment>, String>((ref, reviewId) {
  return FirebaseFirestore.instance
      .collection('reviews')
      .doc(reviewId)
      .collection('comments')
      .orderBy('createdAt', descending: false)
      .limit(200)
      .snapshots()
      .map((s) => s.docs.map(ReviewComment.fromFirestore).toList());
});

/// Adds a comment to a review. Throws if not signed in.
Future<void> addReviewComment(String reviewId, String text) async {
  final user = FirebaseAuth.instance.currentUser;
  if (user == null) throw StateError('not-signed-in');
  final trimmed = text.trim();
  if (trimmed.isEmpty) return;
  await FirebaseFirestore.instance
      .collection('reviews')
      .doc(reviewId)
      .collection('comments')
      .add({
    'reviewId': reviewId,
    'authorUid': user.uid,
    'authorName': (user.displayName?.isNotEmpty == true) ? user.displayName : 'Anonymous',
    'authorPhotoUrl': user.photoURL ?? '',
    'text': trimmed.length > 1000 ? trimmed.substring(0, 1000) : trimmed,
    'createdAt': FieldValue.serverTimestamp(),
  });
}
