import 'package:cloud_firestore/cloud_firestore.dart';

class Deal {
  final String id;
  final String estId;
  final String title;
  final String description;
  final int pointCost;
  final String imageUrl;
  final bool isActive;

  const Deal({
    required this.id,
    required this.estId,
    required this.title,
    required this.description,
    required this.pointCost,
    required this.imageUrl,
    required this.isActive,
  });

  factory Deal.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return Deal(
      id: doc.id,
      estId: d['estId'] as String? ?? '',
      title: d['title'] as String? ?? '',
      description: d['description'] as String? ?? '',
      pointCost: (d['pointCost'] as num?)?.toInt() ?? 0,
      imageUrl: (d['imageUrl'] ?? d['coverImageUrl']) as String? ?? '',
      isActive: d['isActive'] as bool? ?? true,
    );
  }
}
