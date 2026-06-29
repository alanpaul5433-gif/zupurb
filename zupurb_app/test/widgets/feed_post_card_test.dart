/// Widget tests for lib/widgets/feed_post_card.dart
/// Instagram-style Post card (plain StatelessWidget — no Riverpod/Firebase, so
/// it is a pure widget test). Covers author header, photo vs _ImageFallback,
/// venue chip, persona badge (mapped vs default icon), and the "Visit & rate" CTA.
/// Tap targets use go_router's context.push; they are asserted as present, not
/// exercised (no GoRouter is mounted).
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/post.dart';
import 'package:zupurb_app/widgets/feed_post_card.dart';
import 'package:zupurb_app/widgets/user_avatar.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

Post _post({
  String authorName = 'Mia Stone',
  String authorPhotoUrl = '', // keep UserAvatar network-free (initial fallback)
  String caption = 'Best brunch in town!',
  String imageUrl = 'https://example.com/p.png',
  String venueName = 'Cafe Aurora',
  String venueId = 'est1',
  String persona = 'Food Lover',
  int likes = 42,
}) =>
    Post(
      id: 'p1',
      authorUid: 'u1',
      authorName: authorName,
      authorPhotoUrl: authorPhotoUrl,
      caption: caption,
      imageUrl: imageUrl,
      venueName: venueName,
      venueId: venueId,
      persona: persona,
      likes: likes,
    );

void main() {
  group('FeedPostCard', () {
    testWidgets('renders author, caption, likes and the post photo',
        (tester) async {
      await tester.pumpWidget(_wrap(FeedPostCard(post: _post())));
      expect(find.text('Mia Stone'), findsOneWidget);
      expect(find.text('Best brunch in town!'), findsOneWidget);
      expect(find.text('42'), findsOneWidget);
      expect(find.byType(UserAvatar), findsOneWidget);
      // Avatar uses its initial fallback (empty photoUrl), so this is the photo.
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('shows venue name in both the header and the venue chip',
        (tester) async {
      await tester.pumpWidget(_wrap(FeedPostCard(post: _post())));
      // Header subtitle + venue chip both render the venue name.
      expect(find.text('Cafe Aurora'), findsNWidgets(2));
      expect(find.byIcon(Icons.place), findsOneWidget);
    });

    testWidgets('shows the "Visit & rate" CTA when venueId is set',
        (tester) async {
      await tester.pumpWidget(_wrap(FeedPostCard(post: _post())));
      expect(find.text('Visit & rate'), findsOneWidget);
    });

    testWidgets(
        'renders venue chip but no "Visit & rate" CTA when venueId is empty',
        (tester) async {
      await tester.pumpWidget(_wrap(FeedPostCard(post: _post(venueId: ''))));
      // Chip still shows (venueName present): header + chip = 2 occurrences.
      expect(find.text('Cafe Aurora'), findsNWidgets(2));
      expect(find.byIcon(Icons.place), findsOneWidget);
      // CTA is gated on a non-empty venueId.
      expect(find.text('Visit & rate'), findsNothing);
    });

    testWidgets('persona badge uses the mapped icon for a known persona',
        (tester) async {
      await tester
          .pumpWidget(_wrap(FeedPostCard(post: _post(persona: 'Food Lover'))));
      expect(find.text('Food Lover'), findsOneWidget);
      expect(find.byIcon(Icons.restaurant), findsOneWidget);
    });

    testWidgets('persona badge falls back to a person icon for unknown persona',
        (tester) async {
      await tester
          .pumpWidget(_wrap(FeedPostCard(post: _post(persona: 'Mysterious'))));
      expect(find.text('Mysterious'), findsOneWidget);
      expect(find.byIcon(Icons.person), findsOneWidget);
    });

    testWidgets('omits the persona badge when persona is empty', (tester) async {
      await tester.pumpWidget(_wrap(FeedPostCard(post: _post(persona: ''))));
      // None of the mapped persona icons should appear.
      expect(find.byIcon(Icons.restaurant), findsNothing);
      expect(find.byIcon(Icons.person), findsNothing);
    });

    testWidgets('shows the image fallback (icon + label) when imageUrl is empty',
        (tester) async {
      await tester.pumpWidget(
        _wrap(FeedPostCard(post: _post(imageUrl: '', venueName: '', venueId: ''))),
      );
      expect(find.byType(Image), findsNothing);
      expect(find.byIcon(Icons.image_outlined), findsOneWidget);
      // Fallback label uses authorName when venueName is empty, so the author
      // name renders twice: once in the header and once as the fallback label.
      expect(find.text('Mia Stone'), findsNWidgets(2));
    });

    testWidgets('renders likes 0 and no venue chip for a minimal post',
        (tester) async {
      await tester.pumpWidget(
        _wrap(FeedPostCard(post: _post(
          imageUrl: '',
          venueName: '',
          venueId: '',
          persona: '',
          caption: '',
          likes: 0,
        ))),
      );
      expect(find.text('0'), findsOneWidget);
      expect(find.byIcon(Icons.place), findsNothing); // no venue chip
      expect(find.text('Visit & rate'), findsNothing); // no CTA
    });
  });
}
