/**
 * Minimal firebase-functions/v2/https mock for Jest unit tests.
 */
export class HttpsError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "HttpsError";
  }
}
