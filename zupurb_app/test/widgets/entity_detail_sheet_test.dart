/// Widget tests for lib/widgets/entity_detail_sheet.dart
/// showEntityDetailSheet() is a pure, read-only modal driven entirely by its
/// arguments (no providers, no Firebase). Tests cover conditional rendering of
/// title/subtitle/rating/body/footer/image for present-vs-absent fields.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:zupurb_app/widgets/entity_detail_sheet.dart';

Future<void> _open(
  WidgetTester tester, {
  String imageUrl = '',
  required String title,
  String? subtitle,
  double? rating,
  String? body,
  String? footer,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: ElevatedButton(
              onPressed: () => showEntityDetailSheet(
                context,
                imageUrl: imageUrl,
                title: title,
                subtitle: subtitle,
                rating: rating,
                body: body,
                footer: footer,
              ),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  group('EntityDetailSheet', () {
    testWidgets('renders the title', (tester) async {
      await _open(tester, title: 'Le Bernardin');
      expect(find.text('Le Bernardin'), findsOneWidget);
    });

    testWidgets('renders all optional fields when provided', (tester) async {
      await _open(
        tester,
        title: 'Le Bernardin',
        subtitle: 'French · Midtown',
        rating: 4.7,
        body: 'A seafood institution.',
        footer: 'Open until 11pm',
      );

      expect(find.text('French · Midtown'), findsOneWidget);
      expect(find.text('4.7'), findsOneWidget); // rating.toStringAsFixed(1)
      expect(find.byIcon(Icons.star), findsOneWidget);
      expect(find.text('A seafood institution.'), findsOneWidget);
      expect(find.text('Open until 11pm'), findsOneWidget);
    });

    testWidgets('omits subtitle/rating/body/footer when null', (tester) async {
      await _open(tester, title: 'Bare Entity');

      expect(find.text('Bare Entity'), findsOneWidget);
      expect(find.byIcon(Icons.star), findsNothing); // no rating
      expect(find.byType(Image), findsNothing); // empty imageUrl -> no image
    });

    testWidgets('empty subtitle/body/footer strings are not rendered',
        (tester) async {
      await _open(
        tester,
        title: 'Empty Strings',
        subtitle: '',
        body: '',
        footer: '',
      );
      // Only the title text should be present from the content fields.
      expect(find.text('Empty Strings'), findsOneWidget);
      expect(find.byIcon(Icons.star), findsNothing);
    });

    testWidgets('renders an image area when imageUrl is non-empty',
        (tester) async {
      await _open(
        tester,
        imageUrl: 'https://example.com/venue.jpg',
        title: 'With Image',
      );
      // The 16:9 image area renders even if the network fetch fails in tests
      // (errorBuilder draws a placeholder Container).
      expect(find.byType(AspectRatio), findsOneWidget);
      expect(find.byType(Image), findsOneWidget);
    });
  });
}
