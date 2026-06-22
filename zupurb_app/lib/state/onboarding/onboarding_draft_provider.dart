import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Onboarding answers accumulated across the 10-step flow and submitted once via
/// the `completeOnboarding` callable. Mirrors review_draft_provider.dart.
///
/// Each step hydrates its UI from this draft (so back-navigation keeps answers)
/// and writes its selections back on "Continue". Nothing is persisted to the
/// backend until step 10 calls [toCallablePayload].
class OnboardingDraft {
  // Step 2 — demographics
  final int? age;
  final String? gender;

  // Step 4 — optional demographics
  final String? orientation;
  final String? relationshipStatus;
  final String? ethnicity;
  final String? incomeRange; // one of the completeOnboarding enum values
  final bool veteran;

  // Step 5 — food & drink
  final Set<String> cuisines;
  final Set<String> drinks;

  // Step 6 — activities
  final Set<String> activities;

  // Step 7 — sensitive topics
  final String political;
  final String religion;
  final bool skipSensitive;

  // Step 8 — sports
  final Set<String> sports;
  final Set<String> teams;

  // Step 9 — bio
  final String bio;

  // Step 10 — location
  final String radius;
  final String city;
  final Set<String> neighborhoods;

  const OnboardingDraft({
    this.age,
    this.gender,
    this.orientation,
    this.relationshipStatus,
    this.ethnicity,
    this.incomeRange,
    this.veteran = false,
    this.cuisines = const {},
    this.drinks = const {},
    this.activities = const {},
    this.political = '',
    this.religion = '',
    this.skipSensitive = false,
    this.sports = const {},
    this.teams = const {},
    this.bio = '',
    this.radius = '5 km',
    this.city = '',
    this.neighborhoods = const {},
  });

  OnboardingDraft copyWith({
    int? age,
    String? gender,
    String? orientation,
    String? relationshipStatus,
    String? ethnicity,
    String? incomeRange,
    bool? veteran,
    Set<String>? cuisines,
    Set<String>? drinks,
    Set<String>? activities,
    String? political,
    String? religion,
    bool? skipSensitive,
    Set<String>? sports,
    Set<String>? teams,
    String? bio,
    String? radius,
    String? city,
    Set<String>? neighborhoods,
  }) {
    return OnboardingDraft(
      age: age ?? this.age,
      gender: gender ?? this.gender,
      orientation: orientation ?? this.orientation,
      relationshipStatus: relationshipStatus ?? this.relationshipStatus,
      ethnicity: ethnicity ?? this.ethnicity,
      incomeRange: incomeRange ?? this.incomeRange,
      veteran: veteran ?? this.veteran,
      cuisines: cuisines ?? this.cuisines,
      drinks: drinks ?? this.drinks,
      activities: activities ?? this.activities,
      political: political ?? this.political,
      religion: religion ?? this.religion,
      skipSensitive: skipSensitive ?? this.skipSensitive,
      sports: sports ?? this.sports,
      teams: teams ?? this.teams,
      bio: bio ?? this.bio,
      radius: radius ?? this.radius,
      city: city ?? this.city,
      neighborhoods: neighborhoods ?? this.neighborhoods,
    );
  }

  /// The set of valid income enum values the backend accepts.
  static const incomeRanges = <String>[
    '<25k', '25-50k', '50-75k', '75-100k', '100-150k', '150k+',
  ];

  /// Derive a backend-valid username (`^[a-z0-9_.-]{2,30}$`) from the user's
  /// email (preferred) or display name, falling back to a uid-based handle.
  static String deriveUsername(String emailOrName, String uid) {
    final local = emailOrName.contains('@') ? emailOrName.split('@').first : emailOrName;
    var base = local.toLowerCase().replaceAll(RegExp(r'[^a-z0-9_.-]'), '');
    if (base.length < 2) {
      final frag = uid.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
      base = 'user${frag.substring(0, frag.length < 6 ? frag.length : 6)}';
    }
    return base.length > 30 ? base.substring(0, 30) : base;
  }

  /// Builds the exact `completeOnboarding` payload. Required-but-unselected
  /// fields fall back to neutral defaults so the callable's validation passes
  /// even when the user skips the optional demographic steps.
  Map<String, dynamic> toCallablePayload({
    required String displayName,
    required String username,
    String? referralCode,
  }) {
    final birthYear = DateTime.now().toUtc().year - (age ?? 18);
    final income = incomeRanges.contains(incomeRange) ? incomeRange! : '50-75k';
    final resolvedCity = city.trim().isNotEmpty
        ? city.trim()
        : (neighborhoods.isNotEmpty ? neighborhoods.first : 'Los Angeles');
    return {
      'displayName': displayName.trim().isEmpty ? username : displayName.trim(),
      'username': username,
      'birthYear': birthYear,
      'gender': (gender == null || gender!.trim().isEmpty) ? 'Prefer not to say' : gender!.trim(),
      'ethnicity': (ethnicity == null || ethnicity!.trim().isEmpty) ? 'Prefer not to say' : ethnicity!.trim(),
      'incomeRange': income,
      'city': resolvedCity,
      'neighborhood': neighborhoods.isNotEmpty ? neighborhoods.first : '',
      'activityPreferences': activities.toList(),
      'diningPreferences': cuisines.toList(),
      'nightlifePreferences': [...drinks, ...sports],
      'sensitiveTopics': {
        if (!skipSensitive && political.trim().isNotEmpty) 'politicalLeaning': political.trim(),
        if (!skipSensitive && religion.trim().isNotEmpty) 'religionPreference': religion.trim(),
        'skipSensitive': skipSensitive,
      },
      'bio': bio.trim(),
      if (referralCode != null && referralCode.trim().isNotEmpty) 'referralCode': referralCode.trim(),
    };
  }

  /// Supplementary fields the callable's schema doesn't cover but the UI
  /// collects — written directly to the user doc after onboarding.
  Map<String, dynamic> get extraProfileFields => {
        if (orientation != null && orientation!.isNotEmpty) 'orientation': orientation,
        if (relationshipStatus != null && relationshipStatus!.isNotEmpty)
          'relationshipStatus': relationshipStatus,
        'veteran': veteran,
        'searchRadius': radius,
        'neighborhoods': neighborhoods.toList(),
        'drinkPreferences': drinks.toList(),
        'sportsFollowed': sports.toList(),
        'favoriteTeams': teams.toList(),
      };
}

class OnboardingDraftNotifier extends Notifier<OnboardingDraft> {
  @override
  OnboardingDraft build() => const OnboardingDraft();

  // Step 2
  void setAge(int v) => state = state.copyWith(age: v);
  void setGender(String v) => state = state.copyWith(gender: v);

  // Step 4
  void setOrientation(String v) => state = state.copyWith(orientation: v);
  void setRelationshipStatus(String v) => state = state.copyWith(relationshipStatus: v);
  void setEthnicity(String v) => state = state.copyWith(ethnicity: v);
  void setIncomeRange(String v) => state = state.copyWith(incomeRange: v);
  void setVeteran(bool v) => state = state.copyWith(veteran: v);

  // Step 5
  void setCuisines(Set<String> v) => state = state.copyWith(cuisines: v);
  void setDrinks(Set<String> v) => state = state.copyWith(drinks: v);

  // Step 6
  void setActivities(Set<String> v) => state = state.copyWith(activities: v);

  // Step 7
  void setPolitical(String v) => state = state.copyWith(political: v);
  void setReligion(String v) => state = state.copyWith(religion: v);
  void setSkipSensitive(bool v) => state = state.copyWith(skipSensitive: v);

  // Step 8
  void setSports(Set<String> v) => state = state.copyWith(sports: v);
  void setTeams(Set<String> v) => state = state.copyWith(teams: v);

  // Step 9
  void setBio(String v) => state = state.copyWith(bio: v);

  // Step 10
  void setRadius(String v) => state = state.copyWith(radius: v);
  void setCity(String v) => state = state.copyWith(city: v);
  void setNeighborhoods(Set<String> v) => state = state.copyWith(neighborhoods: v);

  void reset() => state = const OnboardingDraft();
}

final onboardingDraftProvider =
    NotifierProvider<OnboardingDraftNotifier, OnboardingDraft>(OnboardingDraftNotifier.new);
