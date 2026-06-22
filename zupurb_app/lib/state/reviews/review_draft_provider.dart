import 'package:flutter_riverpod/flutter_riverpod.dart';

/// In-progress review accumulated across the multi-screen review flow
/// (verify → rate → disclosure → write) and submitted via `submitReview`.
class ReviewDraft {
  final String estId;
  /// Display-only venue name (for the review-flow screen titles).
  final String estName;

  /// question index (0..7) → selected option index (0..3)
  final Map<int, int> answerIndexByQuestion;

  /// 0 = Verified/receipt, 1 = Partially verified/photo, 2 = Unverified
  final int verificationTier;
  final String? writtenText;
  final List<String> photoUrls;

  const ReviewDraft({
    this.estId = '',
    this.estName = '',
    this.answerIndexByQuestion = const {},
    this.verificationTier = 2,
    this.writtenText,
    this.photoUrls = const [],
  });

  ReviewDraft copyWith({
    String? estId,
    String? estName,
    Map<int, int>? answerIndexByQuestion,
    int? verificationTier,
    String? writtenText,
    List<String>? photoUrls,
  }) {
    return ReviewDraft(
      estId: estId ?? this.estId,
      estName: estName ?? this.estName,
      answerIndexByQuestion: answerIndexByQuestion ?? this.answerIndexByQuestion,
      verificationTier: verificationTier ?? this.verificationTier,
      writtenText: writtenText ?? this.writtenText,
      photoUrls: photoUrls ?? this.photoUrls,
    );
  }

  bool get allAnswered => answerIndexByQuestion.length == 8;

  /// Builds the exact `submitReview` payload. Because there is no working image
  /// uploader yet, `photo` is only used when photoUrls were actually supplied;
  /// otherwise we submit `unverified` (server rejects `photo` with empty urls).
  Map<String, dynamic> toCallablePayload() {
    const ids = ['a', 'b', 'c', 'd'];
    final answers = [
      for (var qi = 0; qi < 8; qi++)
        {
          'questionId': 'q${qi + 1}',
          'answerId': ids[answerIndexByQuestion[qi]!],
          'score': answerIndexByQuestion[qi]! + 1,
        }
    ];
    final usePhoto = verificationTier != 2 && photoUrls.isNotEmpty;
    return {
      'establishmentId': estId,
      'answers': answers,
      if (writtenText != null && writtenText!.trim().isNotEmpty)
        'writtenReview': writtenText!.trim(),
      'verificationMethod': usePhoto ? 'photo' : 'unverified',
      if (usePhoto) 'photoUrls': photoUrls,
      'visitDate': DateTime.now().toUtc().toIso8601String(),
    };
  }
}

class ReviewDraftNotifier extends Notifier<ReviewDraft> {
  @override
  ReviewDraft build() => const ReviewDraft();

  void start(String estId, [String estName = '']) => state = ReviewDraft(estId: estId, estName: estName);
  void setTier(int tier) => state = state.copyWith(verificationTier: tier);

  void setAnswer(int questionIndex, int optionIndex) {
    final m = Map<int, int>.from(state.answerIndexByQuestion)..[questionIndex] = optionIndex;
    state = state.copyWith(answerIndexByQuestion: m);
  }

  void setWritten(String text) => state = state.copyWith(writtenText: text);
  void setPhotoUrls(List<String> urls) => state = state.copyWith(photoUrls: urls);
  void reset() => state = const ReviewDraft();
}

final reviewDraftProvider =
    NotifierProvider<ReviewDraftNotifier, ReviewDraft>(ReviewDraftNotifier.new);
