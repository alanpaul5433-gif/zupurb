import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../models/post.dart';

/// Stream of active posts. Used by the Search "Content/Posts" category.
final postsProvider = StreamProvider<List<Post>>((ref) {
  return FirebaseFirestore.instance
      .collection('posts')
      .where('isActive', isEqualTo: true)
      .limit(20)
      .snapshots()
      .map((s) => s.docs.map(Post.fromFirestore).toList());
});

/// Stream of posts by a specific author uid. Single-field query — no composite
/// index required. Used by own/other profile "Posts" tabs.
final postsByAuthorProvider =
    StreamProvider.family<List<Post>, String>((ref, uid) {
  return FirebaseFirestore.instance
      .collection('posts')
      .where('authorUid', isEqualTo: uid)
      .limit(50)
      .snapshots()
      .map((s) => s.docs.map(Post.fromFirestore).toList());
});
