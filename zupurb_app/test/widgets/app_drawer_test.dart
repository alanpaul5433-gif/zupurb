/// Widget tests for lib/widgets/app_drawer.dart
/// AppDrawer is a ConsumerWidget that ref.watch(userProfileProvider). Tests
/// override that provider with fixed AsyncData and assert the header reflects
/// the profile (displayName, avatar initial) and that all nav tiles render.
/// Tile navigation taps require a live GoRouter and are out of scope here
/// (presence is asserted instead).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:zupurb_app/models/user_profile.dart';
import 'package:zupurb_app/state/user/user_profile_provider.dart';
import 'package:zupurb_app/widgets/app_drawer.dart';

import '../helpers/test_app_harness.dart';

const _profile = UserProfile(
  uid: 'u1',
  displayName: 'Test User',
  photoUrl: null, // no network avatar -> initial fallback
  followersCount: 0,
  followingCount: 0,
  reviewCount: 0,
  pointsBalance: 0,
  loyaltyTier: 'bronze',
  onboardingComplete: true,
);

Future<void> _pump(WidgetTester tester, {UserProfile? profile}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...firebaseNeutralisingOverrides(),
        userProfileProvider.overrideWith((ref) => Stream.value(profile)),
      ],
      child: const MaterialApp(home: Scaffold(body: AppDrawer())),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(() async => setUpTestFirebase());

  group('AppDrawer – header', () {
    testWidgets('shows the profile displayName and avatar initial',
        (tester) async {
      await _pump(tester, profile: _profile);

      expect(find.text('Test User'), findsOneWidget);
      expect(find.text('View profile'), findsOneWidget);
      expect(find.text('T'), findsOneWidget); // UserAvatar fallback initial
    });

    testWidgets('falls back to "Zupurb User" when there is no profile',
        (tester) async {
      await _pump(tester, profile: null);
      expect(find.text('Zupurb User'), findsOneWidget);
    });
  });

  group('AppDrawer – tiles', () {
    testWidgets('renders every navigation tile', (tester) async {
      await _pump(tester, profile: _profile);

      expect(find.text('Profile'), findsOneWidget);
      expect(find.text('Preferences'), findsOneWidget);
      expect(find.text('Points & Rewards'), findsOneWidget);
      expect(find.text('Badges'), findsOneWidget);
      expect(find.text('My Reservations'), findsOneWidget);
      expect(find.text('Settings'), findsOneWidget);
      expect(find.text('Help & Support'), findsOneWidget);
      expect(find.text('Log out'), findsOneWidget);
    });

    testWidgets('renders inside a Drawer', (tester) async {
      await _pump(tester, profile: _profile);
      expect(find.byType(Drawer), findsOneWidget);
    });
  });
}
