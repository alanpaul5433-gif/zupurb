/// Widget tests for lib/widgets/post_card.dart
/// Feed-style card for a Post: UserAvatar + author header, full-width image,
/// optional caption, and a ♥ likes row. Tap opens the entity detail sheet whose
/// footer reads "♥ N likes".
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/post.dart';
import 'package:zupurb_app/widgets/post_card.dart';
import 'package:zupurb_app/widgets/user_avatar.dart';
import 'package:zupurb_app/theme/colors.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: child));

Post _post({
  String authorName = 'Mia Stone',
  // Empty avatar URL keeps UserAvatar on its (network-free) initial fallback so
  // the only Image in the tree is the card's own photo.
  String authorPhotoUrl = '',
  String caption = 'Best brunch in town!',
  String imageUrl = 'https://example.com/p.png',
  String venueName = 'Cafe Aurora',
  String venueId = 'est1',
  String persona = 'Food Lover',
  int likes = 12,
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
  group('PostCard', () {
    testWidgets('renders author name, venue, caption and likes count',
        (tester) async {
      await tester.pumpWidget(_wrap(PostCard(post: _post())));
      expect(find.text('Mia Stone'), findsOneWidget);
      expect(find.text('Cafe Aurora'), findsOneWidget);
      expect(find.text('Best brunch in town!'), findsOneWidget);
      expect(find.text('12'), findsOneWidget); // likes count
    });

    testWidgets('renders a UserAvatar for the author', (tester) async {
      await tester.pumpWidget(_wrap(PostCard(post: _post())));
      expect(find.byType(UserAvatar), findsOneWidget);
    });

    testWidgets('omits venue name text when venueName is empty', (tester) async {
      await tester.pumpWidget(_wrap(PostCard(post: _post(venueName: ''))));
      expect(find.text('Cafe Aurora'), findsNothing);
      expect(find.text('Mia Stone'), findsOneWidget);
    });

    testWidgets('omits caption text when caption is empty', (tester) async {
      await tester.pumpWidget(_wrap(PostCard(post: _post(caption: ''))));
      expect(find.text('Best brunch in town!'), findsNothing);
    });

    testWidgets('renders the post photo Image when imageUrl is present',
        (tester) async {
      await tester.pumpWidget(_wrap(PostCard(post: _post())));
      // Avatar uses its initial fallback (empty photoUrl), so this is the photo.
      expect(find.byType(Image), findsOneWidget);
    });

    testWidgets('renders a placeholder (no Image) when imageUrl is empty',
        (tester) async {
      await tester.pumpWidget(_wrap(PostCard(post: _post(imageUrl: ''))));
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('likes icon uses the primary brand colour', (tester) async {
      await tester.pumpWidget(_wrap(PostCard(post: _post())));
      final icon = tester.widget<Icon>(find.byIcon(Icons.favorite));
      expect(icon.color, AppColors.primary);
    });

    testWidgets('exposes a single GestureDetector tap target', (tester) async {
      await tester.pumpWidget(_wrap(PostCard(post: _post())));
      expect(find.byType(GestureDetector), findsOneWidget);
    });

    testWidgets('tap opens the detail sheet with a "♥ N likes" footer',
        (tester) async {
      await tester
          .pumpWidget(_wrap(PostCard(post: _post(imageUrl: '', likes: 12))));
      await tester.tap(find.byType(GestureDetector));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsOneWidget);
      expect(find.text('♥ 12 likes'), findsOneWidget); // sheet-only footer
    });
  });
}
