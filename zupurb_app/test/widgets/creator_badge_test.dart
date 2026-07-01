/// Widget tests for lib/widgets/creator_badge.dart
/// Covers CreatorBadge (verified icon, default/custom size, primary colour,
/// "Creator" semantic label) and CreatorCategoryLabel (category text, pill
/// background, and text styling).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/creator_badge.dart';
import 'package:zupurb_app/theme/colors.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  group('CreatorBadge', () {
    testWidgets('renders a verified icon', (tester) async {
      await tester.pumpWidget(_wrap(const CreatorBadge()));
      expect(find.byIcon(Icons.verified), findsOneWidget);
    });

    testWidgets('uses a default size of 16', (tester) async {
      await tester.pumpWidget(_wrap(const CreatorBadge()));
      final icon = tester.widget<Icon>(find.byIcon(Icons.verified));
      expect(icon.size, 16);
    });

    testWidgets('uses a custom size when provided', (tester) async {
      await tester.pumpWidget(_wrap(const CreatorBadge(size: 24)));
      final icon = tester.widget<Icon>(find.byIcon(Icons.verified));
      expect(icon.size, 24);
    });

    testWidgets('uses the primary colour', (tester) async {
      await tester.pumpWidget(_wrap(const CreatorBadge()));
      final icon = tester.widget<Icon>(find.byIcon(Icons.verified));
      expect(icon.color, AppColors.primary);
    });

    testWidgets('exposes a "Creator" semantic label', (tester) async {
      await tester.pumpWidget(_wrap(const CreatorBadge()));
      final icon = tester.widget<Icon>(find.byIcon(Icons.verified));
      expect(icon.semanticLabel, 'Creator');
    });
  });

  group('CreatorCategoryLabel', () {
    testWidgets('renders the category text', (tester) async {
      await tester.pumpWidget(_wrap(const CreatorCategoryLabel('Food Creator')));
      expect(find.text('Food Creator'), findsOneWidget);
    });

    testWidgets('uses primary text colour, size 11, weight w600', (tester) async {
      await tester.pumpWidget(_wrap(const CreatorCategoryLabel('Travel')));
      final text = tester.widget<Text>(find.text('Travel'));
      expect(text.style?.color, AppColors.primary);
      expect(text.style?.fontSize, 11);
      expect(text.style?.fontWeight, FontWeight.w600);
    });

    testWidgets('uses a primaryLight pill background', (tester) async {
      await tester.pumpWidget(_wrap(const CreatorCategoryLabel('Music')));
      final container = tester.widget<Container>(
        find
            .descendant(
              of: find.byType(CreatorCategoryLabel),
              matching: find.byType(Container),
            )
            .first,
      );
      expect((container.decoration! as BoxDecoration).color, AppColors.primaryLight);
    });

    testWidgets('renders an empty category without error', (tester) async {
      await tester.pumpWidget(_wrap(const CreatorCategoryLabel('')));
      expect(find.byType(CreatorCategoryLabel), findsOneWidget);
    });
  });
}
