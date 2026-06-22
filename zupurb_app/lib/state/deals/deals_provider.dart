import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/deal.dart';

/// Stream of active deals in an establishment's subcollection.
final establishmentDealsProvider =
    StreamProvider.family<List<Deal>, String>((ref, estId) {
  return FirebaseFirestore.instance
      .collection('establishments')
      .doc(estId)
      .collection('deals')
      .where('isActive', isEqualTo: true)
      .snapshots()
      .map((snap) => snap.docs.map(Deal.fromFirestore).toList());
});

/// Stream of all active deals across establishments (top-level `deals`
/// collection). Used by the Home "Deals" tab. Single-field equality filter +
/// limit needs only the auto-created index.
final allDealsProvider = StreamProvider<List<Deal>>((ref) {
  return FirebaseFirestore.instance
      .collection('deals')
      .where('isActive', isEqualTo: true)
      .limit(20)
      .snapshots()
      .map((snap) => snap.docs.map(Deal.fromFirestore).toList());
});
