/// Widget tests for lib/widgets/user_avatar.dart
/// Covers UserAvatar: the initials fallback when photoUrl is null/empty (and the
/// "?" placeholder for blank names), the Image.network path when a photoUrl is
/// present, and box sizing for the default radius (20 -> 40px) vs a custom one.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/widgets/user_avatar.dart';
import 'package:zupurb_app/theme/colors.dart';

Widget _wrap(Widget child) => MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  group('UserAvatar fallback (no photo)', () {
    testWidgets('shows the uppercased first initial when photoUrl is null', (tester) async {
      await tester.pumpWidget(_wrap(const UserAvatar(name: 'Alice')));
      expect(find.text('A'), findsOneWidget);
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('uppercases a lowercase name initial', (tester) async {
      await tester.pumpWidget(_wrap(const UserAvatar(name: 'bob')));
      expect(find.text('B'), findsOneWidget);
    });

    testWidgets('shows the fallback initial when photoUrl is an empty string', (tester) async {
      await tester.pumpWidget(_wrap(const UserAvatar(name: 'Carol', photoUrl: '')));
      expect(find.text('C'), findsOneWidget);
      expect(find.byType(Image), findsNothing);
    });

    testWidgets('shows "?" when the name is empty', (tester) async {
      await tester.pumpWidget(_wrap(const UserAvatar(name: '')));
      expect(find.text('?'), findsOneWidget);
    });

    testWidgets('shows "?" when the name is only whitespace', (tester) async {
      await tester.pumpWidget(_wrap(const UserAvatar(name: '   ')));
      expect(find.text('?'), findsOneWidget);
    });

    testWidgets('fallback circle uses the primaryLight background', (tester) async {
      await tester.pumpWidget(_wrap(const UserAvatar(name: 'Dan')));
      final container = tester.widget<Container>(
        find.descendant(of: find.byType(UserAvatar), matching: find.byType(Container)).first,
      );
      expect(container.color, AppColors.primaryLight);
    });

    testWidgets('default radius 20 renders a 40x40 box', (tester) async {
      await tester.pumpWidget(_wrap(const UserAvatar(name: 'Eve')));
      final size = tester.getSize(
        find.descendant(of: find.byType(UserAvatar), matching: find.byType(SizedBox)).first,
      );
      expect(size.width, 40);
      expect(size.height, 40);
    });

    testWidgets('custom radius 30 renders a 60x60 box', (tester) async {
      await tester.pumpWidget(_wrap(const UserAvatar(name: 'Fay', radius: 30)));
      final size = tester.getSize(
        find.descendant(of: find.byType(UserAvatar), matching: find.byType(SizedBox)).first,
      );
      expect(size.width, 60);
      expect(size.height, 60);
    });
  });

  group('UserAvatar image (photo present)', () {
    testWidgets('uses an Image.network when a photoUrl is provided', (tester) async {
      await tester.pumpWidget(
        _wrap(const UserAvatar(name: 'Gail', photoUrl: 'https://example.com/a.png')),
      );
      expect(find.byType(Image), findsOneWidget);
      final image = tester.widget<Image>(find.byType(Image));
      expect(image.image, isA<NetworkImage>());
      expect((image.image as NetworkImage).url, 'https://example.com/a.png');
    });

    testWidgets('image path wraps in a ClipOval sized to the radius', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const UserAvatar(name: 'Hank', photoUrl: 'https://example.com/b.png', radius: 25),
        ),
      );
      expect(find.byType(ClipOval), findsOneWidget);
      final size = tester.getSize(
        find.descendant(of: find.byType(ClipOval), matching: find.byType(SizedBox)).first,
      );
      expect(size.width, 50);
      expect(size.height, 50);
    });
  });
}
