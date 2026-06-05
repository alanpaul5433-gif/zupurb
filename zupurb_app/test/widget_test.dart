// App smoke test (QA-4) — verifies the app shell boots and renders a
// MaterialApp without a real Firebase backend.
//
// Firebase core is mocked (so `*.instance` getters construct) and the
// Firebase-touching boot providers are neutralised via the shared harness.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/test_app_harness.dart';

void main() {
  setUpAll(() async {
    await setUpTestFirebase();
  });

  testWidgets('App smoke test — boots and routes past splash', (tester) async {
    await pumpApp(tester);
    expect(find.byType(MaterialApp), findsOneWidget);

    // Drain the SplashScreen auto-navigation timer so none remain pending.
    // Signed-out (authStateProvider → null) → splash targets /home → the auth
    // guard redirects to /login, a provider-free screen.
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    expect(find.byType(MaterialApp), findsOneWidget);
    expect(find.textContaining('Welcome Back'), findsOneWidget);
  });
}
