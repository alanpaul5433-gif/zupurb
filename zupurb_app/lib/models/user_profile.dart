import 'package:cloud_firestore/cloud_firestore.dart';

class UserProfile {
  final String uid;
  final String displayName;
  final String? photoUrl;
  final String? bio;
  final int followersCount;
  final int followingCount;
  final int reviewCount;
  final int pointsBalance;
  final String loyaltyTier;
  final bool onboardingComplete;
  /// Taste cohort driving the "People Like You" rating (null until onboarding sets it).
  final String? tasteCohort;

  const UserProfile({
    required this.uid,
    required this.displayName,
    this.photoUrl,
    this.bio,
    required this.followersCount,
    required this.followingCount,
    required this.reviewCount,
    required this.pointsBalance,
    required this.loyaltyTier,
    required this.onboardingComplete,
    this.tasteCohort,
  });

  factory UserProfile.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>? ?? {};
    return UserProfile(
      uid: doc.id,
      displayName: d['displayName'] as String? ?? 'User',
      photoUrl: d['photoUrl'] as String?,
      bio: d['bio'] as String?,
      followersCount: (d['followersCount'] as num?)?.toInt() ?? 0,
      followingCount: (d['followingCount'] as num?)?.toInt() ?? 0,
      reviewCount: (d['reviewCount'] as num?)?.toInt() ?? 0,
      pointsBalance: (d['pointsBalance'] as num?)?.toInt() ?? 0,
      loyaltyTier: d['loyaltyTier'] as String? ?? 'bronze',
      onboardingComplete: d['onboardingComplete'] as bool? ?? false,
      tasteCohort: d['tasteCohort'] as String?,
    );
  }
}
