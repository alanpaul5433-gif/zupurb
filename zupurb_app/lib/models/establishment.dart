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
  // "People Like You" — per-taste-cohort score + reviewer count. Cohorts with
  // too little data are simply absent (→ show the general score only).
  final Map<String, double> plyByCohort;
  final Map<String, int> plyCountByCohort;
  final String address;
  final double? lat;
  final double? lng;

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
    this.plyByCohort = const {},
    this.plyCountByCohort = const {},
    this.address = '',
    this.lat,
    this.lng,
  });

  /// The "People Like You" score for a viewer in [cohort], or null when there
  /// isn't enough like-minded data (cohort missing or < [minReviewers]).
  double? plyForCohort(String? cohort, {int minReviewers = 2}) {
    if (cohort == null || cohort.isEmpty) return null;
    final score = plyByCohort[cohort];
    final count = plyCountByCohort[cohort] ?? 0;
    if (score == null || count < minReviewers) return null;
    return score;
  }

  int plyCountForCohort(String? cohort) =>
      (cohort == null) ? 0 : (plyCountByCohort[cohort] ?? 0);

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
      plyByCohort: ((d['plyByCohort'] as Map?)?.map((k, v) => MapEntry(k.toString(), (v as num).toDouble()))) ?? const {},
      plyCountByCohort: ((d['plyCountByCohort'] as Map?)?.map((k, v) => MapEntry(k.toString(), (v as num).toInt()))) ?? const {},
      address: d['address'] as String? ?? '',
      lat: (d['lat'] as num?)?.toDouble(),
      lng: (d['lng'] as num?)?.toDouble(),
    );
  }
}
