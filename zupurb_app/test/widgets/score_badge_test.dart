import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/score_badge.dart';
import 'package:zupurb_app/theme/colors.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  group('ScoreBadge', () {
    testWidgets('renders score formatted to one decimal place', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 4.4)));
      expect(find.text('4.4'), findsOneWidget);
    });

    testWidgets('renders minimum score 1.0', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 1.0)));
      expect(find.text('1.0'), findsOneWidget);
    });

    testWidgets('renders maximum score 5.0', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 5.0)));
      expect(find.text('5.0'), findsOneWidget);
    });

    testWidgets('uses default size of 36 when size is not provided', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 3.0)));
      final containerFinder =
          find.descendant(of: find.byType(ScoreBadge), matching: find.byType(Container)).first;
      final size = tester.getSize(containerFinder);
      expect(size.width, 36.0);
      expect(size.height, 36.0);
    });

    testWidgets('uses custom size when provided', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 3.5, size: 48)));
      final size = tester.getSize(
        find.descendant(of: find.byType(ScoreBadge), matching: find.byType(Container)).first,
      );
      expect(size.width, 48.0);
      expect(size.height, 48.0);
    });

    testWidgets('background is AppColors.primary', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 4.0)));
      final container = tester.widget<Container>(
        find.descendant(of: find.byType(ScoreBadge), matching: find.byType(Container)).first,
      );
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.color, AppColors.primary);
    });

    testWidgets('text color is white', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 2.5)));
      final text = tester.widget<Text>(find.text('2.5'));
      expect(text.style?.color, Colors.white);
    });

    testWidgets('score 0.0 renders without error', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 0.0)));
      expect(find.text('0.0'), findsOneWidget);
    });

    testWidgets('score with many decimals is truncated to one', (tester) async {
      await tester.pumpWidget(_wrap(const ScoreBadge(score: 3.789)));
      // toStringAsFixed(1) rounds 3.789 → '3.8'
      expect(find.text('3.8'), findsOneWidget);
    });
  });
}
