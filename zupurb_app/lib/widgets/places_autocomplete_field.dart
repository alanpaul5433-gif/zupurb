// PlacesAutocompleteField — reusable Google Places text field with suggestions.
//
// API:
//   PlacesAutocompleteField(
//     hint: 'Search address or venue',
//     onSelected: (placeId, description, latLng) { ... },
//     apiKey: optionalOverride,  // falls back to MAPS_API_KEY compile constant
//   )
//
// The widget renders a text field; typing triggers Places autocomplete
// and shows a suggestions list below. Selecting an entry fires onSelected.
//
// Cost tagging: each keystroke debounce fires one Places Autocomplete request
// (~$0.00283/request as of 2026). Log cost_band = 'maps/places_autocomplete'.

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart'
    show LatLng; // LatLng only — avoids full map import overhead
import 'package:google_places_flutter/google_places_flutter.dart';
import 'package:google_places_flutter/model/prediction.dart';

// API key injected at build time via --dart-define=MAPS_API_KEY=<key>.
// Falls back to a placeholder that will fail at runtime but not at compile time.
const _mapsApiKey = String.fromEnvironment(
  'MAPS_API_KEY',
  defaultValue: 'PLACEHOLDER_MAPS_KEY',
);

class PlacesAutocompleteField extends StatelessWidget {
  const PlacesAutocompleteField({
    super.key,
    required this.hint,
    required this.onSelected,
    this.apiKey,
  });

  final String hint;

  /// Called when the user selects a prediction.
  /// [placeId] is the Google Place ID.
  /// [description] is the human-readable address/venue name.
  /// [location] is null — the google_places_flutter package does not return
  ///   geometry in autocomplete results. Callers requiring lat/lng must issue
  ///   a Place Details call (logged in FIX_LIST.md as P2 enhancement).
  final void Function(String placeId, String description, LatLng? location)
      onSelected;

  /// Optional API key override; falls back to [_mapsApiKey] compile constant.
  final String? apiKey;

  @override
  Widget build(BuildContext context) {
    final key = apiKey ?? _mapsApiKey;

    return GooglePlaceAutoCompleteTextField(
      textEditingController: TextEditingController(),
      googleAPIKey: key,
      inputDecoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 14, color: Color(0xFF999999)),
        prefixIcon: const Icon(Icons.search, size: 20, color: Color(0xFF999999)),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFE0E0E0)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFD4A853), width: 1.5),
        ),
      ),
      debounceTime: 400,
      countries: const ['us'],
      isLatLngRequired: false,
      getPlaceDetailWithLatLng: (Prediction prediction) {
        // isLatLngRequired = false so this fires without a Places Details call.
        // location is always null here; see docstring above.
        _handleSelection(prediction, hasLatLng: true);
      },
      itemClick: (Prediction prediction) {
        _handleSelection(prediction, hasLatLng: false);
      },
      seperatedBuilder: const Divider(height: 1, color: Color(0xFFEEEEEE)),
      containerHorizontalPadding: 0,
      itemBuilder: (context, _, prediction) => ListTile(
        leading: const Icon(Icons.location_on_outlined,
            size: 18, color: Color(0xFF999999)),
        title: Text(
          prediction.description ?? '',
          style: const TextStyle(fontSize: 14),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }

  void _handleSelection(Prediction prediction, {required bool hasLatLng}) {
    final placeId = prediction.placeId ?? '';
    final description = prediction.description ?? '';

    LatLng? latLng;
    if (hasLatLng &&
        prediction.lat != null &&
        prediction.lng != null) {
      final lat = double.tryParse(prediction.lat!);
      final lng = double.tryParse(prediction.lng!);
      if (lat != null && lng != null) {
        latLng = LatLng(lat, lng);
      }
    }

    // Cost band telemetry (cheap — just a print in dev; replace with analytics service)
    assert(() {
      debugPrint('[cost_band] maps/places_autocomplete placeId=$placeId');
      return true;
    }());

    onSelected(placeId, description, latLng);
  }
}
