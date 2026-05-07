// video_service.dart — I2: Mux video upload stub.
//
// Mux does NOT publish an official Flutter/Dart SDK.
// The production implementation uses Mux's resumable upload REST API
// (https://docs.mux.com/api-reference) which requires server-side token
// exchange via Cloud Functions.
//
// TODO(integrations-dev): Full Mux integration checklist:
//   1. Create a Mux account at https://mux.com and generate an API token.
//   2. Store MUX_TOKEN_ID and MUX_TOKEN_SECRET in Cloud Functions environment
//      (Secret Manager in prod, .env in dev).
//   3. Add a Cloud Function `media_createUploadUrl` that calls
//      POST https://api.mux.com/video/v1/uploads and returns the upload URL.
//   4. Replace the stub below with:
//      a. Call `media_createUploadUrl` to get a Mux direct-upload URL + upload ID.
//      b. PUT the video file to that URL (chunked, resumable).
//      c. Poll GET /video/v1/assets/{assetId} until status == "ready".
//      d. Return the Mux playback ID for storage in the reel Firestore doc.
//   5. Mux webhooks (video.asset.ready, video.asset.errored) should also be
//      wired into Cloud Functions (HTTP trigger) to update reel status async.
//
// API summary (for consumers):
//   uploadVideo(File, uid) — throws UnimplementedError until Mux is configured.

import 'dart:io';

/// Thrown when the video service is not yet configured.
class VideoServiceException implements Exception {
  const VideoServiceException(this.message);
  final String message;

  @override
  String toString() => 'VideoServiceException: $message';
}

class VideoService {
  const VideoService();

  /// Uploads a video file for [uid].
  ///
  /// STUB — throws [UnimplementedError] until Mux credentials are configured.
  /// See the TODO at the top of this file for the full integration checklist.
  // ignore: avoid_returning_null_for_void
  Future<String> uploadVideo(File video, String uid) async {
    throw UnimplementedError(
      'Mux video upload — configure MUX_TOKEN_ID and MUX_TOKEN_SECRET '
      'in Cloud Functions environment, then replace this stub. '
      'See lib/core/services/video_service.dart for the full checklist.',
    );
  }
}
