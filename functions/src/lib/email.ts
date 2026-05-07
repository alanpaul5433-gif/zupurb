/**
 * functions/src/lib/email.ts
 *
 * Thin SendGrid wrapper for all transactional emails sent by Zupurb Cloud Functions.
 * Consumers import `sendTransactionalEmail` and one of the typed template helpers.
 * No business logic lives here — only the vendor bridge.
 *
 * ─── Setup ──────────────────────────────────────────────────────────────────
 * Install SDK:   npm install @sendgrid/mail   (already in package.json)
 * Set secret:    firebase functions:secrets:set SENDGRID_API_KEY
 *                 (GCP Secret Manager; exposed to functions via process.env)
 * From address:  set SENDGRID_FROM_EMAIL + SENDGRID_FROM_NAME in the same way,
 *                or use the defaults below once the verified sender is confirmed.
 *
 * Dynamic Templates must be created in the SendGrid dashboard and their IDs
 * placed in the TEMPLATE_IDS map below.  Until real IDs are available the
 * placeholders will cause SendGrid to return a 404 — callers should treat
 * that as a non-fatal error and log it.
 *
 * ─── API surface ────────────────────────────────────────────────────────────
 *   sendTransactionalEmail(to, templateId, dynamicData) → Promise<void>
 *   sendWelcomeEmail(to, { displayName })
 *   sendOtpFallbackEmail(to, { otp, expiresInMinutes })
 *   sendReviewConfirmationEmail(to, { displayName, establishmentName, pointsEarned })
 *   sendReservationConfirmationEmail(to, { displayName, establishmentName, dateTime, partySize, confirmationCode })
 *
 * ─── Cost tagging ───────────────────────────────────────────────────────────
 * SendGrid charges per email sent.  Every call logs the email type so budget
 * burn is attributable.  Monitor via SendGrid Activity Feed + GCP Cloud Logging.
 * ────────────────────────────────────────────────────────────────────────────
 */

import sgMail from "@sendgrid/mail";
import { logger } from "firebase-functions";

// ─── SendGrid initialisation ─────────────────────────────────────────────────

const API_KEY = process.env.SENDGRID_API_KEY ?? "";
if (API_KEY) {
  sgMail.setApiKey(API_KEY);
} else {
  // Warn at module load time so misconfiguration is caught early in logs.
  logger.warn("[email] SENDGRID_API_KEY is not set — emails will not be delivered.");
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "noreply@zupurb.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME ?? "Zupurb";

// ─── Template ID registry ────────────────────────────────────────────────────
// Replace placeholder strings with real SendGrid Dynamic Template IDs once
// created in the SendGrid dashboard (Settings → Email API → Dynamic Templates).

const TEMPLATE_IDS = {
  welcome: "d-REPLACE_WITH_WELCOME_TEMPLATE_ID",
  otpFallback: "d-REPLACE_WITH_OTP_FALLBACK_TEMPLATE_ID",
  reviewConfirmation: "d-REPLACE_WITH_REVIEW_CONFIRMATION_TEMPLATE_ID",
  reservationConfirmation: "d-REPLACE_WITH_RESERVATION_CONFIRMATION_TEMPLATE_ID",
} as const;

export type EmailTemplateKey = keyof typeof TEMPLATE_IDS;

// ─── Core send function ──────────────────────────────────────────────────────

/**
 * Sends a SendGrid Dynamic Template email.
 *
 * @param to          Recipient email address.
 * @param templateId  SendGrid Dynamic Template ID (d-xxxxx…).
 * @param dynamicData Key/value pairs injected into the template via Handlebars.
 *
 * Converts SendGrid errors to a structured AppEmailError so callers don't
 * depend on the vendor response shape.
 */
export async function sendTransactionalEmail(
  to: string,
  templateId: string,
  dynamicData: Record<string, unknown>
): Promise<void> {
  const start = Date.now();

  try {
    await sgMail.send({
      to,
      from: { email: FROM_EMAIL, name: FROM_NAME },
      templateId,
      dynamicTemplateData: dynamicData,
    });

    logger.info("[email] sent", {
      to: _hashEmail(to),
      templateId,
      durationMs: Date.now() - start,
      success: true,
    });
  } catch (err: unknown) {
    const details = _extractSgError(err);
    logger.error("[email] send failed", {
      to: _hashEmail(to),
      templateId,
      durationMs: Date.now() - start,
      success: false,
      sgStatusCode: details.statusCode,
      sgMessage: details.message,
    });
    throw new AppEmailError(details.message, details.statusCode);
  }
}

// ─── Typed template helpers ──────────────────────────────────────────────────

/** Sent immediately after account creation. */
export function sendWelcomeEmail(
  to: string,
  data: { displayName: string }
): Promise<void> {
  return sendTransactionalEmail(to, TEMPLATE_IDS.welcome, {
    displayName: data.displayName,
  });
}

/**
 * OTP fallback for users who cannot receive SMS
 * (e.g. VoIP numbers, delivery failures).
 */
export function sendOtpFallbackEmail(
  to: string,
  data: { otp: string; expiresInMinutes: number }
): Promise<void> {
  return sendTransactionalEmail(to, TEMPLATE_IDS.otpFallback, {
    otp: data.otp,
    expiresInMinutes: data.expiresInMinutes,
  });
}

/** Sent after a review is published successfully. */
export function sendReviewConfirmationEmail(
  to: string,
  data: {
    displayName: string;
    establishmentName: string;
    pointsEarned: number;
  }
): Promise<void> {
  return sendTransactionalEmail(to, TEMPLATE_IDS.reviewConfirmation, {
    displayName: data.displayName,
    establishmentName: data.establishmentName,
    pointsEarned: data.pointsEarned,
  });
}

/** Sent immediately after a reservation is confirmed. */
export function sendReservationConfirmationEmail(
  to: string,
  data: {
    displayName: string;
    establishmentName: string;
    dateTime: string;       // pre-formatted string, e.g. "Saturday 14 June, 7:30 PM"
    partySize: number;
    confirmationCode: string;
  }
): Promise<void> {
  return sendTransactionalEmail(to, TEMPLATE_IDS.reservationConfirmation, {
    displayName: data.displayName,
    establishmentName: data.establishmentName,
    dateTime: data.dateTime,
    partySize: data.partySize,
    confirmationCode: data.confirmationCode,
  });
}

// ─── Internal error type ─────────────────────────────────────────────────────

export class AppEmailError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "AppEmailError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Hash email before logging — never log PII in plaintext. */
function _hashEmail(email: string): string {
  // Simple deterministic obfuscation: keep domain, mask local part.
  const parts = email.split("@");
  const local = parts[0] ?? "";
  const domain = parts[1];
  if (!local || !domain) return "[invalid]";
  return `${local[0] ?? "?"}***@${domain}`;
}

interface SgErrorDetails {
  statusCode?: number;
  message: string;
}

function _extractSgError(err: unknown): SgErrorDetails {
  if (
    err !== null &&
    typeof err === "object" &&
    "response" in err
  ) {
    const sgErr = err as {
      response?: { status?: number; body?: { errors?: Array<{ message?: string }> } };
    };
    const statusCode = sgErr.response?.status;
    const message =
      sgErr.response?.body?.errors?.[0]?.message ??
      "SendGrid request failed";
    return { statusCode, message };
  }
  return { message: err instanceof Error ? err.message : "Unknown email error" };
}
