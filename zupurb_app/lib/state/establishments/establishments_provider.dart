import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/establishment.dart';
import '../../models/menu_item.dart';

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

/// Stream of menu items for a single establishment.
/// Sorted in Dart (no composite index needed): category asc, then sortOrder asc.
final establishmentMenuProvider =
    StreamProvider.family<List<MenuItem>, String>((ref, estId) {
  return FirebaseFirestore.instance
      .collection('establishments')
      .doc(estId)
      .collection('menu')
      .snapshots()
      .map((snap) {
        final items = snap.docs.map(MenuItem.fromFirestore).toList();
        items.sort((a, b) {
          final catCmp = a.category.compareTo(b.category);
          if (catCmp != 0) return catCmp;
          return a.sortOrder.compareTo(b.sortOrder);
        });
        return items;
      });
});
