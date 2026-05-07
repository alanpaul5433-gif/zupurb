// MapsService — thin wrapper around geolocator + geocoding + Google Places API (HTTP).
//
// API surface:
//   requestLocationPermission()              → bool
//   getCurrentLocation()                     → Position?
//   getLatLng()                              → LatLng?          (convenience: Position → LatLng)
//   reverseGeocode(lat, lng)                 → ({city, neighborhood, fullAddress})
//   geocodeAddress(String)                   → Position?
//   distanceBetween(...)                     → double (km)
//   getAddressFromLatLng(LatLng)             → String?          (Places API reverse geocode)
//   getLatLngFromAddress(String)             → LatLng?          (Places API forward geocode)
//   getNearbyEstablishments(LatLng, double)  → List<Map>        (calls getNearbyEstablishments CF)
//
// Contract: every method returns null / empty list on error — NEVER throws to callers.
//
// iOS setup (must be done manually by developer):
//   1. In AppDelegate.swift add:
//        GMSServices.provideAPIKey("YOUR_IOS_MAPS_API_KEY")
//      before GeneratedPluginRegistrant.register(with: self)
//   2. In Info.plist add:
//        <key>NSLocationWhenInUseUsageDescription</key>
//        <string>Zupurb uses your location to find nearby venues.</string>
//        <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
//        <string>Zupurb uses your location to find nearby venues even in the background.</string>
//   3. In Info.plist also add your Maps API key (for rendering tiles):
//        <key>GMSApiKey</key>
//        <string>YOUR_IOS_MAPS_API_KEY</string>
//      (Alternatively pass it in AppDelegate as above — one or the other is sufficient.)
//
// Android setup:
//   Maps API key is injected via manifestPlaceholders["MAPS_API_KEY"] in
//   android/app/build.gradle.kts — already configured. Do not modify.
//
// API key at runtime:
//   Pass --dart-define=MAPS_API_KEY=<key> when building/running.
//   The key is read via const String.fromEnvironment('MAPS_API_KEY').
//
// Cost tagging:
//   - getCurrentLocation / reverseGeocode / geocodeAddress: device-side, no billed call.
//   - getAddressFromLatLng / getLatLngFromAddress: billed Google Geocoding API call.
//     Cost band: ~$0.005 / call (Geocoding SKU). Logged below.
//   - getNearbyEstablishments: calls Cloud Function which may trigger Algolia + Firestore.
//     Cost band: Cloud Function invocation + Algolia operation units.

import 'dart:convert';

import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;

import '../services/functions_service.dart';

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const String _kPlacesBaseUrl =
    'https://maps.googleapis.com/maps/api/geocode/json';

// API key injected at build time via --dart-define=MAPS_API_KEY=<key>.
const String _kMapsApiKey = String.fromEnvironment('MAPS_API_KEY');

// ---------------------------------------------------------------------------
// Internal error type
// ---------------------------------------------------------------------------

class MapsServiceException implements Exception {
  final String code;
  final String message;

  const MapsServiceException({required this.code, required this.message});

  @override
  String toString() => 'MapsServiceException($code): $message';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class MapsService {
  final FunctionsService _functions;

  MapsService({FunctionsService? functions})
      : _functions = functions ?? FunctionsService();

  // ─── Permission ────────────────────────────────────────────────────────────

  /// Checks current permission status and requests if not granted.
  /// Returns true when permission is granted (either whileInUse or always).
  Future<bool> requestLocationPermission() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();

      if (permission == LocationPermission.deniedForever) {
        // User permanently denied — cannot request again; open settings instead.
        return false;
      }

      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      return permission == LocationPermission.whileInUse ||
          permission == LocationPermission.always;
    } catch (_) {
      return false;
    }
  }

  // ─── Device Location ───────────────────────────────────────────────────────

  /// Returns the device's current GPS position, or null if unavailable/denied.
  Future<Position?> getCurrentLocation() async {
    try {
      final granted = await requestLocationPermission();
      if (!granted) return null;

      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return null;

      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (_) {
      return null;
    }
  }

  /// Convenience wrapper: returns current location as a [LatLng] for map widgets.
  Future<LatLng?> getLatLng() async {
    final pos = await getCurrentLocation();
    if (pos == null) return null;
    return LatLng(pos.latitude, pos.longitude);
  }

  // ─── Reverse Geocoding (device-side) ───────────────────────────────────────

  /// Converts lat/lng to structured address fields (uses device geocoder — no API cost).
  /// Returns ({city: '', neighborhood: '', fullAddress: ''}) on error.
  Future<({String city, String neighborhood, String fullAddress})>
      reverseGeocode(double lat, double lng) async {
    const emptyResult = (city: '', neighborhood: '', fullAddress: '');
    try {
      final placemarks = await placemarkFromCoordinates(lat, lng);
      if (placemarks.isEmpty) return emptyResult;

      final p = placemarks.first;
      final city = p.locality ?? p.subAdministrativeArea ?? '';
      // subLocality is the neighborhood-level name (e.g. "SoHo", "Midtown")
      final neighborhood = p.subLocality ?? '';
      final parts = [
        p.street,
        p.subLocality,
        p.locality,
        p.administrativeArea,
        p.postalCode,
        p.country,
      ].where((s) => s != null && s.isNotEmpty).join(', ');

      return (city: city, neighborhood: neighborhood, fullAddress: parts);
    } catch (_) {
      return emptyResult;
    }
  }

  // ─── Forward Geocoding (device-side) ───────────────────────────────────────

  /// Converts a human-readable address to a Position (lat/lng) using device geocoder.
  /// Returns null if the address cannot be resolved.
  Future<Position?> geocodeAddress(String address) async {
    try {
      final locations = await locationFromAddress(address);
      if (locations.isEmpty) return null;

      final loc = locations.first;
      return Position(
        latitude: loc.latitude,
        longitude: loc.longitude,
        timestamp: DateTime.now(),
        accuracy: 0,
        altitude: 0,
        altitudeAccuracy: 0,
        heading: 0,
        headingAccuracy: 0,
        speed: 0,
        speedAccuracy: 0,
      );
    } catch (_) {
      return null;
    }
  }

  // ─── Distance ──────────────────────────────────────────────────────────────

  /// Returns straight-line distance in kilometres between two points.
  double distanceBetween(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    // Geolocator.distanceBetween returns metres.
    return Geolocator.distanceBetween(lat1, lng1, lat2, lng2) / 1000.0;
  }

  // ─── Google Geocoding API — Reverse (billed) ───────────────────────────────

  /// Reverse geocodes a [LatLng] to a human-readable address string via Google
  /// Geocoding API. Returns null on error or when no result is found.
  ///
  /// Cost band: ~$0.005 / call (Google Geocoding SKU). Use sparingly.
  Future<String?> getAddressFromLatLng(LatLng latLng) async {
    final stopwatch = Stopwatch()..start();
    try {
      final uri = Uri.parse(_kPlacesBaseUrl).replace(queryParameters: {
        'latlng': '${latLng.latitude},${latLng.longitude}',
        'key': _kMapsApiKey,
      });

      final response = await http.get(uri).timeout(const Duration(seconds: 10));
      stopwatch.stop();

      // ignore: avoid_print
      print(
        '[MapsService] getAddressFromLatLng ok ${stopwatch.elapsedMilliseconds}ms '
        'cost_band=geocoding_reverse',
      );

      if (response.statusCode != 200) return null;

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      if (body['status'] != 'OK') return null;

      final results = body['results'] as List<dynamic>;
      if (results.isEmpty) return null;

      return results.first['formatted_address'] as String?;
    } catch (_) {
      stopwatch.stop();
      // ignore: avoid_print
      print(
        '[MapsService] getAddressFromLatLng err ${stopwatch.elapsedMilliseconds}ms',
      );
      return null;
    }
  }

  // ─── Google Geocoding API — Forward (billed) ───────────────────────────────

  /// Forward geocodes an address string to a [LatLng] via Google Geocoding API.
  /// Returns null on error or when no result is found.
  ///
  /// Cost band: ~$0.005 / call (Google Geocoding SKU). Use sparingly.
  Future<LatLng?> getLatLngFromAddress(String address) async {
    final stopwatch = Stopwatch()..start();
    try {
      final uri = Uri.parse(_kPlacesBaseUrl).replace(queryParameters: {
        'address': address,
        'key': _kMapsApiKey,
      });

      final response = await http.get(uri).timeout(const Duration(seconds: 10));
      stopwatch.stop();

      // ignore: avoid_print
      print(
        '[MapsService] getLatLngFromAddress ok ${stopwatch.elapsedMilliseconds}ms '
        'cost_band=geocoding_forward',
      );

      if (response.statusCode != 200) return null;

      final body = jsonDecode(response.body) as Map<String, dynamic>;
      if (body['status'] != 'OK') return null;

      final results = body['results'] as List<dynamic>;
      if (results.isEmpty) return null;

      final location = results.first['geometry']['location'] as Map<String, dynamic>;
      return LatLng(
        (location['lat'] as num).toDouble(),
        (location['lng'] as num).toDouble(),
      );
    } catch (_) {
      stopwatch.stop();
      // ignore: avoid_print
      print(
        '[MapsService] getLatLngFromAddress err ${stopwatch.elapsedMilliseconds}ms',
      );
      return null;
    }
  }

  // ─── Nearby Establishments (Cloud Function) ────────────────────────────────

  /// Returns nearby establishments from the `getNearbyEstablishments` Cloud Function (B4).
  ///
  /// [center]   — geographic centre of the search area.
  /// [radiusKm] — search radius in kilometres.
  /// [category] — optional filter (e.g. 'restaurant', 'bar', 'coffee').
  ///
  /// Returns a raw list of establishment maps as returned by the CF.
  /// Returns empty list on error.
  ///
  /// Cost band: Cloud Function invocation + Algolia/Firestore reads inside the CF.
  Future<List<Map<String, dynamic>>> getNearbyEstablishments(
    LatLng center,
    double radiusKm, {
    String? category,
  }) async {
    final stopwatch = Stopwatch()..start();
    try {
      final params = <String, dynamic>{
        'lat': center.latitude,
        'lng': center.longitude,
        'radiusKm': radiusKm,
        'category': ?category,
      };

      final result = await _functions.call(
        'getNearbyEstablishments',
        params,
        (r) => (r as List<dynamic>)
            .map((e) => Map<String, dynamic>.from(e as Map))
            .toList(),
      );

      stopwatch.stop();
      // ignore: avoid_print
      print(
        '[MapsService] getNearbyEstablishments ok ${result.length} items '
        '${stopwatch.elapsedMilliseconds}ms cost_band=cf_nearby',
      );
      return result;
    } catch (_) {
      stopwatch.stop();
      // ignore: avoid_print
      print(
        '[MapsService] getNearbyEstablishments err ${stopwatch.elapsedMilliseconds}ms',
      );
      return [];
    }
  }
}
