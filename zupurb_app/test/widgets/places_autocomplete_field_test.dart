/// Widget tests for lib/widgets/places_autocomplete_field.dart
/// The autocomplete itself (debounced Places network requests, prediction
/// overlay, place-details lookup) is plugin/network-bound and INTEGRATION-ONLY.
/// The reachable pure surface is the empty-state text field: it renders a single
/// editable field with the configured hint + search icon and fires no network
/// request until the user types. Those are the only assertions here.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:zupurb_app/widgets/places_autocomplete_field.dart';

Future<void> _pump(WidgetTester tester) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: PlacesAutocompleteField(
          hint: 'Search address or venue',
          onSelected: (_, _, _) {},
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  group('PlacesAutocompleteField – empty state', () {
    testWidgets('renders a single editable text field', (tester) async {
      await _pump(tester);
      expect(find.byType(EditableText), findsOneWidget);
    });

    testWidgets('shows the configured hint text', (tester) async {
      await _pump(tester);
      expect(find.text('Search address or venue'), findsOneWidget);
    });

    testWidgets('shows the search prefix icon', (tester) async {
      await _pump(tester);
      expect(find.byIcon(Icons.search), findsOneWidget);
    });

    testWidgets('shows no clear button while the field is empty',
        (tester) async {
      await _pump(tester);
      // The package only shows the clear (close) icon once text is entered;
      // typing would trigger a Places network call (integration-only), so we
      // assert the empty-state has no close affordance instead.
      expect(find.byIcon(Icons.close), findsNothing);
    });
  });
}
