/// Widget tests for lib/widgets/app_button.dart
/// Covers AppButton (label, onTap firing, enabled/disabled state, filled vs
/// outlined variant, fixed height) and AppTextButton (label, onTap, default vs
/// custom text colour, text style).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/app_button.dart';
import 'package:zupurb_app/theme/colors.dart';
import 'package:zupurb_app/theme/dimens.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  group('AppButton', () {
    testWidgets('renders its label', (tester) async {
      await tester.pumpWidget(_wrap(const AppButton(label: 'Continue')));
      expect(find.text('Continue'), findsOneWidget);
    });

    testWidgets('renders an ElevatedButton by default (not outlined)', (tester) async {
      await tester.pumpWidget(_wrap(const AppButton(label: 'Go')));
      expect(find.byType(ElevatedButton), findsOneWidget);
      expect(find.byType(OutlinedButton), findsNothing);
    });

    testWidgets('renders an OutlinedButton when outlined is true', (tester) async {
      await tester.pumpWidget(_wrap(const AppButton(label: 'Go', outlined: true)));
      expect(find.byType(OutlinedButton), findsOneWidget);
      expect(find.byType(ElevatedButton), findsNothing);
    });

    testWidgets('onTap fires when tapped and enabled', (tester) async {
      var tapped = false;
      await tester.pumpWidget(_wrap(AppButton(label: 'Tap', onTap: () => tapped = true)));
      await tester.tap(find.byType(AppButton));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('does not fire onTap when disabled', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        _wrap(AppButton(label: 'Tap', enabled: false, onTap: () => tapped = true)),
      );
      await tester.tap(find.byType(AppButton));
      await tester.pump();
      expect(tapped, isFalse);
    });

    testWidgets('button is disabled (onPressed null) when enabled is false', (tester) async {
      await tester.pumpWidget(_wrap(AppButton(label: 'Tap', enabled: false, onTap: () {})));
      final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(button.onPressed, isNull);
    });

    testWidgets('button is disabled when onTap is null even if enabled', (tester) async {
      await tester.pumpWidget(_wrap(const AppButton(label: 'Tap')));
      final button = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(button.onPressed, isNull);
    });

    testWidgets('uses AppDimens.buttonHeight and full width', (tester) async {
      await tester.pumpWidget(_wrap(const AppButton(label: 'H')));
      final box = tester.widget<SizedBox>(
        find.descendant(of: find.byType(AppButton), matching: find.byType(SizedBox)).first,
      );
      expect(box.height, AppDimens.buttonHeight);
      expect(box.width, double.infinity);
    });

    testWidgets('outlined disabled button has null onPressed', (tester) async {
      await tester.pumpWidget(
        _wrap(AppButton(label: 'X', outlined: true, enabled: false, onTap: () {})),
      );
      final button = tester.widget<OutlinedButton>(find.byType(OutlinedButton));
      expect(button.onPressed, isNull);
    });
  });

  group('AppTextButton', () {
    testWidgets('renders its label', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextButton(label: 'Skip')));
      expect(find.text('Skip'), findsOneWidget);
    });

    testWidgets('onTap fires when tapped', (tester) async {
      var tapped = false;
      await tester.pumpWidget(_wrap(AppTextButton(label: 'Skip', onTap: () => tapped = true)));
      await tester.tap(find.byType(AppTextButton));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('uses AppColors.textSecondary as the default text colour', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextButton(label: 'Skip')));
      final text = tester.widget<Text>(find.text('Skip'));
      expect(text.style?.color, AppColors.textSecondary);
    });

    testWidgets('uses the custom colour when provided', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextButton(label: 'Skip', color: AppColors.primary)));
      final text = tester.widget<Text>(find.text('Skip'));
      expect(text.style?.color, AppColors.primary);
    });

    testWidgets('text uses fontSize 14 and weight w500', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextButton(label: 'Skip')));
      final text = tester.widget<Text>(find.text('Skip'));
      expect(text.style?.fontSize, 14);
      expect(text.style?.fontWeight, FontWeight.w500);
    });

    testWidgets('tapping with a null onTap is a no-op and does not throw', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextButton(label: 'Skip')));
      await tester.tap(find.byType(AppTextButton));
      await tester.pump();
      expect(find.text('Skip'), findsOneWidget);
    });
  });
}
