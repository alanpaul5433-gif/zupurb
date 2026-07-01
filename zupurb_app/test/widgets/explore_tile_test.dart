/// Widget tests for lib/widgets/explore_tile.dart
/// Covers ExploreTile: label and optional sublabel rendering, the optional
/// badge pill, the empty-image placeholder vs Image.network branch, the
/// semantic button wrapper, and that tapping invokes onTap.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/explore_tile.dart';

Widget _wrap(Widget child) => MaterialApp(
      home: Scaffold(
        body: Center(child: SizedBox(width: 200, height: 200, child: child)),
      ),
    );

void main() {
  group('ExploreTile', () {
    testWidgets('renders the label', (tester) async {
      await tester.pumpWidget(_wrap(ExploreTile(imageUrl: '', label: 'Tacos', onTap: () {})));
      expect(find.text('Tacos'), findsOneWidget);
    });

    testWidgets('renders the sublabel when provided', (tester) async {
      await tester.pumpWidget(
        _wrap(ExploreTile(imageUrl: '', label: 'Tacos', sublabel: 'Downtown', onTap: () {})),
      );
      expect(find.text('Downtown'), findsOneWidget);
    });

    testWidgets('renders no sublabel when null (only the label Text)', (tester) async {
      await tester.pumpWidget(_wrap(ExploreTile(imageUrl: '', label: 'Tacos', onTap: () {})));
      expect(find.text('Tacos'), findsOneWidget);
      expect(find.byType(Text), findsOneWidget);
    });

    testWidgets('renders no sublabel when empty', (tester) async {
      await tester.pumpWidget(
        _wrap(ExploreTile(imageUrl: '', label: 'Tacos', sublabel: '', onTap: () {})),
      );
      expect(find.byType(Text), findsOneWidget);
    });

    testWidgets('renders the badge pill when provided', (tester) async {
      await tester.pumpWidget(
        _wrap(ExploreTile(imageUrl: '', label: 'Deal', badge: '500 pts', onTap: () {})),
      );
      expect(find.text('500 pts'), findsOneWidget);
    });

    testWidgets('renders no badge when empty', (tester) async {
      await tester.pumpWidget(
        _wrap(ExploreTile(imageUrl: '', label: 'Deal', badge: '', onTap: () {})),
      );
      expect(find.byType(Text), findsOneWidget);
    });

    testWidgets('onTap fires when tapped', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        _wrap(ExploreTile(imageUrl: '', label: 'Tap', onTap: () => tapped = true)),
      );
      await tester.tap(find.byType(ExploreTile));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('empty imageUrl renders a placeholder, not an Image', (tester) async {
      await tester.pumpWidget(_wrap(ExploreTile(imageUrl: '', label: 'NoImg', onTap: () {})));
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('non-empty imageUrl renders an Image.network', (tester) async {
      await tester.pumpWidget(
        _wrap(ExploreTile(imageUrl: 'https://example.com/x.png', label: 'Img', onTap: () {})),
      );
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('exposes the label as a semantic button', (tester) async {
      await tester.pumpWidget(_wrap(ExploreTile(imageUrl: '', label: 'Sushi', onTap: () {})));
      final semantics = tester.widget<Semantics>(
        find.descendant(of: find.byType(ExploreTile), matching: find.byType(Semantics)).first,
      );
      expect(semantics.properties.label, 'Sushi');
      expect(semantics.properties.button, isTrue);
    });
  });
}
