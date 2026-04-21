/**
 * @axle/email — Resend singleton client
 *
 * Provides:
 * - sendEmail(options): send a single email via Resend
 * - sendBatch(emails): send multiple emails in one API call
 * - resetResendClient(): reset singleton for testing
 */

import { Resend } from "resend";
import type { SendEmailOptions } from "./types.js";

const FALLBACK_FROM = "AXLE <noreply@axle.app>";

/**
 * Resolve the default "from" address at call time.
 *
 * Reads `RESEND_FROM_EMAIL` so operators can point at whichever domain is
 * verified in the Resend dashboard (e.g. "noreply@yourdomain.com" or a full
 * "Name <email>" string). Falls back to `FALLBACK_FROM` if unset.
 */
function getDefaultFrom(): string {
  const envFrom = process.env.RESEND_FROM_EMAIL?.trim();
  if (!envFrom) return FALLBACK_FROM;
  // Already formatted as "Name <email>" → use as-is. Otherwise wrap with
  // the AXLE display name so templates render with a branded sender.
  return envFrom.includes("<") ? envFrom : `AXLE <${envFrom}>`;
}

let _client: Resend | null = null;

/**
 * Returns the Resend singleton.
 * Reads RESEND_API_KEY from the environment on first call.
 */
function getClient(): Resend {
  if (_client) return _client;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing required environment variable: RESEND_API_KEY");
  }

  _client = new Resend(apiKey);
  return _client;
}

/**
 * Reset the singleton (primarily for testing).
 */
export function resetResendClient(): void {
  _client = null;
}

/**
 * Send a single transactional email via Resend.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
  const client = getClient();

  const payload: Parameters<typeof client.emails.send>[0] = {
    from: options.from ?? getDefaultFrom(),
    to: Array.isArray(options.to) ? options.to : [options.to],
    subject: options.subject,
    ...(options.html != null ? { html: options.html } : { text: options.text ?? "" }),
    ...(options.replyTo != null ? { replyTo: options.replyTo } : {}),
  };

  const { data, error } = await client.emails.send(payload);

  if (error || !data) {
    throw new Error(`Resend send failed: ${error?.message ?? "unknown error"}`);
  }

  return { id: data.id };
}

/**
 * Send multiple emails in a single batch request.
 */
export async function sendBatch(emails: SendEmailOptions[]): Promise<{ ids: string[] }> {
  if (emails.length === 0) return { ids: [] };

  const client = getClient();

  const batchPayload = emails.map((opts): Parameters<typeof client.emails.send>[0] => ({
    from: opts.from ?? getDefaultFrom(),
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    ...(opts.html != null ? { html: opts.html } : { text: opts.text ?? "" }),
    ...(opts.replyTo != null ? { replyTo: opts.replyTo } : {}),
  }));

  const { data, error } = await client.batch.send(batchPayload);

  if (error || !data) {
    throw new Error(`Resend batch failed: ${error?.message ?? "unknown error"}`);
  }

  // data is CreateBatchSuccessResponse: { data: { id: string }[] }
  return { ids: data.data.map((item: { id: string }) => item.id) };
}
