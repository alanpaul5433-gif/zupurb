import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A curated venue list shown on the profile "Lists" tab.
class VenueList {
  final String id;
  final String name;
  final List<String> coverImages;
  final int venueCount;

  const VenueList({required this.id, required this.name, required this.coverImages, required this.venueCount});

  factory VenueList.fromFirestore(DocumentSnapshot doc) {
    final d = (doc.data() as Map<String, dynamic>?) ?? const {};
    final covers = d['coverImages'];
    return VenueList(
      id: doc.id,
      name: (d['name'] ?? 'List').toString(),
      coverImages: covers is List ? covers.map((e) => e.toString()).toList() : const [],
      venueCount: (d['venueCount'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Streams a user's curated lists (users/{uid}/lists).
final userListsProvider =
    StreamProvider.family<List<VenueList>, String>((ref, uid) {
  if (uid.isEmpty) return Stream.value(const []);
  return FirebaseFirestore.instance
      .collection('users')
      .doc(uid)
      .collection('lists')
      .snapshots()
      .map((s) => s.docs.map(VenueList.fromFirestore).toList());
});
