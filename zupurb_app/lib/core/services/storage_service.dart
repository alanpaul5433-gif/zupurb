// storage_service.dart — I2: Firebase Storage wrapper.
//
// Wraps firebase_storage upload/delete behind a single import path.
// All images are compressed client-side before upload.
// EXIF data is stripped by flutter_image_compress automatically.
//
// Storage paths:
//   users/{uid}/profile.jpg
//   reviews/{reviewId}/{uid}/{timestamp}.jpg
//   establishments/{estId}/{timestamp}.jpg
//
// API summary (for consumers):
//   uploadProfilePhoto(File, uid)              - returns Future<String> downloadUrl
//   uploadReviewPhoto(File, reviewId, uid)     - returns Future<String> downloadUrl
//   uploadEstablishmentPhoto(File, estId)      - returns Future<String> downloadUrl
//   deleteFile(downloadUrl)                    - returns Future<void>

import 'dart:io';

import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

/// Internal error type so callers never depend on Firebase Storage shapes.
class StorageException implements Exception {
  const StorageException(this.message, {this.cause});
  final String message;
  final Object? cause;

  @override
  String toString() => 'StorageException: $message${cause != null ? ' (cause: $cause)' : ''}';
}

class StorageService {
  StorageService({FirebaseStorage? storage})
      : _storage = storage ?? FirebaseStorage.instance;

  final FirebaseStorage _storage;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /// Uploads a profile photo for [uid].
  /// Compresses to max 800×800 JPEG at 85% quality.
  /// Returns the public download URL.
  Future<String> uploadProfilePhoto(File image, String uid) async {
    final compressed = await _compress(
      image,
      maxWidth: 800,
      maxHeight: 800,
      quality: 85,
    );
    final path = 'users/$uid/profile.jpg';
    return _upload(compressed, path, contentType: 'image/jpeg');
  }

  /// Uploads a review photo for [reviewId] / [uid].
  /// Compresses to max 1200×1200 JPEG at 90% quality.
  /// Returns the public download URL.
  Future<String> uploadReviewPhoto(
    File image,
    String reviewId,
    String uid,
  ) async {
    final compressed = await _compress(
      image,
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 90,
    );
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final path = 'reviews/$reviewId/$uid/$timestamp.jpg';
    return _upload(compressed, path, contentType: 'image/jpeg');
  }

  /// Uploads an establishment photo for [establishmentId].
  /// Compresses to max 1600×1200 JPEG at 90% quality.
  /// Returns the public download URL.
  Future<String> uploadEstablishmentPhoto(
    File image,
    String establishmentId,
  ) async {
    final compressed = await _compress(
      image,
      maxWidth: 1600,
      maxHeight: 1200,
      quality: 90,
    );
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    final path = 'establishments/$establishmentId/$timestamp.jpg';
    return _upload(compressed, path, contentType: 'image/jpeg');
  }

  /// Deletes a file from Cloud Storage by its download URL.
  /// Extracts the storage path from the URL; no-ops if the file is not found.
  Future<void> deleteFile(String downloadUrl) async {
    try {
      final ref = _storage.refFromURL(downloadUrl);
      await ref.delete();
    } on FirebaseException catch (e) {
      if (e.code == 'object-not-found') {
        // Already gone — treat as success.
        return;
      }
      throw StorageException('Failed to delete file', cause: e);
    } catch (e) {
      throw StorageException('Failed to delete file', cause: e);
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /// Compresses [source] to [maxWidth]×[maxHeight] JPEG at [quality] (0–100).
  /// Returns a [File] pointing to the compressed output in the system temp dir.
  /// flutter_image_compress strips EXIF data during this step.
  Future<File> _compress(
    File source, {
    required int maxWidth,
    required int maxHeight,
    required int quality,
  }) async {
    try {
      final targetPath =
          '${source.parent.path}/${DateTime.now().millisecondsSinceEpoch}_compressed.jpg';

      final result = await FlutterImageCompress.compressAndGetFile(
        source.absolute.path,
        targetPath,
        minWidth: maxWidth,
        minHeight: maxHeight,
        quality: quality,
        format: CompressFormat.jpeg,
        keepExif: false, // strip EXIF — privacy requirement
      );

      if (result == null) {
        throw StorageException('Image compression returned null');
      }
      return File(result.path);
    } catch (e) {
      if (e is StorageException) rethrow;
      throw StorageException('Image compression failed', cause: e);
    }
  }

  /// Uploads [file] to Storage at [storagePath] and returns the download URL.
  /// Logs cost band (file size bucket) for budget attribution.
  Future<String> _upload(
    File file,
    String storagePath, {
    required String contentType,
  }) async {
    final stopwatch = Stopwatch()..start();
    try {
      final bytes = await file.length();
      final ref = _storage.ref(storagePath);

      final metadata = SettableMetadata(contentType: contentType);
      await ref.putFile(file, metadata);

      final url = await ref.getDownloadURL();

      stopwatch.stop();
      _logUpload(
        path: storagePath,
        bytes: bytes,
        durationMs: stopwatch.elapsedMilliseconds,
        success: true,
      );
      return url;
    } on FirebaseException catch (e) {
      stopwatch.stop();
      _logUpload(
        path: storagePath,
        bytes: -1,
        durationMs: stopwatch.elapsedMilliseconds,
        success: false,
      );
      throw StorageException('Upload failed: ${e.message}', cause: e);
    } catch (e) {
      stopwatch.stop();
      _logUpload(
        path: storagePath,
        bytes: -1,
        durationMs: stopwatch.elapsedMilliseconds,
        success: false,
      );
      rethrow;
    }
  }

  /// Cost-band telemetry: logs size bucket (≤100KB / ≤500KB / ≤2MB / >2MB)
  /// so we can attribute Storage egress costs by upload type.
  void _logUpload({
    required String path,
    required int bytes,
    required int durationMs,
    required bool success,
  }) {
    final band = bytes < 0
        ? 'unknown'
        : bytes <= 100 * 1024
            ? '≤100KB'
            : bytes <= 500 * 1024
                ? '≤500KB'
                : bytes <= 2 * 1024 * 1024
                    ? '≤2MB'
                    : '>2MB';

    // TODO(integrations-dev): route to Firebase Analytics / Crashlytics
    // when telemetry pipeline is wired (I12).
    // ignore: avoid_print
    print(
      '[StorageService] path=$path success=$success '
      'sizeBand=$band durationMs=$durationMs',
    );
  }
}
