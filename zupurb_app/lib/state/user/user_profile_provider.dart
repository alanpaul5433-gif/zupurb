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
