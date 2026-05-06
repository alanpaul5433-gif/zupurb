import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:zupurb_app/screens/auth/phone_otp_screen.dart';

/// Minimal router wrapping the screen under test.
GoRouter _buildRouter() => GoRouter(
      initialLocation: '/otp',
      routes: [
        GoRoute(path: '/otp', builder: (_, __) => const PhoneOtpScreen()),
        // Stub destination so go('/onboarding/1') doesn't throw a routing error.
        GoRoute(path: '/onboarding/:step', builder: (_, __) => const Scaffold()),
      ],
    );

Widget _wrap() => MaterialApp.router(routerConfig: _buildRouter());

void main() {
  group('PhoneOtpScreen', () {
    testWidgets('renders 6 OTP input fields', (tester) async {
      await tester.pumpWidget(_wrap());
      // Each field is a TextField with maxLength 1 inside a SizedBox(w:48, h:56)
      expect(find.byType(TextField), findsNWidgets(6));
    });

    testWidgets('renders title text', (tester) async {
      await tester.pumpWidget(_wrap());
      expect(find.text('Verify Your Number'), findsOneWidget);
    });

    testWidgets('Verify & Continue button is disabled when no digits entered',
        (tester) async {
      await tester.pumpWidget(_wrap());
      // AppButton renders ElevatedButton; onPressed is null when codeComplete is false
      final btn = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(btn.onPressed, isNull);
    });

    testWidgets('entering all 6 digits enables the Verify & Continue button',
        (tester) async {
      await tester.pumpWidget(_wrap());

      // Enter one digit into each field using positional finder (stable across rebuilds)
      for (int i = 0; i < 6; i++) {
        await tester.enterText(find.byType(TextField).at(i), '${i + 1}');
        await tester.pump();
      }

      final btn = tester.widget<ElevatedButton>(find.byType(ElevatedButton));
      expect(btn.onPressed, isNotNull);
    });

    testWidgets('each field only accepts one digit (maxLength 1)', (tester) async {
      await tester.pumpWidget(_wrap());
      final field = tester.widget<TextField>(find.byType(TextField).first);
      expect(field.maxLength, 1);
    });

    testWidgets('fields have numeric keyboard type', (tester) async {
      await tester.pumpWidget(_wrap());
      final field = tester.widget<TextField>(find.byType(TextField).first);
      expect(field.keyboardType, TextInputType.number);
    });

    testWidgets('renders Resend Code button', (tester) async {
      await tester.pumpWidget(_wrap());
      expect(find.text('Resend Code'), findsOneWidget);
    });

    testWidgets('button text is Verify & Continue', (tester) async {
      await tester.pumpWidget(_wrap());
      expect(find.text('Verify & Continue'), findsOneWidget);
    });
  });
}
