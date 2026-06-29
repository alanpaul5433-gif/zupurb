/// Widget tests for lib/widgets/app_text_field.dart
/// Covers AppTextField: hint text + semantic label, controller wiring (typed and
/// pre-populated text), obscureText with its show/hide suffix toggle, the
/// optional prefix icon, and keyboardType pass-through.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/app_text_field.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  group('AppTextField', () {
    testWidgets('renders the hint text', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextField(hint: 'Email')));
      expect(find.text('Email'), findsOneWidget);
    });

    testWidgets('exposes the hint as a semantic textField label', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextField(hint: 'Email')));
      final semantics = tester.widget<Semantics>(
        find.descendant(of: find.byType(AppTextField), matching: find.byType(Semantics)).first,
      );
      expect(semantics.properties.label, 'Email');
      expect(semantics.properties.textField, isTrue);
    });

    testWidgets('wires up the provided controller (typed text updates it)', (tester) async {
      final controller = TextEditingController();
      addTearDown(controller.dispose);
      await tester.pumpWidget(_wrap(AppTextField(hint: 'Name', controller: controller)));
      await tester.enterText(find.byType(TextField), 'Jordan');
      expect(controller.text, 'Jordan');
    });

    testWidgets("shows the controller's initial text", (tester) async {
      final controller = TextEditingController(text: 'preset');
      addTearDown(controller.dispose);
      await tester.pumpWidget(_wrap(AppTextField(hint: 'Name', controller: controller)));
      expect(find.text('preset'), findsOneWidget);
    });

    testWidgets('is not obscured by default', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextField(hint: 'Email')));
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.obscureText, isFalse);
    });

    testWidgets('obscures text when obscure is true', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextField(hint: 'Password', obscure: true)));
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.obscureText, isTrue);
    });

    testWidgets('shows a visibility toggle suffix only when obscure is true', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextField(hint: 'Password', obscure: true)));
      expect(find.byIcon(Icons.visibility_off_outlined), findsOneWidget);
      expect(find.byType(IconButton), findsOneWidget);
    });

    testWidgets('shows no suffix toggle when obscure is false', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextField(hint: 'Email')));
      expect(find.byType(IconButton), findsNothing);
    });

    testWidgets('tapping the suffix toggles obscureText off and swaps the icon', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextField(hint: 'Password', obscure: true)));
      expect(tester.widget<TextField>(find.byType(TextField)).obscureText, isTrue);

      await tester.tap(find.byType(IconButton));
      await tester.pump();

      expect(tester.widget<TextField>(find.byType(TextField)).obscureText, isFalse);
      expect(find.byIcon(Icons.visibility_outlined), findsOneWidget);
    });

    testWidgets('renders the prefix icon when provided', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextField(hint: 'Email', prefixIcon: Icons.email)));
      expect(find.byIcon(Icons.email), findsOneWidget);
    });

    testWidgets('renders no prefix icon by default', (tester) async {
      await tester.pumpWidget(_wrap(const AppTextField(hint: 'Email')));
      expect(find.byIcon(Icons.email), findsNothing);
    });

    testWidgets('passes through the keyboardType', (tester) async {
      await tester.pumpWidget(
        _wrap(const AppTextField(hint: 'Email', keyboardType: TextInputType.emailAddress)),
      );
      final field = tester.widget<TextField>(find.byType(TextField));
      expect(field.keyboardType, TextInputType.emailAddress);
    });
  });
}
