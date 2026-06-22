import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/entertainer.dart';

/// Stream of active entertainers. Used by the Search "Entertainers" category.
final entertainersProvider = StreamProvider<List<Entertainer>>((ref) {
  return FirebaseFirestore.instance
      .collection('entertainers')
      .where('isActive', isEqualTo: true)
      .limit(20)
      .snapshots()
      .map((s) => s.docs.map(Entertainer.fromFirestore).toList());
});

/// Single-entertainer stream by document [id].
/// Returns null when the document does not exist.
final entertainerProvider =
    StreamProvider.family<Entertainer?, String>((ref, id) {
  return FirebaseFirestore.instance
      .collection('entertainers')
      .doc(id)
      .snapshots()
      .map((doc) => doc.exists ? Entertainer.fromFirestore(doc) : null);
});
