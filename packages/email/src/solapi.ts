/**
 * @axle/email — Solapi SMS + KakaoTalk AlimTalk client
 *
 * Uses Solapi REST API directly (no SDK) with HMAC-SHA256 auth.
 * Env vars required:
 *   SOLAPI_API_KEY
 *   SOLAPI_API_SECRET
 *   SOLAPI_SENDER_PHONE  (e.g. 01012345678 or 010-1234-5678)
 */

import { createHmac, randomUUID } from "node:crypto";

const SOLAPI_BASE_URL = "https://api.solapi.com";

// ── Auth ──────────────────────────────────────────────────────────────────────

function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = randomUUID();
  const signature = createHmac("sha256", apiSecret)
    .update(`${date}${salt}`)
    .digest("hex");

  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

// ── Phone number formatting ────────────────────────────────────────────────────

/**
 * Normalise a Korean mobile number to E.164-adjacent format (no dashes, no +82).
 * Accepts:  010-1234-5678  /  01012345678  /  +8210-1234-5678
 * Returns:  01012345678
 */
export function formatKoreanPhone(phone: string): string {
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, "");

  // Handle country code +82 / 82
  if (digits.startsWith("82")) {
    digits = "0" + digits.slice(2);
  }

  // Basic sanity check: Korean mobile starts with 010/011/016/017/018/019
  if (!/^01[016789]\d{7,8}$/.test(digits)) {
    throw new Error(`Invalid Korean phone number: ${phone}`);
  }

  return digits;
}

// ── Internal request helper ───────────────────────────────────────────────────

interface SolapiErrorBody {
  errorCode?: string;
  errorMessage?: string;
  message?: string;
}

async function solapiRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Missing required environment variables: SOLAPI_API_KEY, SOLAPI_API_SECRET"
    );
  }

  const response = await fetch(`${SOLAPI_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(apiKey, apiSecret),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const err = (await response.json()) as SolapiErrorBody;
      detail = err.errorMessage ?? err.message ?? JSON.stringify(err);
    } catch {
      detail = await response.text();
    }
    throw new Error(`Solapi request failed (${response.status}): ${detail}`);
  }

  return response.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a plain SMS message.
 */
export async function sendSms(to: string, text: string): Promise<void> {
  const senderPhone = process.env.SOLAPI_SENDER_PHONE;
  if (!senderPhone) {
    throw new Error("Missing required environment variable: SOLAPI_SENDER_PHONE");
  }

  const formattedTo = formatKoreanPhone(to);
  const formattedFrom = formatKoreanPhone(senderPhone);

  await solapiRequest("POST", "/messages/v4/send", {
    message: {
      to: formattedTo,
      from: formattedFrom,
      text,
      type: text.length > 90 ? "LMS" : "SMS",
    },
  });
}

/**
 * Send a KakaoTalk AlimTalk using a pre-registered template.
 */
export async function sendAlimTalk(
  to: string,
  templateId: string,
  variables: Record<string, string>
): Promise<void> {
  const senderPhone = process.env.SOLAPI_SENDER_PHONE;
  if (!senderPhone) {
    throw new Error("Missing required environment variable: SOLAPI_SENDER_PHONE");
  }

  const formattedTo = formatKoreanPhone(to);
  const formattedFrom = formatKoreanPhone(senderPhone);

  await solapiRequest("POST", "/messages/v4/send", {
    message: {
      to: formattedTo,
      from: formattedFrom,
      type: "ATA",
      kakaoOptions: {
        pfId: process.env.SOLAPI_KAKAO_PF_ID ?? undefined,
        templateId,
        variables,
      },
    },
  });
}
