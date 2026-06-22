import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/review.dart';

/// Stream of recent published reviews from the flat reviews collection.
final recentReviewsProvider = StreamProvider<List<Review>>((ref) {
  return FirebaseFirestore.instance
      .collection('reviews')
      .where('status', isEqualTo: 'published')
      .limit(10)
      .snapshots()
      .map((snap) => snap.docs.map(Review.fromFirestore).toList());
});

/// Fuller community feed of all users' published reviews — powers the Home
/// "Feed" tab. Same query as recentReviewsProvider with a higher limit.
final feedReviewsProvider = StreamProvider<List<Review>>((ref) {
  return FirebaseFirestore.instance
      .collection('reviews')
      .where('status', isEqualTo: 'published')
      .limit(25)
      .snapshots()
      .map((snap) => snap.docs.map(Review.fromFirestore).toList());
});

/// Stream of a user's own reviews (for profile Reviews tabs). Reads the flat
/// `reviews` collection by authorUid (composite index authorUid+createdAt exists).
final reviewsByAuthorProvider =
    StreamProvider.family<List<Review>, String>((ref, uid) {
  return FirebaseFirestore.instance
      .collection('reviews')
      .where('authorUid', isEqualTo: uid)
      .orderBy('createdAt', descending: true)
      .limit(50)
      .snapshots()
      .map((snap) => snap.docs
          .map((d) => Review.fromAuthoredDoc(d))
          .where((r) => r.status != 'removed' && r.status != 'quarantined')
          .toList());
});

/// Stream of reviews in an establishment's subcollection.
final establishmentReviewsProvider =
    StreamProvider.family<List<Review>, String>((ref, estId) {
  return FirebaseFirestore.instance
      .collection('establishments')
      .doc(estId)
      .collection('reviews')
      .limit(10)
      .snapshots()
      .map((snap) => snap.docs.map(Review.fromFirestore).toList());
});
