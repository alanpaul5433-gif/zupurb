/**
 * Minimal firebase-admin mock for Jest unit tests.
 */
export const apps: unknown[] = [];
export const initializeApp = jest.fn();
export const getApp = jest.fn();
