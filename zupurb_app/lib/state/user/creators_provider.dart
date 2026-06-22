import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/user_profile.dart';

/// Streams the users collection (creators + members) for the Home "Creators"
/// tab. Single-field equality + limit (no composite index needed); sorted
/// client-side by review count so the most active creators surface first.
final creatorsProvider = StreamProvider<List<UserProfile>>((ref) {
  return FirebaseFirestore.instance
      .collection('users')
      .where('isDeleted', isEqualTo: false)
      .limit(20)
      .snapshots()
      .map((snap) {
    final list = snap.docs.map(UserProfile.fromFirestore).toList();
    list.sort((a, b) => b.reviewCount.compareTo(a.reviewCount));
    return list;
  });
});
