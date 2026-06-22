import 'package:cloud_firestore/cloud_firestore.dart';

class Post {
  final String id;
  final String authorUid;
  final String authorName;
  final String authorPhotoUrl;
  final String caption;
  final String imageUrl;
  final String venueName;
  /// Establishment id the post tags (empty if the venue isn't on the platform).
  final String venueId;
  /// Author persona lens: 'Food Lover' | 'Influencer' | 'Artist' | 'Traveler' | 'Explorer'.
  final String persona;
  final int likes;

  const Post({
    required this.id,
    required this.authorUid,
    required this.authorName,
    required this.authorPhotoUrl,
    required this.caption,
    required this.imageUrl,
    required this.venueName,
    this.venueId = '',
    this.persona = '',
    required this.likes,
  });

  factory Post.fromFirestore(DocumentSnapshot doc) {
    final d = doc.data() as Map<String, dynamic>;
    return Post(
      id: doc.id,
      authorUid: d['authorUid'] as String? ?? '',
      authorName: d['authorName'] as String? ?? '',
      authorPhotoUrl: d['authorPhotoUrl'] as String? ?? '',
      caption: d['caption'] as String? ?? '',
      imageUrl: d['imageUrl'] as String? ?? '',
      venueName: d['venueName'] as String? ?? '',
      venueId: d['venueId'] as String? ?? '',
      persona: d['persona'] as String? ?? '',
      likes: (d['likes'] as num?)?.toInt() ?? 0,
    );
  }
}
