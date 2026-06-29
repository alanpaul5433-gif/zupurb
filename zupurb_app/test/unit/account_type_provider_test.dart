/// Unit tests for lib/state/user/account_type_provider.dart
///
/// Covers the pure, in-memory logic:
///   - isCreatorProvider derives `isCreator` from userProfileProvider:
///       creator account → true, personal account → false, no profile → false,
///       still-loading → false (valueOrNull == null, exercising `?? false`).
///   - AccountModeController.switchToCreator / switchToPersonal null-uid guard:
///       with no signed-in user (currentUidProvider == null) both methods
///       return early — before FirebaseFirestore.instance is touched — so they
///       complete without throwing.
///
/// The actual writes (uid != null) go straight to `FirebaseFirestore.instance`
/// via `set(..., merge)` with no injection seam → integration-only.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/models/user_profile.dart';
import 'package:zupurb_app/state/auth/auth_providers.dart';
import 'package:zupurb_app/state/user/account_type_provider.dart';
import 'package:zupurb_app/state/user/user_profile_provider.dart';

UserProfile _profile({String accountType = 'user'}) => UserProfile(
      uid: 'u1',
      displayName: 'Dana',
      followersCount: 0,
      followingCount: 0,
      reviewCount: 0,
      pointsBalance: 0,
      loyaltyTier: 'bronze',
      onboardingComplete: true,
      accountType: accountType,
    );

ProviderContainer _withProfile(UserProfile? profile) => ProviderContainer(
      overrides: [
        userProfileProvider.overrideWith((ref) => Stream.value(profile)),
      ],
    );

void main() {
  group('isCreatorProvider', () {
    test('true when the signed-in profile is in creator mode', () async {
      final container = _withProfile(_profile(accountType: 'creator'));
      addTearDown(container.dispose);
      await container.read(userProfileProvider.future);

      expect(container.read(isCreatorProvider), isTrue);
    });

    test('false when the profile is a personal account', () async {
      final container = _withProfile(_profile(accountType: 'user'));
      addTearDown(container.dispose);
      await container.read(userProfileProvider.future);

      expect(container.read(isCreatorProvider), isFalse);
    });

    test('false when there is no profile (defaults via `?? false`)', () async {
      final container = _withProfile(null);
      addTearDown(container.dispose);
      await container.read(userProfileProvider.future);

      expect(container.read(isCreatorProvider), isFalse);
    });

    test('false while the profile is still loading (valueOrNull == null)', () {
      final container = ProviderContainer(overrides: [
        userProfileProvider.overrideWith((ref) => Stream<UserProfile?>.empty()),
      ]);
      addTearDown(container.dispose);

      // Read synchronously: state is AsyncLoading, so valueOrNull is null.
      expect(container.read(isCreatorProvider), isFalse);
    });
  });

  group('AccountModeController — null-uid guard', () {
    ProviderContainer signedOut() => ProviderContainer(overrides: [
          currentUidProvider.overrideWithValue(null),
        ]);

    test('switchToCreator returns without writing when signed out', () async {
      final container = signedOut();
      addTearDown(container.dispose);
      final controller = container.read(accountModeControllerProvider);

      // Returns early before FirebaseFirestore.instance is ever touched.
      await expectLater(
        controller.switchToCreator(category: 'Food', links: const {'ig': 'x'}),
        completes,
      );
    });

    test('switchToPersonal returns without writing when signed out', () async {
      final container = signedOut();
      addTearDown(container.dispose);
      final controller = container.read(accountModeControllerProvider);

      await expectLater(controller.switchToPersonal(), completes);
    });
  });
}
