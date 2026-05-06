// MapsService — thin wrapper around geolocator + geocoding packages.
//
// API surface:
//   getCurrentLocation()   → Position?     (handles permission request)
//   reverseGeocode(lat,lng) → ({city, neighborhood, fullAddress})
//   geocodeAddress(String) → Position?
//   distanceBetween(...)   → double (km)
//   requestLocationPermission() → bool
//
// Contract: every method returns null on error — NEVER throws to callers.
// Cost tagging: location/geocoding calls are client-side (no billed API call);
//   Places lookups are billed — tagged at call site in places_autocomplete_field.dart.

import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';

class MapsService {
  // ─── Permission ──────────────────────────────────────────────────────────────

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

  // ─── Device Location ─────────────────────────────────────────────────────────

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

  // ─── Reverse Geocoding ───────────────────────────────────────────────────────

  /// Converts lat/lng to structured address fields.
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

  // ─── Forward Geocoding ───────────────────────────────────────────────────────

  /// Converts a human-readable address to a Position (lat/lng).
  /// Returns null if the address cannot be resolved.
  Future<Position?> geocodeAddress(String address) async {
    try {
      final locations = await locationFromAddress(address);
      if (locations.isEmpty) return null;

      final loc = locations.first;
      // Return a minimal Position-compatible object via Geolocator helper.
      // We construct a dummy Position since geocoding returns Location, not Position.
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

  // ─── Distance ────────────────────────────────────────────────────────────────

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
}
