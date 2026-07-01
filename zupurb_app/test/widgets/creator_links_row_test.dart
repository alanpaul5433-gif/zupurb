/// Widget tests for lib/widgets/creator_links_row.dart
/// CreatorLinksRow renders one _LinkChip per known platform present in [links],
/// in fixed display order (instagram, tiktok, website), filtering blank values
/// and ignoring unknown keys. Empty/all-blank -> renders nothing.
/// The chip's launchUrl tap is plugin-backed (url_launcher) and is classified
/// integration-only — see the note at the bottom of this file.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/creator_links_row.dart';

Widget _wrap(Map<String, String> links) =>
    MaterialApp(home: Scaffold(body: CreatorLinksRow(links: links)));

List<String?> _chipLabels(WidgetTester tester) => tester
    .widgetList<Text>(
      find.descendant(
          of: find.byType(CreatorLinksRow), matching: find.byType(Text)),
    )
    .map((t) => t.data)
    .toList();

void main() {
  group('CreatorLinksRow — empty / nothing to show', () {
    testWidgets('empty map renders no chips', (tester) async {
      await tester.pumpWidget(_wrap(const {}));
      expect(find.byType(GestureDetector), findsNothing);
      expect(_chipLabels(tester), isEmpty);
    });

    testWidgets('all-blank values render no chips', (tester) async {
      await tester.pumpWidget(_wrap(const {'instagram': '   ', 'tiktok': ''}));
      expect(find.byType(GestureDetector), findsNothing);
    });

    testWidgets('only-unknown platform keys render nothing', (tester) async {
      await tester.pumpWidget(_wrap(const {'facebook': 'https://fb.com/me'}));
      expect(find.byType(GestureDetector), findsNothing);
      expect(_chipLabels(tester), isEmpty);
    });
  });

  group('CreatorLinksRow — chip rendering', () {
    testWidgets('a single instagram link renders one labelled chip',
        (tester) async {
      await tester.pumpWidget(_wrap(const {'instagram': 'https://insta.com/me'}));
      expect(find.byType(GestureDetector), findsOneWidget);
      expect(find.text('Instagram'), findsOneWidget);
      expect(find.byIcon(Icons.camera_alt_outlined), findsOneWidget);
      expect(find.text('TikTok'), findsNothing);
      expect(find.text('Website'), findsNothing);
    });

    testWidgets('renders one chip per link with the right labels + icons',
        (tester) async {
      await tester.pumpWidget(_wrap(const {
        'instagram': 'https://insta.com/me',
        'tiktok': 'https://tiktok.com/@me',
        'website': 'https://me.com',
      }));
      expect(find.byType(GestureDetector), findsNWidgets(3));
      expect(find.text('Instagram'), findsOneWidget);
      expect(find.text('TikTok'), findsOneWidget);
      expect(find.text('Website'), findsOneWidget);
      expect(find.byIcon(Icons.camera_alt_outlined), findsOneWidget);
      expect(find.byIcon(Icons.music_note), findsOneWidget);
      expect(find.byIcon(Icons.link), findsOneWidget);
    });

    testWidgets('blank value is filtered out of a populated map',
        (tester) async {
      await tester.pumpWidget(_wrap(const {
        'instagram': '   ',
        'tiktok': 'https://tiktok.com/@me',
      }));
      expect(find.byType(GestureDetector), findsOneWidget);
      expect(find.text('TikTok'), findsOneWidget);
      expect(find.text('Instagram'), findsNothing);
    });

    testWidgets('chips render in fixed display order regardless of map order',
        (tester) async {
      await tester.pumpWidget(_wrap(const {
        'website': 'https://me.com',
        'tiktok': 'https://tiktok.com/@me',
        'instagram': 'https://insta.com/me',
      }));
      expect(_chipLabels(tester), ['Instagram', 'TikTok', 'Website']);
    });
  });

  // ---------------------------------------------------------------------------
  // INTEGRATION-ONLY: tapping a chip calls canLaunchUrl/launchUrl through the
  // url_launcher plugin's platform channel. In a pure widget test there is no
  // platform implementation, so the unawaited tap handler would surface a
  // MissingPluginException. The tap path therefore belongs to an integration /
  // device test (or a dedicated platform-channel mock), and is intentionally
  // not exercised here — rendering is the coverage goal for this widget.
  // ---------------------------------------------------------------------------
}
