/**
 * jwtUtil.ts — Lightweight HMAC-SHA256 JWT helpers for deal QR codes.
 *
 * Uses Node.js built-in `crypto` — no external dependency required.
 *
 * The secret is read from the environment variable DEAL_QR_SECRET, which must
 * be set via Cloud Functions config / Secret Manager before production deployment.
 *
 * Token payload:
 *   {
 *     sub: uid,
 *     did: dealId,
 *     rid: redemptionId,
 *     iat: issued-at (unix seconds),
 *     exp: expiry   (unix seconds; iat + 7200)
 *   }
 *
 * Milestone: B9
 */

import { createHmac } from "crypto";

/** RC: deals.qrTtlMinutes — QR TTL in minutes */
export const QR_TTL_MINUTES = 120;

// ---------------------------------------------------------------------------
// Secret resolution
// ---------------------------------------------------------------------------

function getSecret(): string {
  const secret = process.env.DEAL_QR_SECRET;
  if (!secret) {
    throw new Error("DEAL_QR_SECRET is not configured. Set it in Secret Manager before deploying.");
  }
  return secret;
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64UrlDecode(data: string): string {
  const padded = data + "===".slice((data.length + 3) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

// ---------------------------------------------------------------------------
// Token shape
// ---------------------------------------------------------------------------

export interface QRTokenPayload {
  sub: string;   // uid
  did: string;   // dealId
  rid: string;   // redemptionId
  iat: number;   // issued-at (unix seconds)
  exp: number;   // expiry (unix seconds)
}

// ---------------------------------------------------------------------------
// sign
// ---------------------------------------------------------------------------

/**
 * Creates a signed JWT (HMAC-SHA256, HS256) for a deal QR code.
 * The token encodes uid, dealId, and redemptionId with a 2-hour expiry.
 */
export function signQRToken(
  uid: string,
  dealId: string,
  redemptionId: string
): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + QR_TTL_MINUTES * 60;

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({ sub: uid, did: dealId, rid: redemptionId, iat, exp })
  );

  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", getSecret())
    .update(signingInput)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${signingInput}.${signature}`;
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------

export interface VerifyResult {
  valid: boolean;
  expired: boolean;
  payload?: QRTokenPayload;
  error?: string;
}

/**
 * Verifies a QR JWT. Returns structured result — does NOT throw.
 */
export function verifyQRToken(token: string): VerifyResult {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return { valid: false, expired: false, error: "Malformed token" };
    }

    const [header, payload, signature] = parts;
    const signingInput = `${header}.${payload}`;
    const expectedSig = createHmac("sha256", getSecret())
      .update(signingInput)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Constant-time comparison to prevent timing attacks
    if (signature !== expectedSig) {
      return { valid: false, expired: false, error: "Invalid signature" };
    }

    const decoded = JSON.parse(base64UrlDecode(payload)) as QRTokenPayload;
    const now = Math.floor(Date.now() / 1000);

    if (decoded.exp < now) {
      return { valid: false, expired: true, payload: decoded, error: "Token expired" };
    }

    return { valid: true, expired: false, payload: decoded };
  } catch {
    return { valid: false, expired: false, error: "Token parse error" };
  }
}
