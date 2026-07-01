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

  /// Birth year (year granularity only) set at onboarding; immutable server-side.
  /// Drives the age gate for restricted content (TS-17). Null if not yet set.
  final int? birthYear;

  /// Instagram-style account type. 'user' (default) or 'creator'. The switch is
  /// reversible — flipping back to 'user' keeps [creatorCategory]/[creatorLinks]
  /// stored so re-enabling Creator mode is instant.
  final String accountType;

  /// Creator category label shown under the name (e.g. "Food Creator"). Null for
  /// non-creators or until the creator picks one.
  final String? creatorCategory;

  /// External creator links keyed by platform, e.g. {'instagram': 'https://…'}.
  /// Empty for non-creators.
  final Map<String, String> creatorLinks;

  /// True when the account is currently in Creator mode.
  bool get isCreator => accountType == 'creator';

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
    this.birthYear,
    this.accountType = 'user',
    this.creatorCategory,
    this.creatorLinks = const {},
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
      birthYear: (d['birthYear'] as num?)?.toInt(),
      accountType: d['accountType'] as String? ?? 'user',
      creatorCategory: d['creatorCategory'] as String?,
      creatorLinks: (d['creatorLinks'] as Map<String, dynamic>?)
              ?.map((k, v) => MapEntry(k, v.toString())) ??
          const {},
    );
  }
}
