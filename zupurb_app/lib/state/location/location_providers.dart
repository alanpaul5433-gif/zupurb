// Location Riverpod providers.
//
// Exposed API:
//   mapsServiceProvider          → Provider<MapsService>
//   currentLocationProvider      → FutureProvider<Position?>   (fetched once, cached)
//   userCityProvider             → FutureProvider<String?>      (derived from location)
//
// All providers are auto-disposed by default behaviour of FutureProvider.
// MapsService is a plain Provider (not auto-disposed) — single instance per app.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/services/maps_service.dart';

/// Singleton service instance. No auto-dispose — kept alive for the app lifetime.
final mapsServiceProvider = Provider<MapsService>(
  (ref) => MapsService(),
);

/// Resolves the device's current GPS position once on first watch.
/// Returns null when permission is denied or location is unavailable.
/// Consumers: userCityProvider, onboarding step 10 "use my location" button.
final currentLocationProvider = FutureProvider<Position?>((ref) async {
  return ref.read(mapsServiceProvider).getCurrentLocation();
});

/// Derives the user's city name from [currentLocationProvider].
/// Returns null when location is unavailable or geocoding fails.
/// Consumers: home feed header, discover filter defaults.
final userCityProvider = FutureProvider<String?>((ref) async {
  final position = await ref.watch(currentLocationProvider.future);
  if (position == null) return null;

  final result = await ref.read(mapsServiceProvider).reverseGeocode(
        position.latitude,
        position.longitude,
      );

  return result.city.isNotEmpty ? result.city : null;
});
