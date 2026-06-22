import 'package:cloud_firestore/cloud_firestore.dart';

/// A comment on a review (Firestore: reviews/{reviewId}/comments/{id}).
class ReviewComment {
  final String id;
  final String reviewId;
  final String authorUid;
  final String authorName;
  final String authorPhotoUrl;
  final String text;
  final DateTime? createdAt;

  const ReviewComment({
    required this.id,
    required this.reviewId,
    required this.authorUid,
    required this.authorName,
    required this.authorPhotoUrl,
    required this.text,
    required this.createdAt,
  });

  factory ReviewComment.fromFirestore(DocumentSnapshot doc) {
    final d = (doc.data() as Map<String, dynamic>?) ?? const {};
    return ReviewComment(
      id: doc.id,
      reviewId: (d['reviewId'] ?? '').toString(),
      authorUid: (d['authorUid'] ?? '').toString(),
      authorName: (d['authorName'] as String?)?.isNotEmpty == true ? d['authorName'] as String : 'Anonymous',
      authorPhotoUrl: (d['authorPhotoUrl'] ?? '').toString(),
      text: (d['text'] ?? '').toString(),
      createdAt: (d['createdAt'] as Timestamp?)?.toDate(),
    );
  }
}
