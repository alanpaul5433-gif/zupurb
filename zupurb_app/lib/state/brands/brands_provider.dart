import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/brand.dart';

/// Stream of active brands. Used by the Search "Brands" category.
final brandsProvider = StreamProvider<List<Brand>>((ref) {
  return FirebaseFirestore.instance
      .collection('brands')
      .where('isActive', isEqualTo: true)
      .limit(20)
      .snapshots()
      .map((s) => s.docs.map(Brand.fromFirestore).toList());
});
