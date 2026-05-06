import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/selection_chip.dart';
import 'package:zupurb_app/theme/colors.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  group('SelectionChip', () {
    testWidgets('renders label text', (tester) async {
      await tester.pumpWidget(_wrap(SelectionChip(
        label: 'Italian',
        selected: false,
        onTap: () {},
      )));
      expect(find.text('Italian'), findsOneWidget);
    });

    testWidgets('calls onTap when tapped', (tester) async {
      bool tapped = false;
      await tester.pumpWidget(_wrap(SelectionChip(
        label: 'Sports',
        selected: false,
        onTap: () => tapped = true,
      )));
      await tester.tap(find.byType(SelectionChip));
      expect(tapped, isTrue);
    });

    testWidgets('selected chip has primary background color', (tester) async {
      await tester.pumpWidget(_wrap(SelectionChip(
        label: 'Coffee',
        selected: true,
        onTap: () {},
      )));
      final container = tester.widget<Container>(
        find.descendant(of: find.byType(SelectionChip), matching: find.byType(Container)).first,
      );
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.color, AppColors.primary);
    });

    testWidgets('unselected chip has surface background color', (tester) async {
      await tester.pumpWidget(_wrap(SelectionChip(
        label: 'Coffee',
        selected: false,
        onTap: () {},
      )));
      final container = tester.widget<Container>(
        find.descendant(of: find.byType(SelectionChip), matching: find.byType(Container)).first,
      );
      final decoration = container.decoration as BoxDecoration;
      expect(decoration.color, AppColors.surface);
    });

    testWidgets('selected chip text is white', (tester) async {
      await tester.pumpWidget(_wrap(SelectionChip(
        label: 'Brunch',
        selected: true,
        onTap: () {},
      )));
      final text = tester.widget<Text>(find.text('Brunch'));
      expect(text.style?.color, Colors.white);
    });

    testWidgets('unselected chip text is textPrimary color', (tester) async {
      await tester.pumpWidget(_wrap(SelectionChip(
        label: 'Brunch',
        selected: false,
        onTap: () {},
      )));
      final text = tester.widget<Text>(find.text('Brunch'));
      expect(text.style?.color, AppColors.textPrimary);
    });

    testWidgets('renders prefix widget when provided', (tester) async {
      const prefixKey = Key('prefix_icon');
      await tester.pumpWidget(_wrap(SelectionChip(
        label: 'Tagged',
        selected: false,
        onTap: () {},
        prefix: const Icon(Icons.tag, key: prefixKey),
      )));
      expect(find.byKey(prefixKey), findsOneWidget);
      expect(find.text('Tagged'), findsOneWidget);
    });

    testWidgets('does not render prefix when not provided', (tester) async {
      await tester.pumpWidget(_wrap(SelectionChip(
        label: 'No prefix',
        selected: false,
        onTap: () {},
      )));
      // Only Text widget inside the chip Row, no Icon
      final row = tester.widget<Row>(
        find.descendant(of: find.byType(SelectionChip), matching: find.byType(Row)).first,
      );
      expect(row.children.length, 1); // only Text, no prefix
    });

    testWidgets('selection toggle changes background when rebuilt', (tester) async {
      bool selected = false;
      late StateSetter setStateRef;

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StatefulBuilder(
              builder: (ctx, setState) {
                setStateRef = setState;
                return SelectionChip(
                  label: 'Toggle',
                  selected: selected,
                  onTap: () => setState(() => selected = !selected),
                );
              },
            ),
          ),
        ),
      );

      // Initially unselected
      Container container() => tester.widget<Container>(
            find.descendant(of: find.byType(SelectionChip), matching: find.byType(Container)).first,
          );
      expect((container().decoration as BoxDecoration).color, AppColors.surface);

      // Tap to select
      await tester.tap(find.byType(SelectionChip));
      await tester.pump();
      expect((container().decoration as BoxDecoration).color, AppColors.primary);

      // Tap again to deselect
      await tester.tap(find.byType(SelectionChip));
      await tester.pump();
      expect((container().decoration as BoxDecoration).color, AppColors.surface);
    });
  });
}
