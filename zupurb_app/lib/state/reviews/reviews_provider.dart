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
