/**
 * logging.ts — Structured JSON logger for Cloud Functions.
 *
 * All log entries include: traceId, userId, eventId, domain, and durationMs where applicable.
 * PII (email, phone, UAR, fingerprint vector) must NEVER be logged.
 */

import { logger } from "firebase-functions/v2";

export interface LogContext {
  traceId: string;
  userId?: string;
  eventId?: string;
  domain?: string;
  [key: string]: string | number | boolean | null | undefined;
}

function makeEntry(
  level: "info" | "warn" | "error",
  message: string,
  ctx: LogContext,
  extra?: Record<string, unknown>
): void {
  const entry = {
    level,
    message,
    ...ctx,
    ...extra,
    ts: new Date().toISOString(),
  };
  if (level === "error") {
    logger.error(entry);
  } else if (level === "warn") {
    logger.warn(entry);
  } else {
    logger.info(entry);
  }
}

export const log = {
  info: (message: string, ctx: LogContext, extra?: Record<string, unknown>) =>
    makeEntry("info", message, ctx, extra),
  warn: (message: string, ctx: LogContext, extra?: Record<string, unknown>) =>
    makeEntry("warn", message, ctx, extra),
  error: (message: string, ctx: LogContext, extra?: Record<string, unknown>) =>
    makeEntry("error", message, ctx, extra),
};

/** Generate a short random trace ID for correlation within a single function invocation. */
export function newTraceId(): string {
  return Math.random().toString(36).slice(2, 10);
}
