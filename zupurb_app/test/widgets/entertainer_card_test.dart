/// Widget tests for lib/widgets/entertainer_card.dart
/// Renders an Entertainer model: thumbnail, name, "role · city" subtitle, and a
/// private _RatingChip (★ + rating to 1 dp). Tap opens the entity detail sheet.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/entertainer.dart';
import 'package:zupurb_app/widgets/entertainer_card.dart';
import 'package:zupurb_app/theme/colors.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

Entertainer _entertainer({
  String name = 'DJ Nova',
  String role = 'DJ',
  String city = 'Porto',
  String tagline = 'House & techno all night',
  String imageUrl = 'https://example.com/e.png',
  double rating = 4.2,
}) =>
    Entertainer(
      id: 'e1',
      name: name,
      role: role,
      tagline: tagline,
      imageUrl: imageUrl,
      city: city,
      rating: rating,
    );

void main() {
  group('EntertainerCard', () {
    testWidgets('renders name and "role · city" subtitle', (tester) async {
      await tester.pumpWidget(_wrap(EntertainerCard(entertainer: _entertainer())));
      expect(find.text('DJ Nova'), findsOneWidget);
      expect(find.text('DJ · Porto'), findsOneWidget);
    });

    testWidgets('rating chip shows rating to one decimal place', (tester) async {
      await tester.pumpWidget(
          _wrap(EntertainerCard(entertainer: _entertainer(rating: 4.2))));
      expect(find.text('4.2'), findsOneWidget);
      expect(find.byIcon(Icons.star), findsOneWidget);
    });

    testWidgets('rating chip renders zero rating as "0.0"', (tester) async {
      await tester.pumpWidget(
          _wrap(EntertainerCard(entertainer: _entertainer(rating: 0.0))));
      expect(find.text('0.0'), findsOneWidget);
    });

    testWidgets('rating star uses the gold points colour', (tester) async {
      await tester.pumpWidget(_wrap(EntertainerCard(entertainer: _entertainer())));
      final icon = tester.widget<Icon>(find.byIcon(Icons.star));
      expect(icon.color, AppColors.pointsGold);
    });

    testWidgets('renders a network Image when imageUrl is present',
        (tester) async {
      await tester.pumpWidget(_wrap(EntertainerCard(entertainer: _entertainer())));
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('renders a placeholder (no Image) when imageUrl is empty',
        (tester) async {
      await tester.pumpWidget(
          _wrap(EntertainerCard(entertainer: _entertainer(imageUrl: ''))));
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('exposes a single GestureDetector tap target', (tester) async {
      await tester.pumpWidget(_wrap(EntertainerCard(entertainer: _entertainer())));
      expect(find.byType(GestureDetector), findsOneWidget);
    });

    testWidgets('tap opens the entity detail bottom sheet', (tester) async {
      await tester.pumpWidget(
          _wrap(EntertainerCard(entertainer: _entertainer(imageUrl: ''))));
      await tester.tap(find.byType(GestureDetector));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsOneWidget);
      // Title (name) appears in both the card behind and the sheet.
      expect(find.text('DJ Nova'), findsNWidgets(2));
    });
  });
}
