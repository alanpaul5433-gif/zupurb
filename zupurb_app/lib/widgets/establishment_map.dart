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
import 'package:url_launcher/url_launcher.dart';

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
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1'
      '&destination=$latitude,$longitude',
    );
    launchUrl(uri, mode: LaunchMode.externalApplication).catchError((_) {
      debugPrint('[EstablishmentMap] could not launch maps URL: $uri');
      return false;
    });
  }
}
