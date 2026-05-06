// Shared helpers, mock providers, and widget pump utilities for integration
// tests. Every test file imports this module.
//
// Design notes:
//  - Screens under test are self-contained StatelessWidget / StatefulWidget
//    trees; they do not consume Riverpod providers directly. They use
//    go_router for navigation.
//  - To avoid real Firebase/GoRouter initialisation (which requires platform
//    channels and a connected device) we pump each screen inside a minimal
//    MaterialApp + Navigator combination. Navigation calls (context.go /
//    context.pop) are intercepted by a stub GoRouter so they do not throw.
//  - Tests that strictly require a device (platform-channel-dependent widgets
//    such as google_maps_flutter) are marked with REQUIRES_DEVICE.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:zupurb_app/theme/theme.dart';

// ---------------------------------------------------------------------------
// Stub GoRouter — every route resolves to a blank confirmation screen so that
// context.go('/some/route') does not throw a "no route found" error during
// tests.
// ---------------------------------------------------------------------------

/// A lightweight stand-in page used as the destination for any navigation
/// triggered by a screen under test (e.g. after tapping "Continue").
class StubPage extends StatelessWidget {
  final String label;
  // ignore: use_key_in_widget_constructors — test helper, key not needed
  const StubPage({required this.label});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        key: Key('stub_page_$label'), // referenced by test assertions
        child: Text('stub:$label'),
      ),
    );
  }
}

/// Builds a [GoRouter] that routes the [screenUnderTest] to '/' and maps
/// every [stubRoutes] path to a blank stub page so navigation calls succeed.
GoRouter buildTestRouter({
  required Widget screenUnderTest,
  List<String> stubRoutes = const [],
}) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        // ignore: unnecessary_underscores — unused context/state params
        builder: (context, state) => screenUnderTest,
      ),
      ...stubRoutes.map(
        (path) => GoRoute(
          path: path,
          // ignore: unnecessary_underscores — unused context/state params
          builder: (context, state) =>
              StubPage(label: path.replaceAll('/', '_')),
        ),
      ),
    ],
  );
}

/// Pumps [screen] inside a [MaterialApp.router] backed by [buildTestRouter].
///
/// [stubRoutes] should list every path the screen may navigate to so that
/// [context.go] calls do not throw.
Future<void> pumpScreen(
  WidgetTester tester,
  Widget screen, {
  List<String> stubRoutes = const [],
}) async {
  final router = buildTestRouter(
    screenUnderTest: screen,
    stubRoutes: stubRoutes,
  );

  await tester.pumpWidget(
    MaterialApp.router(
      theme: AppTheme.light,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    ),
  );

  // Settle animations / futures from initial build.
  await tester.pumpAndSettle();
}

// ---------------------------------------------------------------------------
// Common assertion helpers
// ---------------------------------------------------------------------------

/// Asserts that a [Text] widget displaying [text] is present in the tree.
void expectText(String text) => expect(find.text(text), findsOneWidget);

/// Asserts that at least one widget with [key] exists.
void expectKey(Key key) => expect(find.byKey(key), findsAtLeastNWidgets(1));
