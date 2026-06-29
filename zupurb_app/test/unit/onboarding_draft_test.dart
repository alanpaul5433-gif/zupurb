/// Unit tests for lib/state/onboarding/onboarding_draft_provider.dart
///
/// Pure in-memory onboarding draft state (no Firebase). Covers EXHAUSTIVELY:
///   - OnboardingDraft.deriveUsername: email-local extraction, name path,
///     lowercasing, special-char stripping to ^[a-z0-9_.-], the <2-char ->
///     uid-fallback `user<frag>` branch (incl. short/empty/special uid), and
///     the >30-char truncation boundary.
///   - OnboardingDraft.toCallablePayload: birthYear = nowUtc.year - (age ?? 18),
///     income fallback to '50-75k' vs valid pass-through, city resolution
///     (city.trim -> first neighborhood -> 'Los Angeles'), gender/ethnicity
///     'Prefer not to say' defaults + trimming, the sensitiveTopics map and
///     skipSensitive gating (skipSensitive flag always present), displayName ->
///     username fallback when blank, and conditional referralCode inclusion.
///   - OnboardingDraft.extraProfileFields: conditional orientation /
///     relationshipStatus inclusion and the always-present veteran /
///     searchRadius / neighborhoods / drink / sports / teams keys.
///   - OnboardingDraft.incomeRanges const list contents.
///   - OnboardingDraftNotifier: every setter mutates state via copyWith,
///     setters accumulate, and reset() returns to const OnboardingDraft().
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zupurb_app/state/onboarding/onboarding_draft_provider.dart';

void main() {
  group('OnboardingDraft.deriveUsername', () {
    test('email path strips the domain and keeps the local part', () {
      expect(OnboardingDraft.deriveUsername('john.doe@example.com', 'uid1'),
          'john.doe');
    });

    test('email path lowercases the local part', () {
      expect(OnboardingDraft.deriveUsername('John.Doe@Example.COM', 'uid1'),
          'john.doe');
    });

    test('name path (no @) is used verbatim aside from normalization', () {
      // Spaces are not in [a-z0-9_.-] so they are stripped.
      expect(OnboardingDraft.deriveUsername('Jane Smith', 'uid1'), 'janesmith');
    });

    test('lowercases an all-caps name', () {
      expect(OnboardingDraft.deriveUsername('JOHNDOE', 'uid1'), 'johndoe');
    });

    test('keeps the allowed punctuation class _ . -', () {
      expect(OnboardingDraft.deriveUsername('user_name.test-1', 'uid1'),
          'user_name.test-1');
    });

    test('strips characters outside ^[a-z0-9_.-]', () {
      // '*', '#', '!', '%', '+' removed; digits/letters retained.
      expect(OnboardingDraft.deriveUsername('a*b#c!9%z+', 'uid1'), 'abc9z');
    });

    test('strips non-ascii letters (accents) before length check', () {
      // 'jöhn' -> 'jhn' (ö is not in the ascii class).
      expect(OnboardingDraft.deriveUsername('jöhn@x.com', 'uid1'), 'jhn');
    });

    test('only the part before the first @ is used as the local part', () {
      // split('@').first -> 'a.b' even with multiple @ present.
      expect(OnboardingDraft.deriveUsername('a.b@c@d.com', 'uid1'), 'a.b');
    });

    group('<2-char -> uid fallback (user<frag>)', () {
      test('single-char email local falls back to uid fragment', () {
        // 'a' has length 1 (<2) -> fallback. uid normalized + first 6 chars.
        expect(
          OnboardingDraft.deriveUsername('a@x.com', 'ABC123XYZ789'),
          'userabc123',
        );
      });

      test('name that strips to empty falls back to uid fragment', () {
        // '***' -> '' (<2) -> fallback.
        expect(
          OnboardingDraft.deriveUsername('***', 'ABC123XYZ789'),
          'userabc123',
        );
      });

      test('empty input falls back to uid fragment', () {
        expect(
          OnboardingDraft.deriveUsername('', 'DEADBEEF00'),
          'userdeadbe', // first 6 of 'deadbeef00'
        );
      });

      test('uid is lowercased and stripped of non-alphanumerics for the frag',
          () {
        // '-'/'_' are stripped from the uid frag (only [a-z0-9] kept).
        expect(
          OnboardingDraft.deriveUsername('x', 'A1-B2_C3-D4'),
          'usera1b2c3', // 'a1b2c3d4' -> first 6 'a1b2c3'
        );
      });

      test('short uid (<6 alphanumerics) uses the whole fragment', () {
        // 'AB' -> 'ab' (length 2 < 6) -> 'userab'.
        expect(OnboardingDraft.deriveUsername('x', 'AB'), 'userab');
      });

      test('uid with no alphanumerics yields the bare "user" handle', () {
        // frag '' -> substring(0,0) '' -> base 'user'.
        expect(OnboardingDraft.deriveUsername('x', '----'), 'user');
      });
    });

    group('>30-char truncation', () {
      test('a >30-char base is truncated to exactly 30 chars', () {
        final input = 'a' * 40;
        final result = OnboardingDraft.deriveUsername(input, 'uid1');
        expect(result.length, 30);
        expect(result, 'a' * 30);
      });

      test('exactly 31 chars truncates to 30', () {
        expect(OnboardingDraft.deriveUsername('b' * 31, 'uid1'), 'b' * 30);
      });

      test('exactly 30 chars is preserved (boundary, not truncated)', () {
        expect(OnboardingDraft.deriveUsername('c' * 30, 'uid1'), 'c' * 30);
      });
    });
  });

  group('OnboardingDraft.incomeRanges', () {
    test('contains exactly the documented backend enum values in order', () {
      expect(OnboardingDraft.incomeRanges, <String>[
        '<25k',
        '25-50k',
        '50-75k',
        '75-100k',
        '100-150k',
        '150k+',
      ]);
    });
  });

  group('OnboardingDraft.toCallablePayload — birthYear', () {
    test('age set: birthYear = nowUtc.year - age', () {
      const draft = OnboardingDraft(age: 25);
      final expectedYear = DateTime.now().toUtc().year - 25;
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['birthYear'], expectedYear);
    });

    test('age null: defaults to 18 years -> nowUtc.year - 18', () {
      const draft = OnboardingDraft();
      final expectedYear = DateTime.now().toUtc().year - 18;
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['birthYear'], expectedYear);
    });
  });

  group('OnboardingDraft.toCallablePayload — incomeRange', () {
    Map<String, dynamic> payloadFor(String? income) =>
        OnboardingDraft(incomeRange: income)
            .toCallablePayload(displayName: 'D', username: 'u');

    test('absent (null) falls back to 50-75k', () {
      expect(payloadFor(null)['incomeRange'], '50-75k');
    });

    test('invalid value falls back to 50-75k', () {
      expect(payloadFor('not-a-range')['incomeRange'], '50-75k');
    });

    test('valid value passes through unchanged', () {
      expect(payloadFor('100-150k')['incomeRange'], '100-150k');
    });

    test('the fallback value itself (50-75k) still passes through', () {
      expect(payloadFor('50-75k')['incomeRange'], '50-75k');
    });

    test('every documented enum value passes through', () {
      for (final v in OnboardingDraft.incomeRanges) {
        expect(payloadFor(v)['incomeRange'], v);
      }
    });
  });

  group('OnboardingDraft.toCallablePayload — city / neighborhood resolution',
      () {
    test('non-blank city is trimmed and used', () {
      const draft = OnboardingDraft(city: '  Downtown  ');
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['city'], 'Downtown');
    });

    test('blank city with neighborhoods uses the first neighborhood', () {
      const draft =
          OnboardingDraft(city: '   ', neighborhoods: {'Echo Park'});
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['city'], 'Echo Park');
      expect(payload['neighborhood'], 'Echo Park');
    });

    test('blank city and no neighborhoods defaults to Los Angeles', () {
      const draft = OnboardingDraft();
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['city'], 'Los Angeles');
      expect(payload['neighborhood'], '');
    });

    test('neighborhood field is the first neighborhood when present '
        '(independent of city)', () {
      const draft =
          OnboardingDraft(city: 'NYC', neighborhoods: {'Soho'});
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['city'], 'NYC');
      expect(payload['neighborhood'], 'Soho');
    });
  });

  group('OnboardingDraft.toCallablePayload — gender / ethnicity defaults', () {
    test('null gender/ethnicity default to "Prefer not to say"', () {
      const draft = OnboardingDraft();
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['gender'], 'Prefer not to say');
      expect(payload['ethnicity'], 'Prefer not to say');
    });

    test('whitespace-only gender/ethnicity default to "Prefer not to say"', () {
      const draft = OnboardingDraft(gender: '   ', ethnicity: '\t ');
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['gender'], 'Prefer not to say');
      expect(payload['ethnicity'], 'Prefer not to say');
    });

    test('provided gender/ethnicity are trimmed and passed through', () {
      const draft =
          OnboardingDraft(gender: ' Male ', ethnicity: ' Asian ');
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['gender'], 'Male');
      expect(payload['ethnicity'], 'Asian');
    });
  });

  group('OnboardingDraft.toCallablePayload — sensitiveTopics', () {
    Map<String, dynamic> topicsFor(OnboardingDraft d) =>
        d.toCallablePayload(displayName: 'D', username: 'u')['sensitiveTopics']
            as Map<String, dynamic>;

    test('skipSensitive=false includes trimmed political & religion', () {
      const draft = OnboardingDraft(
        political: ' Left ',
        religion: ' Agnostic ',
      );
      final topics = topicsFor(draft);
      expect(topics['politicalLeaning'], 'Left');
      expect(topics['religionPreference'], 'Agnostic');
      expect(topics['skipSensitive'], false);
    });

    test('skipSensitive=true gates out political & religion entirely', () {
      const draft = OnboardingDraft(
        political: 'Left',
        religion: 'Agnostic',
        skipSensitive: true,
      );
      final topics = topicsFor(draft);
      expect(topics.containsKey('politicalLeaning'), isFalse);
      expect(topics.containsKey('religionPreference'), isFalse);
      expect(topics['skipSensitive'], true);
    });

    test('empty/whitespace political & religion are omitted even when not '
        'skipped', () {
      const draft = OnboardingDraft(political: '', religion: '   ');
      final topics = topicsFor(draft);
      expect(topics.containsKey('politicalLeaning'), isFalse);
      expect(topics.containsKey('religionPreference'), isFalse);
      expect(topics['skipSensitive'], false);
    });

    test('skipSensitive flag is always present (true case)', () {
      const draft = OnboardingDraft(skipSensitive: true);
      expect(topicsFor(draft).containsKey('skipSensitive'), isTrue);
      expect(topicsFor(draft)['skipSensitive'], true);
    });

    test('skipSensitive flag is always present (false default case)', () {
      const draft = OnboardingDraft();
      expect(topicsFor(draft).containsKey('skipSensitive'), isTrue);
      expect(topicsFor(draft)['skipSensitive'], false);
    });

    test('only one of political/religion present is handled independently', () {
      const draft = OnboardingDraft(political: 'Center');
      final topics = topicsFor(draft);
      expect(topics['politicalLeaning'], 'Center');
      expect(topics.containsKey('religionPreference'), isFalse);
    });
  });

  group('OnboardingDraft.toCallablePayload — displayName fallback', () {
    test('blank displayName falls back to username', () {
      const draft = OnboardingDraft();
      final payload =
          draft.toCallablePayload(displayName: '', username: 'handle');
      expect(payload['displayName'], 'handle');
    });

    test('whitespace-only displayName falls back to username', () {
      const draft = OnboardingDraft();
      final payload =
          draft.toCallablePayload(displayName: '   ', username: 'handle');
      expect(payload['displayName'], 'handle');
    });

    test('provided displayName is trimmed and used', () {
      const draft = OnboardingDraft();
      final payload =
          draft.toCallablePayload(displayName: '  Bob  ', username: 'handle');
      expect(payload['displayName'], 'Bob');
    });

    test('username is always passed through verbatim', () {
      const draft = OnboardingDraft();
      final payload = draft.toCallablePayload(
          displayName: 'Bob', username: 'bob_99');
      expect(payload['username'], 'bob_99');
    });
  });

  group('OnboardingDraft.toCallablePayload — referralCode inclusion', () {
    Map<String, dynamic> payloadFor(String? code) =>
        const OnboardingDraft().toCallablePayload(
          displayName: 'D',
          username: 'u',
          referralCode: code,
        );

    test('null referralCode is absent', () {
      expect(payloadFor(null).containsKey('referralCode'), isFalse);
    });

    test('empty referralCode is absent', () {
      expect(payloadFor('').containsKey('referralCode'), isFalse);
    });

    test('whitespace-only referralCode is absent', () {
      expect(payloadFor('   ').containsKey('referralCode'), isFalse);
    });

    test('non-blank referralCode is trimmed and included', () {
      final payload = payloadFor('  ABC123  ');
      expect(payload['referralCode'], 'ABC123');
    });

    test('referralCode is absent by default when the arg is omitted', () {
      final payload = const OnboardingDraft()
          .toCallablePayload(displayName: 'D', username: 'u');
      expect(payload.containsKey('referralCode'), isFalse);
    });
  });

  group('OnboardingDraft.toCallablePayload — list & bio fields', () {
    test('preference lists mirror the corresponding sets', () {
      const draft = OnboardingDraft(
        activities: {'Hiking'},
        cuisines: {'Italian'},
        drinks: {'Beer'},
        sports: {'Soccer'},
        bio: '  hello world  ',
      );
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['activityPreferences'], ['Hiking']);
      expect(payload['diningPreferences'], ['Italian']);
      // nightlifePreferences = [...drinks, ...sports]
      expect(payload['nightlifePreferences'], containsAll(['Beer', 'Soccer']));
      expect((payload['nightlifePreferences'] as List).length, 2);
      expect(payload['bio'], 'hello world');
    });

    test('defaults yield empty preference lists and empty bio', () {
      const draft = OnboardingDraft();
      final payload =
          draft.toCallablePayload(displayName: 'D', username: 'u');
      expect(payload['activityPreferences'], isEmpty);
      expect(payload['diningPreferences'], isEmpty);
      expect(payload['nightlifePreferences'], isEmpty);
      expect(payload['bio'], '');
    });
  });

  group('OnboardingDraft.extraProfileFields', () {
    test('default draft omits orientation & relationshipStatus and carries '
        'the always-present keys', () {
      const draft = OnboardingDraft();
      final fields = draft.extraProfileFields;
      expect(fields.containsKey('orientation'), isFalse);
      expect(fields.containsKey('relationshipStatus'), isFalse);
      expect(fields['veteran'], false);
      expect(fields['searchRadius'], '5 km');
      expect(fields['neighborhoods'], isEmpty);
      expect(fields['drinkPreferences'], isEmpty);
      expect(fields['sportsFollowed'], isEmpty);
      expect(fields['favoriteTeams'], isEmpty);
    });

    test('orientation & relationshipStatus included when non-empty', () {
      const draft = OnboardingDraft(
        orientation: 'Straight',
        relationshipStatus: 'Single',
      );
      final fields = draft.extraProfileFields;
      expect(fields['orientation'], 'Straight');
      expect(fields['relationshipStatus'], 'Single');
    });

    test('empty-string orientation/relationshipStatus are omitted', () {
      const draft =
          OnboardingDraft(orientation: '', relationshipStatus: '');
      final fields = draft.extraProfileFields;
      expect(fields.containsKey('orientation'), isFalse);
      expect(fields.containsKey('relationshipStatus'), isFalse);
    });

    test('always-present keys reflect the populated values', () {
      const draft = OnboardingDraft(
        veteran: true,
        radius: '10 km',
        neighborhoods: {'Echo Park'},
        drinks: {'Wine'},
        sports: {'Tennis'},
        teams: {'Lakers'},
      );
      final fields = draft.extraProfileFields;
      expect(fields['veteran'], true);
      expect(fields['searchRadius'], '10 km');
      expect(fields['neighborhoods'], ['Echo Park']);
      expect(fields['drinkPreferences'], ['Wine']);
      expect(fields['sportsFollowed'], ['Tennis']);
      expect(fields['favoriteTeams'], ['Lakers']);
    });
  });

  group('OnboardingDraftNotifier — setters mutate via copyWith', () {
    ProviderContainer makeContainer() {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      return container;
    }

    OnboardingDraftNotifier notifierOf(ProviderContainer c) =>
        c.read(onboardingDraftProvider.notifier);
    OnboardingDraft stateOf(ProviderContainer c) =>
        c.read(onboardingDraftProvider);

    test('build() seeds a default const OnboardingDraft', () {
      final c = makeContainer();
      final s = stateOf(c);
      expect(s.age, isNull);
      expect(s.veteran, isFalse);
      expect(s.radius, '5 km');
      expect(s.skipSensitive, isFalse);
    });

    test('setAge', () {
      final c = makeContainer();
      notifierOf(c).setAge(25);
      expect(stateOf(c).age, 25);
    });

    test('setGender', () {
      final c = makeContainer();
      notifierOf(c).setGender('Female');
      expect(stateOf(c).gender, 'Female');
    });

    test('setOrientation', () {
      final c = makeContainer();
      notifierOf(c).setOrientation('Bi');
      expect(stateOf(c).orientation, 'Bi');
    });

    test('setRelationshipStatus', () {
      final c = makeContainer();
      notifierOf(c).setRelationshipStatus('Married');
      expect(stateOf(c).relationshipStatus, 'Married');
    });

    test('setEthnicity', () {
      final c = makeContainer();
      notifierOf(c).setEthnicity('Latino');
      expect(stateOf(c).ethnicity, 'Latino');
    });

    test('setIncomeRange', () {
      final c = makeContainer();
      notifierOf(c).setIncomeRange('75-100k');
      expect(stateOf(c).incomeRange, '75-100k');
    });

    test('setVeteran', () {
      final c = makeContainer();
      notifierOf(c).setVeteran(true);
      expect(stateOf(c).veteran, isTrue);
    });

    test('setCuisines', () {
      final c = makeContainer();
      notifierOf(c).setCuisines({'Thai', 'Indian'});
      expect(stateOf(c).cuisines, {'Thai', 'Indian'});
    });

    test('setDrinks', () {
      final c = makeContainer();
      notifierOf(c).setDrinks({'Beer'});
      expect(stateOf(c).drinks, {'Beer'});
    });

    test('setActivities', () {
      final c = makeContainer();
      notifierOf(c).setActivities({'Climbing'});
      expect(stateOf(c).activities, {'Climbing'});
    });

    test('setPolitical', () {
      final c = makeContainer();
      notifierOf(c).setPolitical('Center');
      expect(stateOf(c).political, 'Center');
    });

    test('setReligion', () {
      final c = makeContainer();
      notifierOf(c).setReligion('None');
      expect(stateOf(c).religion, 'None');
    });

    test('setSkipSensitive', () {
      final c = makeContainer();
      notifierOf(c).setSkipSensitive(true);
      expect(stateOf(c).skipSensitive, isTrue);
    });

    test('setSports', () {
      final c = makeContainer();
      notifierOf(c).setSports({'Soccer'});
      expect(stateOf(c).sports, {'Soccer'});
    });

    test('setTeams', () {
      final c = makeContainer();
      notifierOf(c).setTeams({'Lakers'});
      expect(stateOf(c).teams, {'Lakers'});
    });

    test('setBio', () {
      final c = makeContainer();
      notifierOf(c).setBio('hi there');
      expect(stateOf(c).bio, 'hi there');
    });

    test('setRadius', () {
      final c = makeContainer();
      notifierOf(c).setRadius('25 km');
      expect(stateOf(c).radius, '25 km');
    });

    test('setCity', () {
      final c = makeContainer();
      notifierOf(c).setCity('Seattle');
      expect(stateOf(c).city, 'Seattle');
    });

    test('setNeighborhoods', () {
      final c = makeContainer();
      notifierOf(c).setNeighborhoods({'Capitol Hill'});
      expect(stateOf(c).neighborhoods, {'Capitol Hill'});
    });

    test('setters accumulate (copyWith preserves prior fields)', () {
      final c = makeContainer();
      notifierOf(c).setAge(30);
      notifierOf(c).setGender('Male');
      notifierOf(c).setCity('Austin');
      final s = stateOf(c);
      expect(s.age, 30);
      expect(s.gender, 'Male');
      expect(s.city, 'Austin');
    });

    test('reset returns to the const default OnboardingDraft', () {
      final c = makeContainer();
      final n = notifierOf(c);
      n.setAge(40);
      n.setGender('Female');
      n.setVeteran(true);
      n.setIncomeRange('150k+');
      n.setCity('Miami');
      n.setNeighborhoods({'Brickell'});
      n.setSkipSensitive(true);
      n.setBio('was here');
      n.reset();

      final s = stateOf(c);
      expect(s.age, isNull);
      expect(s.gender, isNull);
      expect(s.veteran, isFalse);
      expect(s.incomeRange, isNull);
      expect(s.city, '');
      expect(s.neighborhoods, isEmpty);
      expect(s.skipSensitive, isFalse);
      expect(s.bio, '');
      expect(s.radius, '5 km');
    });
  });
}
