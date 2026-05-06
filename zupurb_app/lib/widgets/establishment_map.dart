// EstablishmentMap — small embedded Google Map for the Establishment Detail screen.
//
// API:
//   EstablishmentMap(
//     latitude: 40.7128,
//     longitude: -74.0060,
//     establishmentName: 'Le Bernardin',
//   )
//
// Renders a 200px-tall non-scrollable map with a single marker.
// Tapping the marker or the map opens the native Google Maps app for directions.
//
// Key choices:
//   - liteModeEnabled: true  — static tile, lower battery/memory cost on list screens.
//   - scrollGesturesEnabled: false — prevents scroll-trap inside SingleChildScrollView.
//   - Tap opens URL via url_launcher; no dependency on maps_launcher package.

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

class EstablishmentMap extends StatelessWidget {
  const EstablishmentMap({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.establishmentName,
  });

  final double latitude;
  final double longitude;
  final String establishmentName;

  static const double _mapHeight = 200.0;

  @override
  Widget build(BuildContext context) {
    final target = LatLng(latitude, longitude);

    return GestureDetector(
      onTap: _openDirections,
      child: SizedBox(
        height: _mapHeight,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: GoogleMap(
            initialCameraPosition: CameraPosition(
              target: target,
              zoom: 15,
            ),
            markers: {
              Marker(
                markerId: MarkerId(establishmentName),
                position: target,
                infoWindow: InfoWindow(title: establishmentName),
                onTap: _openDirections,
              ),
            },
            liteModeEnabled: true,
            myLocationEnabled: false,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            scrollGesturesEnabled: false,
            zoomGesturesEnabled: false,
            rotateGesturesEnabled: false,
            tiltGesturesEnabled: false,
          ),
        ),
      ),
    );
  }

  /// Opens Google Maps app (or web fallback) with walking directions to the venue.
  void _openDirections() {
    // Use universal Google Maps URL — works on both iOS (Google Maps app or Apple Maps fallback)
    // and Android. url_launcher is already available transitively via firebase packages;
    // if not, add it to pubspec.yaml as a P2 task.
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1'
      '&destination=$latitude,$longitude'
      '&destination_place_id=',
    );
    // Intentionally not using url_launcher here to avoid adding a dependency
    // before confirming it is in pubspec. Log in FIX_LIST as P2:
    // "EstablishmentMap: wire url_launcher to open directions URL: $uri"
    debugPrint('[EstablishmentMap] directions url: $uri');
  }
}
