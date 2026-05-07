// SearchService — thin wrapper around Algolia Flutter Helper for establishment search.
//
// API surface:
//   searchEstablishments(query, {aroundLatLng, radiusKm, category, hasReservations})
//     → List<EstablishmentSearchResult>
//
// Models:
//   EstablishmentSearchResult — id, name, category, address, latLng, overallScore,
//                               reviewCount, heroPhotoUrl, hasReservations, distance
//
// Algolia index: 'establishments'
//
// Credentials (search-only key — safe on client):
//   --dart-define=ALGOLIA_APP_ID=<app_id>
//   --dart-define=ALGOLIA_SEARCH_KEY=<search_only_key>
//
// Contract: searchEstablishments returns an empty list on error — NEVER throws.
//
// Cost band: Algolia operation units — 1 search = 1 unit.
//   Logged per-call for budget attribution.
//
// Algolia index schema (expected fields per hit):
//   objectID        → maps to id
//   name            → String
//   category        → String  (e.g. 'restaurant', 'bar', 'coffee')
//   address         → String
//   _geoloc         → { lat: double, lng: double }
//   overallScore    → double  (pre-computed establishment score)
//   reviewCount     → int
//   heroPhotoUrl    → String  (CDN URL)
//   hasReservations → bool
//   _rankingInfo.matchedGeoLocation.distance → int (metres, present on geo queries)

import 'package:algolia_helper_flutter/algolia_helper_flutter.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

// ---------------------------------------------------------------------------
// Credentials — injected at build time
// ---------------------------------------------------------------------------

const String _kAlgoliaAppId = String.fromEnvironment('ALGOLIA_APP_ID');
const String _kAlgoliaSearchKey = String.fromEnvironment('ALGOLIA_SEARCH_KEY');
const String _kIndexName = 'establishments';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/// A single result from an Algolia establishments search.
class EstablishmentSearchResult {
  /// Firestore document ID — matches Algolia objectID.
  final String id;
  final String name;

  /// Primary category (e.g. 'restaurant', 'bar', 'coffee', 'nightclub').
  final String category;

  /// Human-readable formatted address.
  final String address;

  /// Geographic coordinates of the establishment.
  final LatLng latLng;

  /// Pre-computed overall score in [1.0, 5.0]. 0.0 when not yet set.
  final double overallScore;

  /// Number of published reviews.
  final int reviewCount;

  /// CDN URL for the hero/cover photo. Empty string when none.
  final String heroPhotoUrl;

  /// Whether the establishment supports reservations via Zupurb.
  final bool hasReservations;

  /// Straight-line distance from the query origin in kilometres.
  /// Null when the search was not a geo query.
  final double? distance;

  const EstablishmentSearchResult({
    required this.id,
    required this.name,
    required this.category,
    required this.address,
    required this.latLng,
    required this.overallScore,
    required this.reviewCount,
    required this.heroPhotoUrl,
    required this.hasReservations,
    this.distance,
  });

  factory EstablishmentSearchResult.fromAlgoliaHit(Map<String, dynamic> hit) {
    final geo = hit['_geoloc'] as Map<String, dynamic>?;
    final rankingInfo = hit['_rankingInfo'] as Map<String, dynamic>?;
    final geoMatch =
        rankingInfo?['matchedGeoLocation'] as Map<String, dynamic>?;
    final distanceMetres = geoMatch?['distance'] as int?;

    return EstablishmentSearchResult(
      id: hit['objectID'] as String? ?? '',
      name: hit['name'] as String? ?? '',
      category: hit['category'] as String? ?? '',
      address: hit['address'] as String? ?? '',
      latLng: LatLng(
        (geo?['lat'] as num?)?.toDouble() ?? 0.0,
        (geo?['lng'] as num?)?.toDouble() ?? 0.0,
      ),
      overallScore: (hit['overallScore'] as num?)?.toDouble() ?? 0.0,
      reviewCount: (hit['reviewCount'] as int?) ?? 0,
      heroPhotoUrl: hit['heroPhotoUrl'] as String? ?? '',
      hasReservations: hit['hasReservations'] as bool? ?? false,
      distance: distanceMetres != null ? distanceMetres / 1000.0 : null,
    );
  }

  @override
  String toString() => 'EstablishmentSearchResult($id, $name)';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class SearchService {
  // Algolia searcher is created once and reused; it manages its own HTTP pool.
  late final HitsSearcher _searcher;

  SearchService() {
    _searcher = HitsSearcher(
      applicationID: _kAlgoliaAppId,
      apiKey: _kAlgoliaSearchKey,
      indexName: _kIndexName,
    );
  }

  // ─── Search ───────────────────────────────────────────────────────────────

  /// Searches the Algolia `establishments` index.
  ///
  /// [query]           — full-text search string. Pass empty string for browse mode.
  /// [aroundLatLng]    — when provided, results are ranked by proximity to this point.
  /// [radiusKm]        — radius filter in km (only used when [aroundLatLng] is set).
  ///                     Defaults to 25 km.
  /// [category]        — optional category facet filter (e.g. 'restaurant').
  /// [hasReservations] — when true, filters to venues with reservations enabled.
  ///
  /// Returns an empty list on error.
  ///
  /// Cost band: 1 Algolia operation unit per call.
  Future<List<EstablishmentSearchResult>> searchEstablishments(
    String query, {
    LatLng? aroundLatLng,
    double? radiusKm,
    String? category,
    bool? hasReservations,
  }) async {
    final stopwatch = Stopwatch()..start();
    try {
      // Build facet filters list.
      final facetFilters = <String>[];
      if (category != null && category.isNotEmpty) {
        facetFilters.add('category:$category');
      }
      if (hasReservations == true) {
        facetFilters.add('hasReservations:true');
      }

      // Apply query state to searcher.
      _searcher.applyState((state) {
        var s = state.copyWith(query: query);

        if (aroundLatLng != null) {
          // aroundRadius is dynamic — pass int metres directly.
          final radiusMetres = ((radiusKm ?? 25.0) * 1000).round();
          s = s.copyWith(
            aroundLatLng:
                '${aroundLatLng.latitude},${aroundLatLng.longitude}',
            aroundRadius: radiusMetres,
          );
        }

        if (facetFilters.isNotEmpty) {
          s = s.copyWith(facetFilters: facetFilters);
        }

        return s;
      });

      // Await the next response from the searcher stream.
      final response =
          await _searcher.responses.first.timeout(const Duration(seconds: 10));

      stopwatch.stop();
      // ignore: avoid_print
      print(
        '[SearchService] searchEstablishments ok '
        '${response.hits.length} hits ${stopwatch.elapsedMilliseconds}ms '
        'cost_band=algolia_search',
      );

      return response.hits
          .map(
            (hit) => EstablishmentSearchResult.fromAlgoliaHit(
              hit as Map<String, dynamic>,
            ),
          )
          .toList();
    } catch (_) {
      stopwatch.stop();
      // ignore: avoid_print
      print(
        '[SearchService] searchEstablishments err ${stopwatch.elapsedMilliseconds}ms',
      );
      return [];
    }
  }

  /// Disposes the underlying [HitsSearcher]. Call when the service is no longer needed.
  void dispose() {
    _searcher.dispose();
  }
}
