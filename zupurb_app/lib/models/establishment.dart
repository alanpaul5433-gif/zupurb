import 'package:cloud_firestore/cloud_firestore.dart';

class Establishment {
  final String id;
  final String name;
  final String type;
  final String area;
  final String imageUrl;
  final double score;
  final String priceRange;
  final double distanceKm;
  final String openUntil;
  final bool hasAlcohol;
  final bool hasReservations;
  final bool hasDeals;
  final bool isActive;
  final List<String> tags;

  const Establishment({
    required this.id,
    required this.name,
    required this.type,
    required this.area,
    required this.imageUrl,
    required this.score,
    required this.priceRange,
    required this.distanceKm,
    required this.openUntil,
    required this.hasAlcohol,
    required this.hasReservations,
    required this.hasDeals,
    required this.isActive,
    required this.tags,
  });

  factory Establishment.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return Establishment(
      id: doc.id,
      name: d['name'] as String? ?? '',
      type: d['type'] as String? ?? '',
      area: d['area'] as String? ?? '',
      imageUrl: d['imageUrl'] as String? ?? '',
      score: (d['score'] as num?)?.toDouble() ?? 0.0,
      priceRange: d['priceRange'] as String? ?? '',
      distanceKm: (d['distanceKm'] as num?)?.toDouble() ?? 0.0,
      openUntil: d['openUntil'] as String? ?? '',
      hasAlcohol: d['hasAlcohol'] as bool? ?? false,
      hasReservations: d['hasReservations'] as bool? ?? false,
      hasDeals: d['hasDeals'] as bool? ?? false,
      isActive: d['isActive'] as bool? ?? true,
      tags: List<String>.from(d['tags'] as List<dynamic>? ?? []),
    );
  }
}
