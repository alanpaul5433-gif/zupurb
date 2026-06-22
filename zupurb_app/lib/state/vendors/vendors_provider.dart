import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/vendor.dart';

/// Stream of active vendors. Used by the Search "Vendors" category.
final vendorsProvider = StreamProvider<List<Vendor>>((ref) {
  return FirebaseFirestore.instance
      .collection('vendors')
      .where('isActive', isEqualTo: true)
      .limit(20)
      .snapshots()
      .map((s) => s.docs.map(Vendor.fromFirestore).toList());
});
