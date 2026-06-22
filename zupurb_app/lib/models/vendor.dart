import 'package:cloud_firestore/cloud_firestore.dart';

class Vendor {
  final String id;
  final String name;
  final String category;
  final String tagline;
  final String imageUrl;
  final String city;
  final double rating;

  const Vendor({
    required this.id,
    required this.name,
    required this.category,
    required this.tagline,
    required this.imageUrl,
    required this.city,
    required this.rating,
  });

  factory Vendor.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return Vendor(
      id: doc.id,
      name: d['name'] as String? ?? '',
      category: d['category'] as String? ?? '',
      tagline: d['tagline'] as String? ?? '',
      imageUrl: d['imageUrl'] as String? ?? '',
      city: d['city'] as String? ?? '',
      rating: (d['rating'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
