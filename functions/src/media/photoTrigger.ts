/**
 * media/photoTrigger.ts — I2: Storage trigger for image moderation.
 *
 * Fires when a new object is finalised in Firebase Cloud Storage.
 * Only acts on paths under reviews/ and establishments/.
 *
 * On each matching upload:
 *   1. Calls moderateImage() via the Rekognition wrapper.
 *   2. If the image is UNSAFE:
 *      a. Deletes the file from Cloud Storage.
 *      b. Marks the parent Firestore doc with { photoRejected: true }.
 *   3. If the image is SAFE: no action (moderation pass is silent).
 *
 * Storage path conventions (from StorageService):
 *   reviews/{reviewId}/{uid}/{timestamp}.jpg
 *   establishments/{estId}/{timestamp}.jpg
 *
 * Environment variables required:
 *   AWS_REKOGNITION_KEY_ID, AWS_REKOGNITION_SECRET, AWS_REKOGNITION_REGION
 */

import { onObjectFinalized } from "firebase-functions/v2/storage";
import { getStorage } from "firebase-admin/storage";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { moderateImage } from "../integrations/rekognition/client";
import { validateReviewPhoto } from "../integrations/ai/photoValidation";

// ---------------------------------------------------------------------------
// Trigger
// ---------------------------------------------------------------------------

/**
 * Exported Cloud Function — registered in index.ts as onPhotoUploaded.
 *
 * Runs on every Storage object finalisation; filters to review and
 * establishment photo paths only.
 */
export const onPhotoUploaded = onObjectFinalized(
  {
    // Run in us-central1 to co-locate with Firestore and minimise egress cost.
    region: "us-central1",
    // Give enough memory/time for Rekognition round-trip (typically <5 s).
    memory: "512MiB",
    timeoutSeconds: 60,
  },
  async (event) => {
    const filePath: string = event.data.name ?? "";
    const bucket: string = event.data.bucket;
    const contentType: string = event.data.contentType ?? "";

    // Only process image MIME types we accept.
    if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
      return;
    }

    // Only process review and establishment photo paths.
    const isReview = filePath.startsWith("reviews/");
    const isEstablishment = filePath.startsWith("establishments/");
    if (!isReview && !isEstablishment) {
      return;
    }

    // Build a public download URL for Rekognition.
    // Firebase Storage download URLs are public when Storage rules allow public read.
    const downloadUrl = await _getDownloadUrl(bucket, filePath);

    let safe: boolean;
    try {
      const result = await moderateImage(downloadUrl);
      safe = result.safe;

      console.log(
        JSON.stringify({
          event: "photo_moderation_complete",
          filePath,
          safe,
          labels: result.labels,
          confidence: result.confidence,
        })
      );
    } catch (err) {
      // Rekognition call failed — log and fail-soft (do NOT delete the file).
      // Operations should alert on this via Cloud Logging error rate.
      console.error(
        JSON.stringify({
          event: "photo_moderation_error",
          filePath,
          error: (err as Error).message,
        })
      );
      return;
    }

    if (safe) {
      // I5: Rekognition safety check passed — now validate photo context via Claude Vision.
      // Only relevant for review photos (not establishment hero shots).
      if (isReview) {
        const parts = filePath.split("/");
        const reviewId = parts.length >= 2 ? parts[1] : "unknown";
        try {
          const validationResult = await validateReviewPhoto(
            downloadUrl,
            "photoTrigger",
            reviewId
          );
          if (!validationResult.valid) {
            const db = getFirestore();
            await db.collection("reviews").doc(reviewId).update({
              photoContextInvalid: true,
              photoContextInvalidAt: FieldValue.serverTimestamp(),
            });
            console.log(
              JSON.stringify({
                event: "review_photo_context_invalid",
                reviewId,
                reason: validationResult.reason,
                confidence: validationResult.confidence,
              })
            );
          }
        } catch (err) {
          // Non-fatal — never block or delete on vision validation failure.
          console.error(
            JSON.stringify({
              event: "photo_validation_error",
              filePath,
              error: (err as Error).message,
            })
          );
        }
      }
      return;
    }

    // Image is UNSAFE: delete from Storage and mark the Firestore document.
    await Promise.all([
      _deleteStorageFile(bucket, filePath),
      _markDocPhotoRejected(filePath, isReview),
    ]);
  }
);

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Returns a signed download URL valid long enough for the Rekognition call. */
async function _getDownloadUrl(bucket: string, filePath: string): Promise<string> {
  const storageRef = getStorage().bucket(bucket).file(filePath);
  // Signed URL valid for 5 minutes — enough for the moderation call.
  const [url] = await storageRef.getSignedUrl({
    action: "read",
    expires: Date.now() + 5 * 60 * 1000,
  });
  return url;
}

/** Deletes a file from Cloud Storage. No-ops if the file is already gone. */
async function _deleteStorageFile(bucket: string, filePath: string): Promise<void> {
  try {
    await getStorage().bucket(bucket).file(filePath).delete();
    console.log(
      JSON.stringify({ event: "photo_deleted_unsafe", filePath })
    );
  } catch (err) {
    // If deletion fails, log but don't throw — partial failure is better than crashing.
    console.error(
      JSON.stringify({
        event: "photo_delete_failed",
        filePath,
        error: (err as Error).message,
      })
    );
  }
}

/**
 * Parses the storage path to find the Firestore document and marks it with
 * { photoRejected: true, photoRejectedAt: serverTimestamp() }.
 *
 * Path formats:
 *   reviews/{reviewId}/{uid}/{timestamp}.jpg  → doc: reviews/{reviewId}
 *   establishments/{estId}/{timestamp}.jpg    → doc: establishments/{estId}
 */
async function _markDocPhotoRejected(
  filePath: string,
  isReview: boolean
): Promise<void> {
  const db = getFirestore();
  const parts = filePath.split("/");

  try {
    if (isReview && parts.length >= 2) {
      // reviews/{reviewId}/...
      const reviewId = parts[1];
      await db.collection("reviews").doc(reviewId).update({
        photoRejected: true,
        photoRejectedAt: FieldValue.serverTimestamp(),
      });
      console.log(
        JSON.stringify({ event: "review_photo_rejected", reviewId })
      );
    } else if (!isReview && parts.length >= 2) {
      // establishments/{estId}/...
      const estId = parts[1];
      await db.collection("establishments").doc(estId).update({
        photoRejected: true,
        photoRejectedAt: FieldValue.serverTimestamp(),
      });
      console.log(
        JSON.stringify({ event: "establishment_photo_rejected", estId: estId })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "photo_rejected_mark_failed",
        filePath,
        error: (err as Error).message,
      })
    );
  }
}
