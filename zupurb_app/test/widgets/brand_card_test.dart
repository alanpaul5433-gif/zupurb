/// Widget tests for lib/widgets/brand_card.dart
/// Renders a Brand model: logo/image, name, category, tagline. The card's
/// GestureDetector opens the shared (provider-free) entity detail bottom sheet.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/brand.dart';
import 'package:zupurb_app/widgets/brand_card.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

Brand _brand({
  String name = 'Acme Co',
  String category = 'Lifestyle',
  String tagline = 'Live better every day',
  String imageUrl = 'https://example.com/logo.png',
}) =>
    Brand(
      id: 'b1',
      name: name,
      category: category,
      tagline: tagline,
      imageUrl: imageUrl,
    );

void main() {
  group('BrandCard', () {
    testWidgets('renders name, category and tagline', (tester) async {
      await tester.pumpWidget(_wrap(BrandCard(brand: _brand())));
      expect(find.text('Acme Co'), findsOneWidget);
      expect(find.text('Lifestyle'), findsOneWidget);
      expect(find.text('Live better every day'), findsOneWidget);
    });

    testWidgets('omits category text when category is empty', (tester) async {
      await tester.pumpWidget(_wrap(BrandCard(brand: _brand(category: ''))));
      expect(find.text('Lifestyle'), findsNothing);
      expect(find.text('Acme Co'), findsOneWidget); // name still rendered
    });

    testWidgets('omits tagline text when tagline is empty', (tester) async {
      await tester.pumpWidget(_wrap(BrandCard(brand: _brand(tagline: ''))));
      expect(find.text('Live better every day'), findsNothing);
    });

    testWidgets('renders a network Image when imageUrl is present',
        (tester) async {
      await tester.pumpWidget(_wrap(BrandCard(brand: _brand())));
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('renders a placeholder (no Image) when imageUrl is empty',
        (tester) async {
      await tester.pumpWidget(_wrap(BrandCard(brand: _brand(imageUrl: ''))));
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('exposes a single GestureDetector tap target', (tester) async {
      await tester.pumpWidget(_wrap(BrandCard(brand: _brand())));
      expect(find.byType(GestureDetector), findsOneWidget);
    });

    testWidgets('tap opens the entity detail bottom sheet', (tester) async {
      // Empty imageUrl keeps the sheet network-free so pumpAndSettle is
      // deterministic (no Image.network resolution to await).
      await tester.pumpWidget(_wrap(BrandCard(brand: _brand(imageUrl: ''))));
      await tester.tap(find.byType(GestureDetector));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsOneWidget);
      // Title (name) now appears in both the card behind and the sheet.
      expect(find.text('Acme Co'), findsNWidgets(2));
    });
  });
}
