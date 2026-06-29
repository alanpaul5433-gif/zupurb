/// Unit tests for lib/state/location/location_providers.dart
///
/// The pure, testable logic is userCityProvider's derivation:
///   - null position           -> null (reverse-geocode never attempted)
///   - position + non-empty city -> that city
///   - position + empty city     -> null
/// We inject a mock MapsService and override currentLocationProvider with fixed
/// values, so neither geolocator nor the device geocoder is touched.
/// currentLocationProvider itself is a thin passthrough to MapsService and is
/// covered via the injected mock.
///
/// INTEGRATION-ONLY (no unit seam, documented in the report):
///   - mapsServiceProvider news up MapsService(), whose constructor builds a
///     FunctionsService (FirebaseFunctions.instance) — needs a live Firebase app.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mocktail/mocktail.dart';
import 'package:zupurb_app/core/services/maps_service.dart';
import 'package:zupurb_app/state/location/location_providers.dart';

class _MockMapsService extends Mock implements MapsService {}

Position _position(double lat, double lng) => Position(
      latitude: lat,
      longitude: lng,
      timestamp: DateTime.now(),
      accuracy: 0,
      altitude: 0,
      altitudeAccuracy: 0,
      heading: 0,
      headingAccuracy: 0,
      speed: 0,
      speedAccuracy: 0,
    );

void main() {
  group('userCityProvider', () {
    test('returns null when the device position is unavailable', () async {
      final maps = _MockMapsService();
      final c = ProviderContainer(overrides: [
        mapsServiceProvider.overrideWithValue(maps),
        currentLocationProvider.overrideWith((ref) async => null),
      ]);
      addTearDown(c.dispose);

      expect(await c.read(userCityProvider.future), isNull);
      // No position => never reverse-geocodes.
      verifyNever(() => maps.reverseGeocode(any(), any()));
    });

    test('returns the reverse-geocoded city for a known position', () async {
      final maps = _MockMapsService();
      when(() => maps.reverseGeocode(any(), any())).thenAnswer(
        (_) async => (city: 'Brooklyn', neighborhood: 'SoHo', fullAddress: '...'),
      );
      final c = ProviderContainer(overrides: [
        mapsServiceProvider.overrideWithValue(maps),
        currentLocationProvider
            .overrideWith((ref) async => _position(40.6782, -73.9442)),
      ]);
      addTearDown(c.dispose);

      expect(await c.read(userCityProvider.future), 'Brooklyn');
      verify(() => maps.reverseGeocode(40.6782, -73.9442)).called(1);
    });

    test('returns null when reverse-geocoding yields an empty city', () async {
      final maps = _MockMapsService();
      when(() => maps.reverseGeocode(any(), any())).thenAnswer(
        (_) async => (city: '', neighborhood: '', fullAddress: ''),
      );
      final c = ProviderContainer(overrides: [
        mapsServiceProvider.overrideWithValue(maps),
        currentLocationProvider
            .overrideWith((ref) async => _position(1, 2)),
      ]);
      addTearDown(c.dispose);

      expect(await c.read(userCityProvider.future), isNull);
    });
  });

  group('currentLocationProvider', () {
    test('passes through the MapsService position', () async {
      final maps = _MockMapsService();
      final pos = _position(51.5, -0.12);
      when(() => maps.getCurrentLocation()).thenAnswer((_) async => pos);
      final c = ProviderContainer(overrides: [
        mapsServiceProvider.overrideWithValue(maps),
      ]);
      addTearDown(c.dispose);

      expect(await c.read(currentLocationProvider.future), same(pos));
    });

    test('passes through null when location is unavailable', () async {
      final maps = _MockMapsService();
      when(() => maps.getCurrentLocation()).thenAnswer((_) async => null);
      final c = ProviderContainer(overrides: [
        mapsServiceProvider.overrideWithValue(maps),
      ]);
      addTearDown(c.dispose);

      expect(await c.read(currentLocationProvider.future), isNull);
    });
  });
}
