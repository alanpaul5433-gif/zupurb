/// Unit tests for lib/state/reviews/review_draft_provider.dart
///
/// Covers the pure in-memory review-flow state and its Riverpod notifier:
///   - ReviewDraft const ctor defaults
///   - copyWith: each field overridden independently, others preserved
///   - allAnswered getter: purely length-based (< 8 false, == 8 true)
///   - toCallablePayload():
///       * answers array built for q1..q8 with answerId in [a,b,c,d] and
///         score == optionIndex + 1 (requires all 8 answered)
///       * usePhoto logic (tier != 2 && photoUrls non-empty → 'photo' + urls;
///         else 'unverified' and NO photoUrls key)
///       * writtenReview included only when non-blank (trimmed)
///       * visitDate present as a parseable ISO-8601 UTC string near now
///   - ReviewDraftNotifier: build/start/setTier/setAnswer (immutable accumulate)/
///     setWritten/setPhotoUrls/reset
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:zupurb_app/state/reviews/review_draft_provider.dart';

/// A draft with all 8 questions answered using a known mapping that exercises
/// every answerId (a,b,c,d) and every score (1..4).
ReviewDraft _fullyAnswered({
  String estId = 'est1',
  int verificationTier = 2,
  String? writtenText,
  List<String> photoUrls = const [],
}) =>
    ReviewDraft(
      estId: estId,
      answerIndexByQuestion: const {
        0: 0, // q1 → a, score 1
        1: 1, // q2 → b, score 2
        2: 2, // q3 → c, score 3
        3: 3, // q4 → d, score 4
        4: 0, // q5 → a, score 1
        5: 1, // q6 → b, score 2
        6: 2, // q7 → c, score 3
        7: 3, // q8 → d, score 4
      },
      verificationTier: verificationTier,
      writtenText: writtenText,
      photoUrls: photoUrls,
    );

void main() {
  group('ReviewDraft const ctor & defaults', () {
    test('default values', () {
      const d = ReviewDraft();
      expect(d.estId, '');
      expect(d.estName, '');
      expect(d.answerIndexByQuestion, isEmpty);
      expect(d.verificationTier, 2);
      expect(d.writtenText, isNull);
      expect(d.photoUrls, isEmpty);
    });

    test('is a compile-time const', () {
      // Two const instances with identical args are canonicalized to one object.
      expect(identical(const ReviewDraft(), const ReviewDraft()), isTrue);
    });
  });

  group('ReviewDraft.copyWith', () {
    const base = ReviewDraft();

    test('estId only', () {
      final d = base.copyWith(estId: 'e9');
      expect(d.estId, 'e9');
      expect(d.estName, '');
      expect(d.verificationTier, 2);
      expect(d.answerIndexByQuestion, isEmpty);
      expect(d.writtenText, isNull);
      expect(d.photoUrls, isEmpty);
    });

    test('estName only', () {
      final d = base.copyWith(estName: 'The Bar');
      expect(d.estName, 'The Bar');
      expect(d.estId, '');
    });

    test('answerIndexByQuestion only', () {
      final d = base.copyWith(answerIndexByQuestion: const {0: 1, 1: 2});
      expect(d.answerIndexByQuestion, {0: 1, 1: 2});
      expect(d.estId, '');
      expect(d.verificationTier, 2);
    });

    test('verificationTier only', () {
      final d = base.copyWith(verificationTier: 0);
      expect(d.verificationTier, 0);
      expect(d.estId, '');
    });

    test('writtenText only', () {
      final d = base.copyWith(writtenText: 'great');
      expect(d.writtenText, 'great');
      expect(d.photoUrls, isEmpty);
    });

    test('photoUrls only', () {
      final d = base.copyWith(photoUrls: const ['u1', 'u2']);
      expect(d.photoUrls, ['u1', 'u2']);
      expect(d.writtenText, isNull);
    });

    test('passing nothing preserves all fields', () {
      final seed = _fullyAnswered(
        verificationTier: 1,
        writtenText: 'hi',
        photoUrls: const ['p'],
      );
      final d = seed.copyWith();
      expect(d.estId, seed.estId);
      expect(d.answerIndexByQuestion, seed.answerIndexByQuestion);
      expect(d.verificationTier, 1);
      expect(d.writtenText, 'hi');
      expect(d.photoUrls, ['p']);
    });
  });

  group('ReviewDraft.allAnswered', () {
    test('false when fewer than 8 answered', () {
      const d = ReviewDraft(answerIndexByQuestion: {0: 0, 1: 1, 2: 2});
      expect(d.allAnswered, isFalse);
    });

    test('false at exactly 7', () {
      const d = ReviewDraft(
        answerIndexByQuestion: {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0},
      );
      expect(d.allAnswered, isFalse);
    });

    test('true at exactly 8', () {
      expect(_fullyAnswered().allAnswered, isTrue);
    });

    test('purely length-based: 8 entries with a gap key still reports true '
        '(ODDITY — toCallablePayload would still throw on the missing index)', () {
      // Keys {0..6, 10}: length 8 → allAnswered true, but q8 (index 7) is absent.
      const d = ReviewDraft(answerIndexByQuestion: {
        0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 10: 0,
      });
      expect(d.allAnswered, isTrue);
      expect(() => d.toCallablePayload(), throwsA(isA<TypeError>()));
    });
  });

  group('ReviewDraft.toCallablePayload — answers array', () {
    test('builds q1..q8 with answerId a..d and score index+1', () {
      final payload = _fullyAnswered().toCallablePayload();
      final answers = payload['answers'] as List;
      expect(answers.length, 8);
      expect(answers, [
        {'questionId': 'q1', 'answerId': 'a', 'score': 1},
        {'questionId': 'q2', 'answerId': 'b', 'score': 2},
        {'questionId': 'q3', 'answerId': 'c', 'score': 3},
        {'questionId': 'q4', 'answerId': 'd', 'score': 4},
        {'questionId': 'q5', 'answerId': 'a', 'score': 1},
        {'questionId': 'q6', 'answerId': 'b', 'score': 2},
        {'questionId': 'q7', 'answerId': 'c', 'score': 3},
        {'questionId': 'q8', 'answerId': 'd', 'score': 4},
      ]);
    });

    test('throws when not all 8 are answered (null-check on `!`)', () {
      const partial = ReviewDraft(answerIndexByQuestion: {0: 0, 1: 1});
      expect(() => partial.toCallablePayload(), throwsA(isA<TypeError>()));
    });

    test('carries establishmentId from estId', () {
      final payload = _fullyAnswered(estId: 'venue-42').toCallablePayload();
      expect(payload['establishmentId'], 'venue-42');
    });
  });

  group('ReviewDraft.toCallablePayload — usePhoto / verificationMethod', () {
    test('tier 2 (unverified) with photos → unverified, no photoUrls key', () {
      final payload = _fullyAnswered(
        verificationTier: 2,
        photoUrls: const ['a.jpg'],
      ).toCallablePayload();
      expect(payload['verificationMethod'], 'unverified');
      expect(payload.containsKey('photoUrls'), isFalse);
    });

    test('tier 1 with photos → photo, photoUrls included', () {
      final payload = _fullyAnswered(
        verificationTier: 1,
        photoUrls: const ['a.jpg', 'b.jpg'],
      ).toCallablePayload();
      expect(payload['verificationMethod'], 'photo');
      expect(payload['photoUrls'], ['a.jpg', 'b.jpg']);
    });

    test('tier 0 with photos → photo, photoUrls included', () {
      final payload = _fullyAnswered(
        verificationTier: 0,
        photoUrls: const ['only.jpg'],
      ).toCallablePayload();
      expect(payload['verificationMethod'], 'photo');
      expect(payload['photoUrls'], ['only.jpg']);
    });

    test('tier 1 but empty photos → unverified, no photoUrls key', () {
      final payload = _fullyAnswered(
        verificationTier: 1,
        photoUrls: const [],
      ).toCallablePayload();
      expect(payload['verificationMethod'], 'unverified');
      expect(payload.containsKey('photoUrls'), isFalse);
    });

    test('tier 2 with no photos → unverified, no photoUrls key', () {
      final payload = _fullyAnswered().toCallablePayload();
      expect(payload['verificationMethod'], 'unverified');
      expect(payload.containsKey('photoUrls'), isFalse);
    });
  });

  group('ReviewDraft.toCallablePayload — writtenReview', () {
    test('omitted when writtenText is null', () {
      final payload = _fullyAnswered().toCallablePayload();
      expect(payload.containsKey('writtenReview'), isFalse);
    });

    test('omitted when writtenText is blank/whitespace', () {
      final payload =
          _fullyAnswered(writtenText: '   \n\t ').toCallablePayload();
      expect(payload.containsKey('writtenReview'), isFalse);
    });

    test('included and trimmed when non-blank', () {
      final payload =
          _fullyAnswered(writtenText: '  Loved it  ').toCallablePayload();
      expect(payload['writtenReview'], 'Loved it');
    });
  });

  group('ReviewDraft.toCallablePayload — visitDate', () {
    test('present as a parseable ISO-8601 UTC string near now', () {
      final before = DateTime.now().toUtc();
      final payload = _fullyAnswered().toCallablePayload();
      final raw = payload['visitDate'];
      expect(raw, isA<String>());

      final parsed = DateTime.parse(raw as String);
      expect(parsed.isUtc, isTrue);
      // Generated from DateTime.now(), so it must be within a small window.
      expect(parsed.difference(before).abs(), lessThan(const Duration(seconds: 5)));
    });
  });

  group('ReviewDraftNotifier', () {
    ProviderContainer makeContainer() {
      final c = ProviderContainer();
      addTearDown(c.dispose);
      return c;
    }

    test('build() returns a default ReviewDraft', () {
      final c = makeContainer();
      final d = c.read(reviewDraftProvider);
      expect(d.estId, '');
      expect(d.estName, '');
      expect(d.verificationTier, 2);
      expect(d.answerIndexByQuestion, isEmpty);
      expect(d.writtenText, isNull);
      expect(d.photoUrls, isEmpty);
    });

    test('start(estId) sets estId, default estName empty', () {
      final c = makeContainer();
      c.read(reviewDraftProvider.notifier).start('est1');
      final d = c.read(reviewDraftProvider);
      expect(d.estId, 'est1');
      expect(d.estName, '');
    });

    test('start(estId, estName) sets both', () {
      final c = makeContainer();
      c.read(reviewDraftProvider.notifier).start('est1', 'Blue Bar');
      final d = c.read(reviewDraftProvider);
      expect(d.estId, 'est1');
      expect(d.estName, 'Blue Bar');
    });

    test('start() resets previously accumulated answers', () {
      final c = makeContainer();
      final n = c.read(reviewDraftProvider.notifier);
      n.setAnswer(0, 1);
      n.start('fresh');
      expect(c.read(reviewDraftProvider).answerIndexByQuestion, isEmpty);
      expect(c.read(reviewDraftProvider).estId, 'fresh');
    });

    test('setTier updates verificationTier', () {
      final c = makeContainer();
      c.read(reviewDraftProvider.notifier).setTier(0);
      expect(c.read(reviewDraftProvider).verificationTier, 0);
    });

    test('setAnswer accumulates across calls', () {
      final c = makeContainer();
      final n = c.read(reviewDraftProvider.notifier);
      n.setAnswer(0, 2);
      n.setAnswer(1, 3);
      expect(c.read(reviewDraftProvider).answerIndexByQuestion, {0: 2, 1: 3});
    });

    test('setAnswer overwrites the same question index', () {
      final c = makeContainer();
      final n = c.read(reviewDraftProvider.notifier);
      n.setAnswer(0, 2);
      n.setAnswer(0, 1);
      expect(c.read(reviewDraftProvider).answerIndexByQuestion, {0: 1});
    });

    test('setAnswer mutates immutably (does not touch prior map instance)', () {
      final c = makeContainer();
      final n = c.read(reviewDraftProvider.notifier);
      n.setAnswer(0, 1);
      final firstMap = c.read(reviewDraftProvider).answerIndexByQuestion;
      n.setAnswer(1, 2);
      // The earlier snapshot must remain unchanged (a copy was made).
      expect(firstMap, {0: 1});
      expect(c.read(reviewDraftProvider).answerIndexByQuestion, {0: 1, 1: 2});
    });

    test('setWritten updates writtenText', () {
      final c = makeContainer();
      c.read(reviewDraftProvider.notifier).setWritten('nice place');
      expect(c.read(reviewDraftProvider).writtenText, 'nice place');
    });

    test('setPhotoUrls updates photoUrls', () {
      final c = makeContainer();
      c.read(reviewDraftProvider.notifier).setPhotoUrls(['x.jpg', 'y.jpg']);
      expect(c.read(reviewDraftProvider).photoUrls, ['x.jpg', 'y.jpg']);
    });

    test('reset() returns state to const ReviewDraft() defaults', () {
      final c = makeContainer();
      final n = c.read(reviewDraftProvider.notifier);
      n.start('est1', 'Name');
      n.setTier(0);
      n.setAnswer(0, 1);
      n.setWritten('text');
      n.setPhotoUrls(['p.jpg']);

      n.reset();

      final d = c.read(reviewDraftProvider);
      expect(d.estId, '');
      expect(d.estName, '');
      expect(d.verificationTier, 2);
      expect(d.answerIndexByQuestion, isEmpty);
      expect(d.writtenText, isNull);
      expect(d.photoUrls, isEmpty);
    });
  });
}
