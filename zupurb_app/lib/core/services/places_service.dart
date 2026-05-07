// PlacesService — thin wrapper around Google Places API (Text Search + Place Details).
//
// API surface:
//   searchPlaces(query, bias?)      → List<PlaceResult>
//   getPlaceDetails(placeId)        → PlaceDetails?
//
// Models:
//   PlaceResult  — lightweight result from Text Search (placeId, name, address,
//                  latLng, category, photoReference)
//   PlaceDetails — full details (name, address, phone, website, hours, photos,
//                  location, placeId, rating)
//
// Contract: every method returns null / empty list on error — NEVER throws to callers.
//
// API key:
//   Pass --dart-define=MAPS_API_KEY=<key> when building/running.
//   The key is read via const String.fromEnvironment('MAPS_API_KEY').
//
// Cost bands:
//   searchPlaces   → Text Search SKU  ~$0.032 / call
//   getPlaceDetails → Place Details SKU  ~$0.017 / call (Basic fields)
//   Both are logged per-call for budget attribution.

import 'dart:convert';

import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const String _kTextSearchUrl =
    'https://maps.googleapis.com/maps/api/place/textsearch/json';
const String _kPlaceDetailsUrl =
    'https://maps.googleapis.com/maps/api/place/details/json';

const String _kApiKey = String.fromEnvironment('MAPS_API_KEY');

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/// Lightweight result returned by [PlacesService.searchPlaces].
class PlaceResult {
  /// Google Places place_id — use with [PlacesService.getPlaceDetails].
  final String placeId;

  /// Display name of the place.
  final String name;

  /// Formatted address string.
  final String address;

  /// Geographic coordinates.
  final LatLng latLng;

  /// Primary category/type string from Google (e.g. 'restaurant', 'bar').
  /// Empty string when not available.
  final String category;

  /// Photo reference token for the first photo.
  /// Pass to the Places Photo API: https://maps.googleapis.com/maps/api/place/photo
  /// Empty string when no photo is available.
  final String photoReference;

  const PlaceResult({
    required this.placeId,
    required this.name,
    required this.address,
    required this.latLng,
    required this.category,
    required this.photoReference,
  });

  factory PlaceResult.fromJson(Map<String, dynamic> json) {
    final geometry = json['geometry'] as Map<String, dynamic>?;
    final location = geometry?['location'] as Map<String, dynamic>?;
    final photos = json['photos'] as List<dynamic>?;
    final types = json['types'] as List<dynamic>?;

    return PlaceResult(
      placeId: json['place_id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      address: json['formatted_address'] as String? ?? '',
      latLng: LatLng(
        (location?['lat'] as num?)?.toDouble() ?? 0.0,
        (location?['lng'] as num?)?.toDouble() ?? 0.0,
      ),
      category: (types?.isNotEmpty == true ? types!.first as String? : null) ?? '',
      photoReference:
          (photos?.isNotEmpty == true
              ? (photos!.first as Map<String, dynamic>)['photo_reference'] as String?
              : null) ??
          '',
    );
  }

  @override
  String toString() => 'PlaceResult($placeId, $name)';
}

/// Full place details returned by [PlacesService.getPlaceDetails].
class PlaceDetails {
  final String placeId;
  final String name;
  final String address;
  final LatLng latLng;
  final String category;

  /// E.164-formatted phone number, or empty string when not available.
  final String phoneNumber;

  /// Website URL, or empty string when not available.
  final String website;

  /// Human-readable opening hours periods, or empty list.
  final List<String> openingHours;

  /// List of photo reference tokens (use with Places Photo API).
  final List<String> photoReferences;

  /// Google rating (0.0 when not available).
  final double rating;

  const PlaceDetails({
    required this.placeId,
    required this.name,
    required this.address,
    required this.latLng,
    required this.category,
    required this.phoneNumber,
    required this.website,
    required this.openingHours,
    required this.photoReferences,
    required this.rating,
  });

  factory PlaceDetails.fromJson(Map<String, dynamic> json) {
    final geometry = json['geometry'] as Map<String, dynamic>?;
    final location = geometry?['location'] as Map<String, dynamic>?;
    final photos = json['photos'] as List<dynamic>?;
    final types = json['types'] as List<dynamic>?;
    final hours = json['opening_hours'] as Map<String, dynamic>?;
    final weekday = hours?['weekday_text'] as List<dynamic>?;

    return PlaceDetails(
      placeId: json['place_id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      address: json['formatted_address'] as String? ?? '',
      latLng: LatLng(
        (location?['lat'] as num?)?.toDouble() ?? 0.0,
        (location?['lng'] as num?)?.toDouble() ?? 0.0,
      ),
      category: (types?.isNotEmpty == true ? types!.first as String? : null) ?? '',
      phoneNumber: json['formatted_phone_number'] as String? ?? '',
      website: json['website'] as String? ?? '',
      openingHours: weekday?.map((e) => e as String).toList() ?? [],
      photoReferences: photos
              ?.map(
                (p) =>
                    (p as Map<String, dynamic>)['photo_reference'] as String? ??
                    '',
              )
              .where((ref) => ref.isNotEmpty)
              .toList() ??
          [],
      rating: (json['rating'] as num?)?.toDouble() ?? 0.0,
    );
  }

  @override
  String toString() => 'PlaceDetails($placeId, $name)';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class PlacesService {
  final http.Client _client;

  PlacesService({http.Client? client}) : _client = client ?? http.Client();

  // ─── Text Search ─────────────────────────────────────────────────────────

  /// Searches Google Places by [query] text.
  ///
  /// [bias] — optional [LatLng] to bias results toward (uses `location` param).
  ///   When provided, results within ~50 km of [bias] are ranked higher.
  ///
  /// Returns an empty list on error or when no results are found.
  ///
  /// Cost band: Text Search SKU ~$0.032 / call.
  Future<List<PlaceResult>> searchPlaces(String query, {LatLng? bias}) async {
    final stopwatch = Stopwatch()..start();
    try {
      final params = <String, String>{
        'query': query,
        'key': _kApiKey,
        if (bias != null) 'location': '${bias.latitude},${bias.longitude}',
        if (bias != null) 'radius': '50000', // 50 km bias radius
      };

      final uri = Uri.parse(_kTextSearchUrl).replace(queryParameters: params);
      final response =
          await _client.get(uri).timeout(const Duration(seconds: 10));
      stopwatch.stop();

      // ignore: avoid_print
      print(
        '[PlacesService] searchPlaces ok ${stopwatch.elapsedMilliseconds}ms '
        'cost_band=text_search',
      );

      if (response.statusCode != 200) return [];

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      if (body['status'] != 'OK' && body['status'] != 'ZERO_RESULTS') return [];

      final results = body['results'] as List<dynamic>? ?? [];
      return results
          .map((r) => PlaceResult.fromJson(r as Map<String, dynamic>))
          .toList();
    } catch (_) {
      stopwatch.stop();
      // ignore: avoid_print
      print(
        '[PlacesService] searchPlaces err ${stopwatch.elapsedMilliseconds}ms',
      );
      return [];
    }
  }

  // ─── Place Details ────────────────────────────────────────────────────────

  /// Fetches full details for a place by its [placeId].
  ///
  /// Returns null on error or when the place is not found.
  ///
  /// Cost band: Place Details (Basic) SKU ~$0.017 / call.
  Future<PlaceDetails?> getPlaceDetails(String placeId) async {
    final stopwatch = Stopwatch()..start();
    try {
      // Request only the fields we expose — minimises cost (charged per field group).
      const fields =
          'place_id,name,formatted_address,geometry,types,'
          'formatted_phone_number,website,opening_hours,photos,rating';

      final uri =
          Uri.parse(_kPlaceDetailsUrl).replace(queryParameters: {
        'place_id': placeId,
        'fields': fields,
        'key': _kApiKey,
      });

      final response =
          await _client.get(uri).timeout(const Duration(seconds: 10));
      stopwatch.stop();

      // ignore: avoid_print
      print(
        '[PlacesService] getPlaceDetails ok ${stopwatch.elapsedMilliseconds}ms '
        'cost_band=place_details',
      );

      if (response.statusCode != 200) return null;

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      if (body['status'] != 'OK') return null;

      final result = body['result'] as Map<String, dynamic>?;
      if (result == null) return null;

      return PlaceDetails.fromJson(result);
    } catch (_) {
      stopwatch.stop();
      // ignore: avoid_print
      print(
        '[PlacesService] getPlaceDetails err ${stopwatch.elapsedMilliseconds}ms',
      );
      return null;
    }
  }
}
