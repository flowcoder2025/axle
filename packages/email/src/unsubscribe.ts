/**
 * @axle/email — Email unsubscribe token helpers
 *
 * Tokens are HMAC-SHA256 signatures over the email address.
 * Env var required: UNSUBSCRIBE_SECRET
 *
 * Usage:
 *   const token = generateUnsubscribeToken("user@example.com");
 *   const url   = getUnsubscribeUrl("user@example.com", "https://axle.app");
 *   const valid = verifyUnsubscribeToken("user@example.com", token);
 */

import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: UNSUBSCRIBE_SECRET");
  }
  return secret;
}

/**
 * Generate a URL-safe HMAC-SHA256 token for the given email address.
 */
export function generateUnsubscribeToken(email: string): string {
  const secret = getSecret();
  return createHmac("sha256", secret)
    .update(email.toLowerCase().trim())
    .digest("hex");
}

/**
 * Verify that `token` is the valid unsubscribe token for `email`.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  try {
    const expected = generateUnsubscribeToken(email);
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(token, "hex");

    if (expectedBuf.length !== actualBuf.length) return false;

    return timingSafeEqual(expectedBuf, actualBuf);
  } catch {
    return false;
  }
}

/**
 * Build a complete unsubscribe URL.
 * Defaults to the NEXT_PUBLIC_APP_URL env var when baseUrl is not provided.
 *
 * Example output:
 *   https://axle.app/unsubscribe?email=user%40example.com&token=abc123...
 */
export function getUnsubscribeUrl(email: string, baseUrl?: string): string {
  const base =
    baseUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL;

  if (!base) {
    throw new Error(
      "baseUrl is required or set NEXT_PUBLIC_APP_URL / APP_URL env var"
    );
  }

  const token = generateUnsubscribeToken(email);
  const url = new URL("/unsubscribe", base);
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);
  return url.toString();
}
