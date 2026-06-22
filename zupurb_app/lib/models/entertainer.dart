import 'package:cloud_firestore/cloud_firestore.dart';

class Entertainer {
  final String id;
  final String name;
  final String role;
  final String tagline;
  final String imageUrl;
  final String city;
  final double rating;

  const Entertainer({
    required this.id,
    required this.name,
    required this.role,
    required this.tagline,
    required this.imageUrl,
    required this.city,
    required this.rating,
  });

  factory Entertainer.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return Entertainer(
      id: doc.id,
      name: d['name'] as String? ?? '',
      role: d['role'] as String? ?? '',
      tagline: d['tagline'] as String? ?? '',
      imageUrl: d['imageUrl'] as String? ?? '',
      city: d['city'] as String? ?? '',
      rating: (d['rating'] as num?)?.toDouble() ?? 0.0,
    );
  }
}
