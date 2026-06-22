import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:image_picker/image_picker.dart';
import 'package:uuid/uuid.dart';

/// Picks review verification photos and uploads them to Firebase Storage,
/// returning the download URLs. Uses putData(bytes) so it works on Flutter web
/// (the existing StorageService uses dart:io File which breaks on web).
class ReviewPhotoService {
  final _picker = ImagePicker();

  /// Lets the user pick up to [maxImages] photos, uploads them, and returns
  /// their download URLs. Returns an empty list if the user cancels.
  Future<List<String>> pickAndUpload({int maxImages = 3}) async {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) throw StateError('not-signed-in');

    final picked = await _picker.pickMultiImage(limit: maxImages, imageQuality: 80);
    if (picked.isEmpty) return const [];

    // A temp folder id per upload batch — the URLs are what matter; the review
    // doc stores them on submit. Matches storage.rules reviews/{id}/{uid}/{file}.
    final batchId = const Uuid().v4();
    final urls = <String>[];
    for (final x in picked.take(maxImages)) {
      final bytes = await x.readAsBytes();
      final contentType = x.mimeType ?? 'image/jpeg';
      final ext = contentType.contains('png')
          ? 'png'
          : contentType.contains('webp')
              ? 'webp'
              : 'jpg';
      final ref = FirebaseStorage.instance.ref('reviews/$batchId/$uid/${const Uuid().v4()}.$ext');
      await ref.putData(bytes, SettableMetadata(contentType: contentType));
      urls.add(await ref.getDownloadURL());
    }
    return urls;
  }
}
