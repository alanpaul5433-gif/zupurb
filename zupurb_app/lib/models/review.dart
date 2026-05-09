import 'package:cloud_firestore/cloud_firestore.dart';

class Review {
  final String id;
  final String estId;
  final String authorName;
  final String authorPhotoUrl;
  final double score;
  final String text;
  final String aiSummary;
  final String verificationTier;
  final int helpfulVotes;

  const Review({
    required this.id,
    required this.estId,
    required this.authorName,
    required this.authorPhotoUrl,
    required this.score,
    required this.text,
    required this.aiSummary,
    required this.verificationTier,
    required this.helpfulVotes,
  });

  factory Review.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return Review(
      id: doc.id,
      estId: d['estId'] as String? ?? '',
      authorName: d['authorName'] as String? ?? 'Anonymous',
      authorPhotoUrl: d['authorPhotoUrl'] as String? ?? '',
      score: (d['score'] as num?)?.toDouble() ?? 0.0,
      text: d['text'] as String? ?? '',
      aiSummary: d['aiSummary'] as String? ?? '',
      verificationTier: d['verificationTier'] as String? ?? '',
      helpfulVotes: (d['helpfulVotes'] as num?)?.toInt() ?? 0,
    );
  }
}
