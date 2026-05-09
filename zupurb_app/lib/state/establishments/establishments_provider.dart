import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/establishment.dart';

/// Stream of all active establishments from Firestore.
final establishmentsProvider = StreamProvider<List<Establishment>>((ref) {
  return FirebaseFirestore.instance
      .collection('establishments')
      .where('isActive', isEqualTo: true)
      .snapshots()
      .map((snap) => snap.docs.map(Establishment.fromFirestore).toList());
});

/// Stream of a single establishment by Firestore document ID.
final establishmentProvider =
    StreamProvider.family<Establishment?, String>((ref, id) {
  return FirebaseFirestore.instance
      .collection('establishments')
      .doc(id)
      .snapshots()
      .map((doc) => doc.exists ? Establishment.fromFirestore(doc) : null);
});
