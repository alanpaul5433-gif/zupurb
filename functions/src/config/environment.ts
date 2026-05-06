/**
 * environment.ts — runtime environment detection for Cloud Functions.
 *
 * GCLOUD_PROJECT is set automatically by the Firebase runtime.
 * Locally it is set by firebase-functions-test or the emulator.
 */
export const Environment = {
  isProduction: process.env.GCLOUD_PROJECT?.endsWith("-prod") ?? false,
  isStaging: process.env.GCLOUD_PROJECT?.endsWith("-staging") ?? false,
  projectId: process.env.GCLOUD_PROJECT ?? "zupurb-dev",
} as const;
