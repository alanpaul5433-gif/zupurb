/**
 * Mock for firebase-admin/firestore used in Jest unit tests.
 * Provides Timestamp, FieldValue, and a getFirestore stub.
 */

export class Timestamp {
  readonly seconds: number;
  readonly nanoseconds: number;

  constructor(seconds: number, nanoseconds = 0) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }

  toMillis(): number {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6);
  }

  toDate(): Date {
    return new Date(this.toMillis());
  }

  static now(): Timestamp {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  static fromMillis(ms: number): Timestamp {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }

  static fromDate(date: Date): Timestamp {
    return Timestamp.fromMillis(date.getTime());
  }
}

export const FieldValue = {
  increment: (n: number) => ({ _type: "increment", value: n }),
  serverTimestamp: () => ({ _type: "serverTimestamp" }),
  arrayUnion: (...items: unknown[]) => ({ _type: "arrayUnion", items }),
  arrayRemove: (...items: unknown[]) => ({ _type: "arrayRemove", items }),
  delete: () => ({ _type: "delete" }),
};

// Default mock Firestore — tests that need Firestore must provide their own
// via jest.mock or by replacing mockDb before the call.
export let mockDb: Record<string, unknown> = {};

export const getFirestore = jest.fn(() => mockDb);
