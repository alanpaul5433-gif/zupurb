/// Widget tests for lib/widgets/vendor_card.dart
/// Renders a Vendor model: thumbnail, name, "category · city" subtitle, and a
/// private _RatingChip (★ + rating to 1 dp). Tap opens the entity detail sheet.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/vendor.dart';
import 'package:zupurb_app/widgets/vendor_card.dart';
import 'package:zupurb_app/theme/colors.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

Vendor _vendor({
  String name = 'Lisbon Catering',
  String category = 'Catering',
  String city = 'Lisbon',
  String tagline = 'Farm to table events',
  String imageUrl = 'https://example.com/v.png',
  double rating = 4.7,
}) =>
    Vendor(
      id: 'v1',
      name: name,
      category: category,
      tagline: tagline,
      imageUrl: imageUrl,
      city: city,
      rating: rating,
    );

void main() {
  group('VendorCard', () {
    testWidgets('renders name and "category · city" subtitle', (tester) async {
      await tester.pumpWidget(_wrap(VendorCard(vendor: _vendor())));
      expect(find.text('Lisbon Catering'), findsOneWidget);
      expect(find.text('Catering · Lisbon'), findsOneWidget);
    });

    testWidgets('rating chip shows rating to one decimal place', (tester) async {
      await tester.pumpWidget(_wrap(VendorCard(vendor: _vendor(rating: 4.7))));
      expect(find.text('4.7'), findsOneWidget);
      expect(find.byIcon(Icons.star), findsOneWidget);
    });

    testWidgets('rating chip renders zero rating as "0.0"', (tester) async {
      await tester.pumpWidget(_wrap(VendorCard(vendor: _vendor(rating: 0.0))));
      expect(find.text('0.0'), findsOneWidget);
    });

    testWidgets('rating star uses the gold points colour', (tester) async {
      await tester.pumpWidget(_wrap(VendorCard(vendor: _vendor())));
      final icon = tester.widget<Icon>(find.byIcon(Icons.star));
      expect(icon.color, AppColors.pointsGold);
    });

    testWidgets('renders a network Image when imageUrl is present',
        (tester) async {
      await tester.pumpWidget(_wrap(VendorCard(vendor: _vendor())));
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('renders a placeholder (no Image) when imageUrl is empty',
        (tester) async {
      await tester.pumpWidget(_wrap(VendorCard(vendor: _vendor(imageUrl: ''))));
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('exposes a single GestureDetector tap target', (tester) async {
      await tester.pumpWidget(_wrap(VendorCard(vendor: _vendor())));
      expect(find.byType(GestureDetector), findsOneWidget);
    });

    testWidgets('tap opens the entity detail bottom sheet', (tester) async {
      await tester.pumpWidget(_wrap(VendorCard(vendor: _vendor(imageUrl: ''))));
      await tester.tap(find.byType(GestureDetector));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsOneWidget);
      // Title (name) appears in both the card behind and the sheet.
      expect(find.text('Lisbon Catering'), findsNWidgets(2));
    });
  });
}
