import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/user_profile.dart';
import '../auth/auth_providers.dart';

final userProfileProvider = StreamProvider<UserProfile?>((ref) {
  final uid = ref.watch(currentUidProvider);
  if (uid == null) return Stream.value(null);
  return FirebaseFirestore.instance
      .doc('users/$uid')
      .snapshots()
      .map((doc) => doc.exists ? UserProfile.fromFirestore(doc) : null);
});

/// The current user's taste cohort (drives the "People Like You" rating).
/// Null when not signed in or onboarding hasn't set it → PLY shows general only.
final currentUserCohortProvider = Provider<String?>((ref) {
  return ref.watch(userProfileProvider).valueOrNull?.tasteCohort;
});

/// Streams any user's profile by uid (for the other-profile screen).
final userProfileByIdProvider =
    StreamProvider.family<UserProfile?, String>((ref, uid) {
  if (uid.isEmpty) return Stream.value(null);
  return FirebaseFirestore.instance
      .doc('users/$uid')
      .snapshots()
      .map((doc) => doc.exists ? UserProfile.fromFirestore(doc) : null);
});
