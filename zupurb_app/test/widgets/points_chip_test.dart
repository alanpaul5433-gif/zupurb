/// Widget tests for lib/widgets/points_chip.dart
/// Covers PointsChip: the "{points}PTS" label formatting, the gold coin icon,
/// and how the `dark` flag swaps both the pill background and the text colour.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/points_chip.dart';
import 'package:zupurb_app/theme/colors.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

BoxDecoration _decoration(WidgetTester tester) {
  final container = tester.widget<Container>(
    find.descendant(of: find.byType(PointsChip), matching: find.byType(Container)).first,
  );
  return container.decoration! as BoxDecoration;
}

void main() {
  group('PointsChip', () {
    testWidgets('renders the points value with a PTS suffix', (tester) async {
      await tester.pumpWidget(_wrap(const PointsChip(points: 100)));
      expect(find.text('100PTS'), findsOneWidget);
    });

    testWidgets('renders zero points', (tester) async {
      await tester.pumpWidget(_wrap(const PointsChip(points: 0)));
      expect(find.text('0PTS'), findsOneWidget);
    });

    testWidgets('renders large point values without grouping separators', (tester) async {
      await tester.pumpWidget(_wrap(const PointsChip(points: 12345)));
      expect(find.text('12345PTS'), findsOneWidget);
    });

    testWidgets('shows the gold monetization icon at size 12', (tester) async {
      await tester.pumpWidget(_wrap(const PointsChip(points: 5)));
      final icon = tester.widget<Icon>(find.byIcon(Icons.monetization_on));
      expect(icon.color, AppColors.pointsGold);
      expect(icon.size, 12);
    });

    testWidgets('light (default) uses the primaryLight background', (tester) async {
      await tester.pumpWidget(_wrap(const PointsChip(points: 10)));
      expect(_decoration(tester).color, AppColors.primaryLight);
    });

    testWidgets('light (default) uses the primary text colour', (tester) async {
      await tester.pumpWidget(_wrap(const PointsChip(points: 10)));
      final text = tester.widget<Text>(find.text('10PTS'));
      expect(text.style?.color, AppColors.primary);
    });

    testWidgets('dark uses the dark-grey background', (tester) async {
      await tester.pumpWidget(_wrap(const PointsChip(points: 10, dark: true)));
      expect(_decoration(tester).color, const Color(0xFF2A2A2A));
    });

    testWidgets('dark uses the gold text colour', (tester) async {
      await tester.pumpWidget(_wrap(const PointsChip(points: 10, dark: true)));
      final text = tester.widget<Text>(find.text('10PTS'));
      expect(text.style?.color, AppColors.pointsGold);
    });

    testWidgets('text is bold (w700)', (tester) async {
      await tester.pumpWidget(_wrap(const PointsChip(points: 10)));
      final text = tester.widget<Text>(find.text('10PTS'));
      expect(text.style?.fontWeight, FontWeight.w700);
    });
  });
}
