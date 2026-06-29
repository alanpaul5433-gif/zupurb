/// Unit tests for lib/state/user/user_profile_provider.dart
///
/// Covers the pure / overridable logic:
///   - userProfileProvider short-circuits to Stream.value(null) when no user is
///     signed in (currentUidProvider == null).
///   - currentUserCohortProvider derives tasteCohort from userProfileProvider:
///       value present → that cohort; cohort null → null; no profile → null.
///   - userProfileByIdProvider short-circuits to Stream.value(null) for an
///     empty uid.
///
/// The signed-in / non-empty-uid branches stream users/{uid} straight from
/// FirebaseFirestore.instance with no injection seam → integration-only.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/user_profile.dart';
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/state/user/user_profile_provider.dart';

UserProfile _profile({String? tasteCohort}) => UserProfile(
      uid: 'u1',
      displayName: 'Dana',
      followersCount: 0,
      followingCount: 0,
      reviewCount: 0,
      pointsBalance: 0,
      loyaltyTier: 'bronze',
      onboardingComplete: true,
      tasteCohort: tasteCohort,
    );

void main() {
  group('userProfileProvider', () {
    test('emits null when no user is signed in (uid == null)', () async {
      final container = ProviderContainer(overrides: [
        currentUidProvider.overrideWithValue(null),
      ]);
      addTearDown(container.dispose);

      final value = await container.read(userProfileProvider.future);

      expect(value, isNull);
    });
  });

  group('currentUserCohortProvider', () {
    Future<ProviderContainer> withProfile(UserProfile? profile) async {
      final container = ProviderContainer(overrides: [
        userProfileProvider.overrideWith((ref) => Stream.value(profile)),
      ]);
      await container.read(userProfileProvider.future);
      return container;
    }

    test('returns the profile tasteCohort when present', () async {
      final container = await withProfile(_profile(tasteCohort: 'foodies'));
      addTearDown(container.dispose);

      expect(container.read(currentUserCohortProvider), 'foodies');
    });

    test('null when the profile has no tasteCohort', () async {
      final container = await withProfile(_profile(tasteCohort: null));
      addTearDown(container.dispose);

      expect(container.read(currentUserCohortProvider), isNull);
    });

    test('null when there is no profile', () async {
      final container = await withProfile(null);
      addTearDown(container.dispose);

      expect(container.read(currentUserCohortProvider), isNull);
    });
  });

  group('userProfileByIdProvider', () {
    test('short-circuits to null for an empty uid', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final value = await container.read(userProfileByIdProvider('').future);

      expect(value, isNull);
    });
  });
}
