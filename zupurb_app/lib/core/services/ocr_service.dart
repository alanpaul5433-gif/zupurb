// ocr_service.dart — I4: Receipt OCR upload + verification service.
//
// Wraps Firebase Storage upload and verifyReceiptForReview Cloud Function
// call behind a single import path. Frontend never calls Storage or Functions
// directly for receipt verification.
//
// Storage path: receipts/{reviewId}/{uid}.jpg
// Cloud Function: verifyReceiptForReview
//
// API summary (for consumers):
//   uploadReceiptAndVerify(
//     File receiptImage,
//     String reviewId,
//     String establishmentId,
//   ) → Future<OcrVerificationResult>
//
// Errors are converted to [OcrServiceException] so callers never depend on
// Firebase-specific exception shapes.

import 'dart:io';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

/// Result returned by [OcrService.uploadReceiptAndVerify].
class OcrVerificationResult {
  const OcrVerificationResult({
    required this.verified,
    required this.confidence,
    required this.vendor,
    required this.totalAmount,
    this.reason,
  });

  /// Whether the receipt was accepted as valid for this review.
  final bool verified;

  /// OCR confidence score in [0.0, 1.0].
  final double confidence;

  /// Supplier name extracted from the receipt, or empty string.
  final String vendor;

  /// Total receipt amount in major currency units (e.g. 42.50), or 0.0.
  final double totalAmount;

  /// Human-readable reason when [verified] is false.
  final String? reason;

  @override
  String toString() =>
      'OcrVerificationResult(verified=$verified, confidence=$confidence, '
      'vendor=$vendor, totalAmount=$totalAmount)';
}

// ---------------------------------------------------------------------------
// Internal error type
// ---------------------------------------------------------------------------

/// Thrown by [OcrService] on any error.
/// Callers map this to user copy via [l10n] — never show [message] directly.
class OcrServiceException implements Exception {
  const OcrServiceException(this.message, {this.cause});

  final String message;
  final Object? cause;

  @override
  String toString() =>
      'OcrServiceException: $message${cause != null ? ' (cause: $cause)' : ''}';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/// Compresses, uploads, and verifies a receipt image for a review.
///
/// Inject [storage], [functions], and [auth] in tests to avoid real SDK calls.
class OcrService {
  OcrService({
    FirebaseStorage? storage,
    FirebaseFunctions? functions,
    FirebaseAuth? auth,
  })  : _storage = storage ?? FirebaseStorage.instance,
        _functions = functions ?? FirebaseFunctions.instance,
        _auth = auth ?? FirebaseAuth.instance;

  final FirebaseStorage _storage;
  final FirebaseFunctions _functions;
  final FirebaseAuth _auth;

  /// Maximum compressed file size in bytes (2 MB per I4 spec).
  static const int _maxBytes = 2 * 1024 * 1024;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /// Compresses [receiptImage] to ≤2 MB, uploads it to Firebase Storage at
  /// `receipts/{reviewId}/{uid}.jpg`, calls `verifyReceiptForReview`, and
  /// returns an [OcrVerificationResult].
  ///
  /// Throws [OcrServiceException] on storage or function errors.
  Future<OcrVerificationResult> uploadReceiptAndVerify(
    File receiptImage,
    String reviewId,
    String establishmentId,
  ) async {
    final stopwatch = Stopwatch()..start();

    final uid = _requireUid();

    // 1. Compress image to ≤2 MB
    final compressed = await _compressToLimit(receiptImage);

    // 2. Upload to Firebase Storage
    final storagePath = 'receipts/$reviewId/$uid.jpg';
    final downloadUrl = await _upload(compressed, storagePath);

    // 3. Call verifyReceiptForReview Cloud Function
    final result = await _callVerify(
      reviewId: reviewId,
      receiptImageUrl: downloadUrl,
      establishmentId: establishmentId,
    );

    stopwatch.stop();
    _log(
      reviewId: reviewId,
      verified: result.verified,
      durationMs: stopwatch.elapsedMilliseconds,
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  String _requireUid() {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      throw const OcrServiceException('User must be authenticated to upload a receipt.');
    }
    return uid;
  }

  /// Compresses [source] to ≤ [_maxBytes] JPEG.
  /// Tries quality=85 first, then 60 if still over limit.
  Future<File> _compressToLimit(File source) async {
    try {
      final targetPath =
          '${source.parent.path}/${DateTime.now().millisecondsSinceEpoch}_receipt_compressed.jpg';

      // First pass: 85% quality, max 1920×1920
      var result = await FlutterImageCompress.compressAndGetFile(
        source.absolute.path,
        targetPath,
        minWidth: 1920,
        minHeight: 1920,
        quality: 85,
        format: CompressFormat.jpeg,
        keepExif: false,
      );

      if (result == null) {
        throw const OcrServiceException('Image compression returned null (pass 1).');
      }

      final bytes = await result.length();

      if (bytes > _maxBytes) {
        // Second pass: lower quality to get under 2 MB
        final targetPath2 =
            '${source.parent.path}/${DateTime.now().millisecondsSinceEpoch}_receipt_compressed2.jpg';
        result = await FlutterImageCompress.compressAndGetFile(
          source.absolute.path,
          targetPath2,
          minWidth: 1280,
          minHeight: 1280,
          quality: 60,
          format: CompressFormat.jpeg,
          keepExif: false,
        );
        if (result == null) {
          throw const OcrServiceException('Image compression returned null (pass 2).');
        }
      }

      return File(result.path);
    } catch (e) {
      if (e is OcrServiceException) rethrow;
      throw OcrServiceException('Image compression failed.', cause: e);
    }
  }

  /// Uploads [file] to [storagePath] and returns the download URL.
  Future<String> _upload(File file, String storagePath) async {
    try {
      final ref = _storage.ref(storagePath);
      await ref.putFile(file, SettableMetadata(contentType: 'image/jpeg'));
      return ref.getDownloadURL();
    } on FirebaseException catch (e) {
      throw OcrServiceException('Receipt upload failed: ${e.message}', cause: e);
    } catch (e) {
      throw OcrServiceException('Receipt upload failed.', cause: e);
    }
  }

  /// Calls the `verifyReceiptForReview` Cloud Function.
  Future<OcrVerificationResult> _callVerify({
    required String reviewId,
    required String receiptImageUrl,
    required String establishmentId,
  }) async {
    try {
      final callable = _functions.httpsCallable('verifyReceiptForReview');
      final response = await callable.call<Map<String, dynamic>>({
        'reviewId': reviewId,
        'receiptImageUrl': receiptImageUrl,
        'establishmentId': establishmentId,
      });

      final data = response.data;

      // Parse parsedData sub-object for vendor + totalAmount
      final parsedData = data['parsedData'] as Map<String, dynamic>? ?? {};

      return OcrVerificationResult(
        verified: (data['verified'] as bool?) ?? false,
        confidence: (data['confidence'] as num?)?.toDouble() ?? 0.0,
        vendor: (parsedData['vendor'] as String?) ?? '',
        totalAmount: (parsedData['totalAmount'] as num?)?.toDouble() ?? 0.0,
        reason: data['reason'] as String?,
      );
    } on FirebaseFunctionsException catch (e) {
      throw OcrServiceException(
        'Receipt verification failed: ${e.message ?? e.code}',
        cause: e,
      );
    } catch (e) {
      throw OcrServiceException('Receipt verification call failed.', cause: e);
    }
  }

  void _log({
    required String reviewId,
    required bool verified,
    required int durationMs,
  }) {
    // TODO(integrations-dev): route to FirebaseAnalytics / Crashlytics (I12)
    // ignore: avoid_print
    print(
      '[OcrService] reviewId=$reviewId verified=$verified durationMs=$durationMs',
    );
  }
}
