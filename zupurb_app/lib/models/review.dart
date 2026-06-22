import 'package:cloud_firestore/cloud_firestore.dart';

class Review {
  final String id;
  final String estId;
  final String estName;
  final String authorUid;
  final String authorName;
  final String authorPhotoUrl;
  final double score;
  final String text;
  final String verificationTier;
  final int helpfulVotes;
  final String status;
  final List<String> photoUrls;

  const Review({
    required this.id,
    required this.estId,
    required this.estName,
    this.authorUid = '',
    required this.authorName,
    required this.authorPhotoUrl,
    required this.score,
    required this.text,
    required this.verificationTier,
    required this.helpfulVotes,
    this.status = '',
    this.photoUrls = const [],
  });

  static List<String> _photos(Map<String, dynamic> d) {
    final raw = d['photoUrls'];
    if (raw is List) return raw.map((e) => e.toString()).where((s) => s.isNotEmpty).toList();
    return const [];
  }

  /// A human-readable venue label — the stored name, else the slug prettified
  /// ("amber-ember" → "Amber Ember") so the UI never shows a raw id.
  String get venueLabel {
    if (estName.isNotEmpty) return estName;
    if (estId.isEmpty) return '';
    return estId
        .split(RegExp(r'[-_]'))
        .where((w) => w.isNotEmpty)
        .map((w) => '${w[0].toUpperCase()}${w.substring(1)}')
        .join(' ');
  }

  factory Review.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return Review(
      id: doc.id,
      estId: d['estId'] as String? ?? '',
      estName: d['estName'] as String? ?? '',
      authorUid: d['authorUid'] as String? ?? '',
      authorName: d['authorName'] as String? ?? 'Anonymous',
      authorPhotoUrl: d['authorPhotoUrl'] as String? ?? '',
      score: (d['score'] as num?)?.toDouble() ?? 0.0,
      text: d['text'] as String? ?? '',
      verificationTier: d['verificationTier'] as String? ?? '',
      helpfulVotes: (d['helpfulVotes'] as num?)?.toInt() ?? 0,
      status: d['status'] as String? ?? '',
      photoUrls: _photos(d),
    );
  }

  /// Maps a doc from the canonical `reviews` collection written by the
  /// `submitReview` callable (different field names than the denormalized copy).
  /// Author identity is supplied by the caller (the profile being viewed).
  factory Review.fromAuthoredDoc(DocumentSnapshot doc,
      {String authorName = '', String authorPhotoUrl = ''}) {
    final d = (doc.data() as Map<String, dynamic>?) ?? const {};
    return Review(
      id: doc.id,
      estId: d['estId'] as String? ?? '',
      estName: d['estName'] as String? ?? '',
      authorUid: d['authorUid'] as String? ?? '',
      authorName: authorName,
      authorPhotoUrl: authorPhotoUrl,
      // rawScore is stored as an integer ×100 (e.g. 423 → 4.23). The seed also
      // writes a plain 0–5 `score`, so prefer a small `score` and divide rawScore.
      score: _resolveAuthoredScore(d),
      text: (d['body'] as String?) ?? (d['text'] as String?) ?? '',
      verificationTier: d['verificationTier'] as String? ?? '',
      helpfulVotes: (d['upvoteCount'] as num?)?.toInt() ?? (d['helpfulVotes'] as num?)?.toInt() ?? 0,
      status: d['status'] as String? ?? '',
      photoUrls: _photos(d),
    );
  }

  static double _resolveAuthoredScore(Map<String, dynamic> d) {
    final score = (d['score'] as num?)?.toDouble();
    if (score != null && score <= 5.0) return score; // plain 0–5 (seed)
    final raw = (d['rawScore'] as num?)?.toDouble();
    if (raw != null) return (raw / 100).clamp(0.0, 5.0); // integer ×100 (submitReview)
    return (score ?? 0.0).clamp(0.0, 5.0);
  }
}
