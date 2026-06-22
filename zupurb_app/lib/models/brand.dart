import 'package:cloud_firestore/cloud_firestore.dart';

class Brand {
  final String id;
  final String name;
  final String category;
  final String tagline;
  final String imageUrl;

  const Brand({
    required this.id,
    required this.name,
    required this.category,
    required this.tagline,
    required this.imageUrl,
  });

  factory Brand.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return Brand(
      id: doc.id,
      name: d['name'] as String? ?? '',
      category: d['category'] as String? ?? '',
      tagline: d['tagline'] as String? ?? '',
      imageUrl: d['imageUrl'] as String? ?? '',
    );
  }
}
